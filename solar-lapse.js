var gphoto2 = require('gphoto2');
var GPhoto = new gphoto2.GPhoto2();
var fs = require('fs');

// List cameras / assign list item to variable to use below options
GPhoto.list(function (list) {
  if (list.length === 0) return;
  var camera = list[0];
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
  camera.takePicture({download: true}, function (er, data) {
    fs.writeFileSync(__dirname + '/picture.jpg', data);
  });

});