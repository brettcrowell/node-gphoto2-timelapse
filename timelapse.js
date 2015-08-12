var gphoto2 = undefined;
var aws = require('aws-sdk');
var fs = require('fs');
var winston = require('winston');
var seq = require('./sequence.js');
var moment = require('moment');
var exec = require('child_process').exec;

/**
 * A tool for creating timelapses with GPhoto2 and Node.JS
 * @param sequence
 * @constructor
 */

var Timelapse = function(exposureSeq, preferences){

  var now = new Date().getTime();

  // preferences
  this.preferences = preferences || {};
  this.preferences["maxMillisecondsBetweenImages"] = this.preferences["maxMillisecondsBetweenImages"] || 3600000;

  // moment.js configuration
  moment.locale('en', {
    calendar : {
      lastDay : '[yesterday at] LTS',
      sameDay : '[today] (L) [at] LTS',
      nextDay : '[tomorrow] (L) [at] LTS',
      lastWeek : '[last] dddd [at] LTS',
      nextWeek : 'dddd (L) [at] LTS',
      sameElse : 'L'
    }
  });

  this.camera = undefined;
  this.usbPath = undefined;
  this.deferredImage = undefined;
  this.sequence = (exposureSeq.length > 0) ? new seq.Sequence(exposureSeq) : exposureSeq;

  if (!fs.existsSync('logs')){
    fs.mkdirSync('logs');
  }

  winston.exitOnError = false;
  winston.add(winston.transports.File, { filename: 'logs/' + now + '.log' });
  winston.info('solar lapse is up and running at ' + moment(now).format('LTS [on] L'));

  /**
   * swallowing all errors this way is a bad idea, @todo: please revisit!
   */
  process.on('uncaughtException', function (err) {
    winston.warn('Caught uncaught exception: ' + err);
  }.bind(this));

  // @todo: future support for separting photos into buckets dynamically
  this.takeNextPicture();

};

Timelapse.prototype = {

  /**
   * Something bad happened.  Ask the operating system to
   * reset all USB connections to see if we can fix it.
   *
   * Note:  This requires a compiled version of usbreset.c to reside in the same folder...
   * gcc -o usbreset usbreset.c
   */

  resetUsb: function(reason, callback){

    var self = this;

    winston.info("resetting usb port because " + reason);

    if(this.camera){

      // clear out old data so callback will trigger correct phase
      this.camera = null;
      gphoto2 = null;

      winston.warn('re-establishing connection to ' + self.usbPath);

      exec('./usbreset ' + self.usbPath, function(err, stdout, stderr){

        winston.info('stdout: ' + stdout);
        winston.info('stderr: ' + stderr);

        if (err !== null) {

          // crash if we can't get going again
          winston.error('exec error: ' + err);

        }

        callback();

      });

    } else {

      winston.error('unable to locate usable camera.  please check hardware');
      process.exit(1);

    }

  },

  /**
   * Use node-gphoto2 to capture an image from the active camera
   * and upload to Amazon S3
   *
   * @param camera  An instance of a gphoto2 camera
   * @param imageProps Image metadata including name and timestamp (ts)
   */

  takePicture: function(imageProps){

    var self = this;

    // keep a callback in case something goes wrong
    var callback = function(){
      this.takePicture(imageProps);
    }.bind(self);

    if(!this.camera){

      /*
        no camera was detected.  this is probably the first exposure in the series,
        but may be a crash recovery.  either way, re-instantiate GPhoto2 and try to
        find a camera to use.  Since this is an async process, need to provide a callback.
       */

      gphoto2 = require('gphoto2');
      var GPhoto = new gphoto2.GPhoto2();

      // List cameras / assign list item to variable to use below options
      GPhoto.list(function (list) {

        if (list.length === 0) {
          // no cameras found?  not buying it.
          self.resetUsb('no cameras found', callback);
          return;
        }

        self.camera = list[0];

	// determine the usb bus and port to reset
	var port = self.camera.port.match(/usb:([0-9]+),([0-9]+)/);
        self.usbPath = '/dev/bus/usb/' + port[1] + '/' + port[2];

        winston.info('Found', self.camera.model);
	winston.info('Camera found on port ' + self.usbPath);

        // take the picture as a callback
        callback();

      });

      return;

    }

    // no camera problems if we've made it here, take a photo

    this.camera.takePicture({download: true}, function (er, data) {

      /*
        image data returned from the camera.  check to make sure that it wasn't 'bad data' (anything under 100kb)
        and if all is good, upload it to Amazon S3 and delete from local output directory.
       */

      var imageFilename = imageProps.name + imageProps.ts + '.jpg',
          imageDirectory = __dirname + '/output',
          imagePath = imageDirectory + '/' + imageFilename;

      if (!fs.existsSync(imageDirectory)){
        fs.mkdirSync(imageDirectory);
      }

      winston.info('taking image ' + imageProps.name + ' (' + imageProps.ts + ')');

      fs.writeFile(imagePath, data, function (err) {

        if (err){

          //resetUsb('error writing data to disk');

        } else {

          var fileSizeInBytes = fs.statSync(imagePath)["size"],
              fileSizeInMegabytes = fileSizeInBytes / 1000000.0;

          winston.info('Size of ' + imageFilename + ': ' + fileSizeInMegabytes + 'mb');

          if(fileSizeInBytes < 100000){

            self.resetUsb('insufficient filesize detected', callback);
            fs.unlink(imagePath);
            return;

          }

          if(imageProps.bucket){
            self.uploadToS3(imagePath, 'bc-timelapse', imageProps.bucket + "/" + imageFilename);
          }

        }

        var currentImageDelay = new Date().getTime() - imageProps.ts;

        winston.info('operating delay for current image was ' + (currentImageDelay / 1000) + "s")

        self.takeNextPicture(currentImageDelay);

      });

    });

  },

  uploadToS3: function(imagePath, bucket, key, recurse){

    var recurse = recurse || 2,
        self = this;

    var imageStream = fs.createReadStream(imagePath);

    var s3 = new aws.S3({
      params: {
        Bucket: bucket,
        Key: key
      }
    });

    s3.upload({ Body: imageStream}, function(err, data) {

      if (err) {

        winston.warn("error uploading data: ", err);

        if(recurse > 0){
          self.uploadToS3(imagePath, bucket, key, recurse - 1);
        }

      } else {

        winston.info(key + ' has uploaded successfully to S3')

        // only delete data if we're sure we've uploaded it to s3
        fs.unlink(imagePath);

      }

    });

  },

  /**
   * Recursive function which reads a list of exposure times
   * (in ms) and calls for a photo to be taken at each
   *
   * @param nextImage Image properties, must include name & timestamp (ts)
   */

   takeNextPicture: function(delay){

      if(this.sequence.hasMoreImages(delay)){

        var currentTime = new Date().getTime();

        // images may be deferred if they cause the camera to idle for too long
        var nextImage = this.deferredImage || this.sequence.getNextImage(delay);

        var millisecondsUntilNextImage = nextImage.ts - currentTime;

        // if a previous image was delayed and we aren't strict, the next image might be in the past.  just take it immediately.
        millisecondsUntilNextImage = (millisecondsUntilNextImage < 0) ? 0 : millisecondsUntilNextImage;

        if(millisecondsUntilNextImage > this.preferences.maxMillisecondsBetweenImages){

          /*
           some cameras have been known to 'drop off' if they aren't accessed frequently enough.
           the following provision will take a throwaway image every (default 60 mins) to prevent that.
           */

          this.deferredImage = nextImage;

          nextImage = {

            name: "keep-alive-signal",
            ts: currentTime + this.preferences.maxMillisecondsBetweenImages,
            discard: true

          };

          millisecondsUntilNextImage = this.preferences.maxMillisecondsBetweenImages;

        } else {

          // if the next image is in an acceptable range, we no longer need to defer
          this.deferredImage = null;

        }

        // due to built in delays, next image might not capture at specified ts.  keep the user informed!
        var nextImageActualTs = currentTime + millisecondsUntilNextImage;
        winston.info("next image (`" + nextImage.name + "`) will be taken " + moment(nextImageActualTs).calendar());

        // use a javascript timeout to wait, then capture the next image
        setTimeout(function(){ this.takePicture(nextImage); }.bind(this), millisecondsUntilNextImage);

        return;

      }

      winston.info('done');

    }

};

module.exports.Timelapse = Timelapse;
