var fs = require('fs');
var moment = require('moment');

var imagePath = process.argv[2];

console.log('Path to raw images:', imagePath);

var fileNames = fs.readdirSync(imagePath).filter(function(it){ return it.lastIndexOf('.jpg') > -1; });
fileNames.sort();

var lookupTable = {};

fileNames.forEach(function(it){

  var fileNameParsed = /[\D]+(\d+).jpg/.exec(it);
  var dateTaken = moment(new Date(parseInt(fileNameParsed[1], 10)));

  var directoryForImage = dateTaken.format('DDMMMYY').toLowerCase();

  if(!lookupTable[directoryForImage]){
    lookupTable[directoryForImage] = [];
  }

  lookupTable[directoryForImage].push(it);
  var numImages = lookupTable[directoryForImage].length;

  var fullImagePath = imagePath + "/" + directoryForImage;
  var newImageName = fullImagePath + "/" + directoryForImage + "-" + numImages + ".jpg";

  ensureExists(fullImagePath, 0777, function(err) {

    if (err){
      // handle folder creation error
    } else{

      var newImageName = fullImagePath + "/" + directoryForImage + "-" + numImages + ".jpg";

      console.log(newImageName);

      fs.rename(imagePath + "/" + it, newImageName, function(err) {
        if ( err ) console.log('ERROR: ' + err);
      });

    }

  });

});

// https://stackoverflow.com/questions/21194934/node-how-to-create-a-directory-if-doesnt-exist

function ensureExists(path, mask, cb) {
  if (typeof mask == 'function') { // allow the `mask` parameter to be optional
    cb = mask;
    mask = 0777;
  }
  fs.mkdir(path, mask, function(err) {
    if (err) {
      if (err.code == 'EEXIST') cb(null); // ignore the error if the folder already exists
      else cb(err); // something else went wrong
    } else cb(null); // successfully created folder
  });
}