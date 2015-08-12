/**
 * A tool for creating timelapses with GPhoto2 and Node.JS
 * @param sequence
 * @constructor
 */

var Timelapse = function(exposureSeq){

  var now = new Date().getTime();

  //@todo find out how other node developers do this!!
  this.libs = {

    gphoto2: undefined,
    aws: require('aws-sdk'),
    fs: require('fs'),
    winston: require('winston'),
    seq: require('./sequence.js'),
    exec: require('child_process').exec
    
  }

  this.camera = undefined;
  this.usbPath = undefined;
  this.sequence = (exposureSeq.length > 0) ? new this.libs.seq.Sequence(exposureSeq) : exposureSeq;

  if (!this.libs.fs.existsSync('logs')){
    this.libs.fs.mkdirSync('logs');
  }

  this.libs.winston.exitOnError = false;
  this.libs.winston.add(this.libs.winston.transports.File, { filename: 'logs/' + now + '.log' });
  this.libs.winston.info('solar lapse is up and running at ' + now);

  /**
   * swallowing all errors this way is a bad idea, @todo: please revisit!
   */
  process.on('uncaughtException', function (err) {
    this.libs.winston.warn('Caught uncaught exception: ' + err);
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

    self.libs.winston.info("resetting usb port because " + reason);

    if(this.camera){

      // clear out old data so callback will trigger correct phase
      this.camera = null;
      this.libs.gphoto2 = null;

      this.libs.winston.warn('re-establishing connection to ' + self.usbPath);

      this.libs.exec('./usbreset ' + self.usbPath, function(err, stdout, stderr){

        self.libs.winston.info('stdout: ' + stdout);
        self.libs.winston.info('stderr: ' + stderr);

        if (err !== null) {

          // crash if we can't get going again
          self.libs.winston.error('exec error: ' + err);

        }

        callback();

      });

    } else {

      self.libs.winston.error('unable to locate usable camera.  please check hardware');
      process.exit(1);

    }

  },

  /**
   * Use node-this.libs.gphoto2 to capture an image from the active camera
   * and upload to Amazon S3
   *
   * @param camera  An instance of a this.libs.gphoto2 camera
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

      this.libs.gphoto2 = require('gphoto2');
      var GPhoto = new this.libs.gphoto2.GPhoto2();

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

        self.libs.winston.info('Found', self.camera.model);
	self.libs.winston.info('Camera found on port ' + self.usbPath);

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

      if (!self.libs.fs.existsSync(imageDirectory)){
        self.libs.fs.mkdirSync(imageDirectory);
      }

      self.libs.winston.info('taking image ' + imageProps.name + ' (' + imageProps.ts + ')');

      self.libs.fs.writeFile(imagePath, data, function (err) {

        if (err){

          //resetUsb('error writing data to disk');

        } else {

          var fileSizeInBytes = self.libs.fs.statSync(imagePath)["size"],
              fileSizeInMegabytes = fileSizeInBytes / 1000000.0;

          self.libs.winston.info('Size of ' + imageFilename + ': ' + fileSizeInMegabytes + 'mb');

          if(fileSizeInBytes < 100000){

            self.resetUsb('insufficient filesize detected', callback);
            self.libs.fs.unlink(imagePath);
            return;

          }

          if(imageProps.bucket){
            self.uploadToS3(imagePath, 'bc-timelapse', imageProps.bucket + "/" + imageFilename);
          }

        }

        var currentImageDelay = new Date().getTime() - imageProps.ts;

        self.libs.winston.info('operating delay for current image was ' + (currentImageDelay / 1000) + "s")

        self.takeNextPicture(currentImageDelay);

      });

    });

  },

  uploadToS3: function(imagePath, bucket, key, recurse){

    var recurse = recurse || 2,
        self = this;

    var imageStream = self.libs.fs.createReadStream(imagePath);

    var s3 = new self.libs.aws.S3({
      params: {
        Bucket: bucket,
        Key: key
      }
    });

    s3.upload({ Body: imageStream}, function(err, data) {

      if (err) {

        self.libs.winston.warn("error uploading data: ", err);

        if(recurse > 0){
          self.uploadToS3(imagePath, bucket, key, recurse - 1);
        }

      } else {

        self.libs.winston.info(key + ' has uploaded successfully to S3')

        // only delete data if we're sure we've uploaded it to s3
        self.libs.fs.unlink(imagePath);

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

        var currentTime = new Date().getTime(),
            nextImage = this.sequence.getNextImage(delay);

        // if a previous image was delayed and we aren't strict, the next image might be in the past.
        // just take it immediately.
        var interval = nextImage.ts - currentTime;
        interval = (interval < 0) ? 0 : interval;

        setTimeout(function(){

          // wait (diff now and next exposure) then recurse
          this.takePicture(nextImage);

        }.bind(this), interval);

        return;

      }

      this.libs.winston.info('done');

    }

};

module.exports.Timelapse = Timelapse;
