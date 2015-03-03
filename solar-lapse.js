var gphoto2 = require('gphoto2'),
    AWS = require('aws-sdk'),
    fs = require('fs'),
    winston = require('winston');

var begin = new Date().getTime();

if (!fs.existsSync('logs')){
  fs.mkdirSync('logs');
}

winston.add(winston.transports.File, { filename: 'logs/' + begin + '.log' });

winston.info('solar lapse is up and running at ' + begin);

var GPhoto = new gphoto2.GPhoto2();

var camera = null;

function surround(timestamp, frames, msInterval){

  var result = [];

  var msPreset = timestamp - ((frames / 2) * msInterval);

  for(var i = 0; i < frames; i++){
    result.push(msPreset + (msInterval * i));
  }

  return result;

}

function getExposures(){

  var exposures = [];

  /*var timespan = 60, //minutes
      realSeconds = timespan * 60,
      outputSeconds = 30,
      frames = outputSeconds * 30,
      intervalSeconds = realSeconds / frames,
      intervalMs = intervalSeconds * 1000;

  for(var i = 0; i < 60; i++){
    exposures.push(begin + (i * 60000));
  }

  exposures.sort(function(a, b) {
    return a - b;
  });

  return exposures;
   */

  return surround(begin + 120000, 10, 10000);

}

// List cameras / assign list item to variable to use below options
GPhoto.list(function (list) {
  if (list.length === 0) return;
  camera = list[0];
  winston.info('Found', camera.model);

  /**
   * Use node-gphoto2 to capture an image from the active camera
   * and upload to Amazon S3
   *
   * @param i The index of the photo, unique to session.
   */
  var takePicture = function(i){

    camera.takePicture({download: true}, function (er, data) {

      var imageFilename = 'picture' + i + '.jpg',
          imageDirectory = __dirname + '/output',
          imagePath = imageDirectory + '/' + imageFilename;

      if (!fs.existsSync(imageDirectory)){
        fs.mkdirSync(imageDirectory);
      }

      fs.writeFile(imagePath, data, function (err) {

        if (err){

          winston.info(err);

        } else {

          var imageStream = fs.createReadStream(imagePath);

          var s3 = new AWS.S3({
            params: {
              Bucket: 'bc-timelapse',
              Key: begin + "/" + imageFilename
            }
          });

          s3.upload({ Body: imageStream}, function(err, data) {
            if (err) {
              winston.info("Error uploading data: ", err);
            } else {
              fs.unlink(imagePath);
            }
          });

        }

      });

    });

  };

  // fake two shots
  var exposures = getExposures();
  var nextIndex = 0;

  /**
   * Recursive function which reads a list of exposure times
   * (in ms) and calls for a photo to be taken at each
   *
   * @param skip Function must be 'primed'
   */

  var takeNextPicture = function(skip){

    if(!skip){
      // need to skip the priming call
      // FIX THIS!!!
      winston.info('taking image ' + nextIndex);
      takePicture(nextIndex);
    } else {
      takePicture('test');
    }

    if(exposures.length > 0){

      var currentTime = new Date().getTime(),
          nextImage;

      while((nextImage = exposures.shift()) < currentTime){
        winston.info('skipping image ' + nextIndex);
        // skip any images that should have already been taken
        nextIndex++;
      }
      nextIndex++;
      setTimeout(takeNextPicture, nextImage - currentTime);
      return;

    }

    winston.info('done');

  }

  takeNextPicture(true);

});