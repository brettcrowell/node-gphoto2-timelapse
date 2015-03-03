var gphoto2 = require('gphoto2');
var AWS = require('aws-sdk');
var winston = require('winston');

var begin = new Date().getTime();

winston.add(winston.transports.File, { filename: begin + '.log' });

var GPhoto = new gphoto2.GPhoto2();
var fs = require('fs');

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
  winston.log('Found', camera.model);

  // Take picture with camera object obtained from list()
  var takePicture = function(i){

    camera.takePicture({download: true}, function (er, data) {

      var imageFilename = 'picture' + i + '.jpg',
          imagePath = __dirname + '/output/' + imageFilename;

      fs.writeFile(imagePath, data, function (err) {

        if (err){

          winston.log(err);

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
              winston.log("Error uploading data: ", err);
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

  var takeNextPicture = function(skip){

    if(!skip){
      // need to skip the priming call
      // FIX THIS!!!
      winston.log('taking image ' + nextIndex);
      takePicture(nextIndex);
    } else {
      takePicture('test');
    }

    if(exposures.length > 0){

      var currentTime = new Date().getTime(),
          nextImage;

      while((nextImage = exposures.shift()) < currentTime){
        winston.log('skipping image ' + nextIndex);
        // skip any images that should have already been taken
        nextIndex++;
      }
      nextIndex++;
      setTimeout(takeNextPicture, nextImage - currentTime);
      return;

    }

    winston.log('done');

  }

  takeNextPicture(true);

});