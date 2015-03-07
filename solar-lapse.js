var gphoto2, aws, fs, usb, winston, simplex;

// prepare global requirements
aws = require('aws-sdk');
fs = require('fs');
winston = require('winston');
simplex = require('./clock.js');

/**
 * Something bad happened.  Ask the operating system to
 * reset all USB connections to see if we can fix it.
 */

function resetUsb(reason, callback){
  camera = null;
  gphoto2 = null;
  winston.error(reason + ': rebooting');

  usb = require('usb');

  var c = usb.findByIds(1200, 810);

  if(c){

    // try to reset the usb connection
    c.open();
    c.reset(callback);

  } else {

    // crash if we can't get going again
    process.exit(1);

  }

}

/**
 * Use node-gphoto2 to capture an image from the active camera
 * and upload to Amazon S3
 *
 * @param camera  An instance of a GPhoto2 camera
 * @param imageProps Image metadata including name and timestamp (ts)
 */

function takePicture(imageProps){

  // keep a callback in case something goes wrong
  var callback = function(){
    takePicture(imageProps);
  };

  if(!camera){

    gphoto2 = require('gphoto2');
    var GPhoto = new gphoto2.GPhoto2();

    // List cameras / assign list item to variable to use below options
    GPhoto.list(function (list) {

      if (list.length === 0) {
        // no cameras found?  not buying it.
        resetUsb('no cameras found', callback);
        return;
      }

      camera = list[0];

      winston.info('Found', camera.model);

      // take the picture as a callback
      callback();

    });

    return;

  }

  camera.takePicture({download: true}, function (er, data) {

    var imageFilename = imageProps.name + imageProps.ts + '.jpg',
        imageDirectory = __dirname + '/output',
        imagePath = imageDirectory + '/' + imageFilename;

    if (!fs.existsSync(imageDirectory)){
      fs.mkdirSync(imageDirectory);
    }

    fs.writeFile(imagePath, data, function (err) {

      if (err){

        //resetUsb('error writing data to disk');

      } else {

        var fileSizeInBytes = fs.statSync(imagePath)["size"],
            fileSizeInMegabytes = fileSizeInBytes / 1000000.0

        winston.info('Size of ' + imageFilename + ': ' + fileSizeInMegabytes + 'mb');

        if(fileSizeInBytes < 100000){
          resetUsb('insufficient filesize detected', callback);
        }

        var imageStream = fs.createReadStream(imagePath);

        var s3 = new aws.S3({
          params: {
            Bucket: 'bc-timelapse',
            Key: imageProps.bucket + "/" + imageFilename
          }
        });

        s3.upload({ Body: imageStream}, function(err, data) {
          if (err) {
            winston.info("Error uploading data: ", err);
          } else {
            // only delete data if we're sure we've uploaded it to s3
            fs.unlink(imagePath);
          }
        });

      }

    });

  });

};

/**
 * Recursive function which reads a list of exposure times
 * (in ms) and calls for a photo to be taken at each
 *
 * @param nextImage Image properties, must include name & timestamp (ts)
 */

var takeNextPicture = function(nextImage){

  winston.info('taking image ' + nextImage.name + ' (' + nextImage.ts + ')');

  takePicture(nextImage);

  if(exposures.hasMoreImages()){

    var currentTime = new Date().getTime(),
        nextImage = exposures.getNextImage();

    setTimeout(function(){
      takeNextPicture(nextImage);
    }, nextImage.ts - currentTime);

    return;

  }

  winston.info('done');

}

// 'local' variables
var camera, exposures;

var now = new Date().getTime();

if (!fs.existsSync('logs')){
  fs.mkdirSync('logs');
}

winston.add(winston.transports.File, { filename: 'logs/' + now + '.log' });

winston.info('solar lapse is up and running at ' + now);

// fake two shots
exposures = new simplex.Clock(now);

takeNextPicture({ name: 'test', bucket: now, ts: now });