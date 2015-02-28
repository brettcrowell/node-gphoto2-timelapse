var gphoto2 = require('gphoto2');
var GPhoto = new gphoto2.GPhoto2();
var fs = require('fs');

var camera = null;

// List cameras / assign list item to variable to use below options
GPhoto.list(function (list) {
  if (list.length === 0) return;
  camera = list[0];
  console.log('Found', camera.model);

  // get configuration tree
  camera.getConfig(function (er, settings) {
    console.log(settings);
  });

  // Set configuration values
  camera.setConfigValue('main.children.capturesettings.children.focallength.value', 105, function (er) {
    //...
  });

  // Take picture with camera object obtained from list()
  var takePicture = function(i){
    camera.takePicture({download: true}, function (er, data) {
      fs.writeFileSync(__dirname + '/picture' + i + '.jpg', data);
    });
  };

  // fake two shots
  var exposures = [];

  exposures.push(new Date().getTime() + 1000);
  exposures.push(new Date().getTime() + 3000);

  var takeNextPicture = function(skip){

    if(!skip){
      // need to skip the priming call
      takePicture(exposures.length);
    }

    if(exposures.length > 0){
      setTimeout(takeNextPicture, exposures.shift());
      return;
    }

    console.log('done');

  }

  takeNextPicture(true);

});