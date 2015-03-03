var gphoto2 = require('gphoto2'),
    AWS = require('aws-sdk'),
    fs = require('fs'),
    winston = require('winston'),
    suncalc = require('suncalc');

var begin = new Date().getTime();

if (!fs.existsSync('logs')){
  fs.mkdirSync('logs');
}

winston.add(winston.transports.File, { filename: 'logs/' + begin + '.log' });

winston.info('solar lapse is up and running at ' + begin);

var GPhoto = new gphoto2.GPhoto2();

var camera = null;

function surround(name, timestamp, frames, msInterval){

  var result = [];

  var msPreset = timestamp - ((frames / 2) * msInterval);

  for(var i = 0; i < frames; i++){
    result.push({
      name: name,
      ts: msPreset + (msInterval * i)
    });
  }

  return result;

}

function getExposures(){

  var exposures = [];

  // shoot a second at startup, just in case that's all we get
  exposures = exposures.concat(surround('startup', begin, 60, 12000));

  // sunrise lapse
  var epoch  = 1425380400000;

  for(var i = 0; i < 120; i++){

    // take a photo at 6am each day
    var todayAtSixAm = epoch + (i * 86400000);
    exposures = exposures.concat(surround('morning', todayAtSixAm, 30, 12000));

    // take a photo at solar noon each day
    var today = new Date(todayAtSixAm);

    // sun positions
    suncalc.getTimes(today, 42.3601, 71.0589);

    // solar noon lapse
    exposures = exposures.concat(surround('solarNoon', suncalc.solarNoon, 30, 12000));

    // golden hour lapse
    exposures = exposures.concat(surround('goldenHour', suncalc.goldenHour, 30, 12000));


  }

  /*var timespan = 60, //minutes
      realSeconds = timespan * 60,
      outputSeconds = 30,
      frames = outputSeconds * 30,
      intervalSeconds = realSeconds / frames,
      intervalMs = intervalSeconds * 1000;

  for(var i = 0; i < 60; i++){
    exposures.push(begin + (i * 60000));
  }
  */

  exposures.sort(function(a, b) {
    return a - b;
  });

  return exposures;

}

/**
 * Something bad happened.  Reboot the pi,
 * no questions asked (hackers gonna hack)
 */

function reboot(reason){
  winston.error(reason + ': rebooting');
  require('reboot').reboot();
}

// List cameras / assign list item to variable to use below options
GPhoto.list(function (list) {

  if (list.length === 0){
    // no cameras found?  not buying it.
    winston.error('no cameras found');
    return;
  };

  camera = list[0];

  winston.info('Found', camera.model);

  /**
   * Use node-gphoto2 to capture an image from the active camera
   * and upload to Amazon S3
   *
   * @param i The index of the photo, unique to session.
   */
  var takePicture = function(imageProps){

    camera.takePicture({download: true}, function (er, data) {

      var imageFilename = imageProps.name + imageProps.ts + '.jpg',
          imageDirectory = __dirname + '/output',
          imagePath = imageDirectory + '/' + imageFilename;

      if (!fs.existsSync(imageDirectory)){
        fs.mkdirSync(imageDirectory);
      }

      fs.writeFile(imagePath, data, function (err) {

        if (err){

          //reboot('error writing data to disk');

        } else {

          var fileSizeInBytes = fs.statSync(imagePath)["size"],
              fileSizeInMegabytes = fileSizeInBytes / 1000000.0

          winston.info('Size of ' + imageFilename + ': ' + fileSizeInMegabytes + 'mb');

          if(fileSizeInBytes < 100000){
            winston.error('insufficient filesize detected');
          }

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
              // only delete data if we're sure we've uploaded it to s3
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

  var takeNextPicture = function(nextImage, skip){

    if(!skip){
      winston.info('taking image ' + nextIndex);
      takePicture(nextImage);
    }

    if(exposures.length > 0){

      var currentTime = new Date().getTime(),
          nextImage;

      while((nextImage = exposures.shift()) < currentTime){
        winston.info('skipping image ' + nextIndex);
        // skip any images that should have already been taken
      }

      setTimeout(function(){
        takeNextPicture(nextImage);
      }, nextImage.ts - currentTime);

      return;

    }

    winston.info('done');

  }

  takeNextPicture({ name: 'test', ts: begin });

});