var gphoto2 = require('gphoto2');
var AWS = require('aws-sdk');

var GPhoto = new gphoto2.GPhoto2();
var fs = require('fs');

var camera = null;

var begin = new Date().getTime();

function getExposures(){

  var exposures = [];

  /*var timespan = 60, //minutes
      realSeconds = timespan * 60,
      outputSeconds = 30,
      frames = outputSeconds * 30,
      intervalSeconds = realSeconds / frames,
      intervalMs = intervalSeconds * 1000;*/

  for(var i = 0; i < 60; i++){
    exposures.push(begin + (i * 30000));
  }

  exposures.sort(function(a, b) {
    return a - b;
  });

  return exposures;

}

// List cameras / assign list item to variable to use below options
GPhoto.list(function (list) {
  if (list.length === 0) return;
  camera = list[0];
  console.log('Found', camera.model);

  // Take picture with camera object obtained from list()
  var takePicture = function(i){

    camera.takePicture({download: true}, function (er, data) {

      var imageFilename = 'picture' + i + '.jpg',
          imagePath = __dirname + '/output/' + imageFilename;

      fs.writeFileSync(imagePath, data);

      var imageStream = fs.createReadStream(imagePath);

      var s3 = new AWS.S3({
        params: {
          Bucket: 'bc-timelapse',
          Key: begin + "/" + imageFilename
        }
      });

      s3.upload({ Body: imageStream}, function(err, data) {
        if (err) {
          console.log("Error uploading data: ", err);
        } else {
          fs.unlink(imagePath);
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
      console.log('taking image ' + nextIndex);
      takePicture(nextIndex);
    }

    if(exposures.length > 0){

      var currentTime = new Date().getTime(),
          nextImage;

      while((nextImage = exposures.shift()) < currentTime){
        console.log('skipping image ' + nextIndex);
        // skip any images that should have already been taken
        nextIndex++;
      }
      nextIndex++;
      setTimeout(takeNextPicture, nextImage - currentTime);
      return;

    }

    console.log('done');

  }

  takeNextPicture(true);

});