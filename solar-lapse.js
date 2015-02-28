var gphoto2 = require('gphoto2');
var GPhoto = new gphoto2.GPhoto2();
var fs = require('fs');

var camera = null;

// List cameras / assign list item to variable to use below options
GPhoto.list(function (list) {
  if (list.length === 0) return;
  camera = list[0];
  console.log('Found', camera.model);

  // Take picture with camera object obtained from list()
  var takePicture = function(i){
    camera.takePicture({download: true}, function (er, data) {
      fs.writeFileSync(__dirname + '/picture' + i + '.jpg', data);
    });
  };

  // fake two shots
  var exposures = [];
  var nextIndex = 0;

  exposures.push(new Date().getTime() - 1000);
  exposures.push(new Date().getTime() + 1000);
  exposures.push(new Date().getTime() + 10000);
  exposures.push(new Date().getTime() + 30000);

  var takeNextPicture = function(skip){

    if(!skip){
      // need to skip the priming call
      console.log('taking image');
      takePicture(nextIndex);
    }

    if(exposures.length > 0){

      var currentTime = new Date().getTime(),
          nextImage;

      while((nextImage = exposures.shift()) < currentTime){
        console.log('skipping');
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