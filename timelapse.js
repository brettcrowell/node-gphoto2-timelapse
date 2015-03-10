/**
 * A tool for creating timelapses with GPhoto2 and Node.JS
 * @param sequence
 * @constructor
 */

var Timelapse = function(exposureSeq){

  var now = new Date().getTime();
  
  this.libs = {

    gphoto2: undefined,
    aws: require('aws-sdk'),
    fs: require('fs'),
    winston: require('winston'),
    seq: require('./sequence.js'),
    exec: require('child_process').exec
    
  }

  this.camera = undefined;
  this.sequence = (exposureSeq.length > 0) ? new this.libs.seq.Sequence(exposureSeq) : exposureSeq;

  if (!this.libs.fs.existsSync('logs')){
    this.libs.fs.mkdirSync('logs');
  }

  this.libs.winston.add(this.libs.winston.transports.File, { filename: 'logs/' + now + '.log' });
  this.libs.winston.info('solar lapse is up and running at ' + now);

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

    // determine the usb bus and port to reset
    var port = this.camera.port.match(/usb:([0-9]+),([0-9]+)/),
        usbPath = '/dev/bus/usb/' + port[1] + '/' + port[2];

    // clear out old data so callback will trigger correct phase
    this.camera = null;
    this.libs.gphoto2 = null;
    
    this.libs.winston.error(reason + ': re-establishing connection to ' + usbPath);

    this.libs.exec('./usbreset ' + usbPath, function(err, stdout, stderr){

      self.libs.winston.log('stdout: ' + stdout);
      self.libs.winston.log('stderr: ' + stderr);

      if (err !== null) {

        // crash if we can't get going again
        console.log('exec error: ' + err);
        process.exit(1);

      }

      callback();

    });

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

        self.libs.winston.info('Found', self.camera.model);

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

      self.libs.fs.writeFile(imagePath, data, function (err) {

        if (err){

          //resetUsb('error writing data to disk');

        } else {

          var fileSizeInBytes = self.libs.fs.statSync(imagePath)["size"],
              fileSizeInMegabytes = fileSizeInBytes / 1000000.0

          self.libs.winston.info('Size of ' + imageFilename + ': ' + fileSizeInMegabytes + 'mb');

          if(fileSizeInBytes < 100000){
            self.resetUsb('insufficient filesize detected', callback);
            return;
          }

          var imageStream = self.libs.fs.createReadStream(imagePath);

          var s3 = new self.libs.aws.S3({
            params: {
              Bucket: 'bc-timelapse',
              Key: imageProps.bucket + "/" + imageFilename
            }
          });

          s3.upload({ Body: imageStream}, function(err, data) {
            if (err) {
              self.libs.winston.info("Error uploading data: ", err);
            } else {
              // only delete data if we're sure we've uploaded it to s3
              self.libs.fs.unlink(imagePath);
            }
          });

        }

      });

    });

  },

  /**
   * Recursive function which reads a list of exposure times
   * (in ms) and calls for a photo to be taken at each
   *
   * @param nextImage Image properties, must include name & timestamp (ts)
   */

   takeNextPicture: function(nextImage){

      var self = this;

      if(nextImage){

        this.libs.winston.info('taking image ' + nextImage.name + ' (' + nextImage.ts + ')');
        this.takePicture(nextImage);

      }

      if(this.sequence.hasMoreImages()){

        var currentTime = new Date().getTime(),
            nextImage = this.sequence.getNextImage();

        setTimeout(function(){

          // wait (diff now and next exposure) then recurse
          self.takeNextPicture(nextImage);

        }, nextImage.ts - currentTime);

        return;

      }

      this.libs.winston.info('done');

    }

};

module.exports.Timelapse = Timelapse;