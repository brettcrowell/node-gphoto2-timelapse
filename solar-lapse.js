var gphoto2, aws, fs, winston;

// prepare global requirements
aws = require('aws-sdk');
fs = require('fs');
winston = require('winston');

/**
 *
 * @param name
 * @param timestamp
 * @param frames
 * @param msInterval
 * @returns {Array}
 */

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

/**
 *
 * @param begin
 * @returns {Array}
 */

function getExposures(begin){

  var exposures = [];

  // shoot a second at startup, just in case that's all we get
  exposures = exposures.concat(surround('startup', begin, 30, 12000));

  // sunrise lapse
  var epoch  = 1425380400000;

  for(var i = 0; i < 120; i++){

    // take a photo at 6am each day
    var todayAtSixAm = epoch + (i * 86400000);

    exposures = exposures.concat(surround('sunrise', todayAtSixAm, 30, 12000));

    var todayAtNineAm = todayAtSixAm + 10800000;

    exposures = exposures.concat(surround('morning', todayAtNineAm, 30, 12000));

    var todayAtNoon = todayAtSixAm + 23400000;

    exposures = exposures.concat(surround('noon', todayAtNoon, 30, 12000));

    var todayAtSixThirtyPm = todayAtNoon + 23400000;

    exposures = exposures.concat(surround('evening', todayAtSixThirtyPm, 30, 12000));

    // take a photo at solar noon each day
    //var today = new Date(todayAtSixAm);

    // sun positions
    //var sc = suncalc.getTimes(today, 42.3601, 71.0589);

    // solar noon lapse
    //exposures = exposures.concat(surround('solarNoon', sc.solarNoon, 30, 12000));

    // golden hour lapse
    //exposures = exposures.concat(surround('goldenHour', sc.goldenHour, 30, 12000));


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

  exposures = exposures.sort(function(a, b) {
    return a.ts - b.ts;
  });

  exposures = exposures.filter(function(e){
    return e.ts > begin;
  });

  return exposures;

}

/**
 * Something bad happened.  Ask the operating system to
 * reset all USB connections to see if we can fix it.
 */

function resetUsb(reason){
  camera = null;
  gphoto2 = null;
  winston.error(reason + ': rebooting');
}

/**
 * Use node-gphoto2 to capture an image from the active camera
 * and upload to Amazon S3
 *
 * @param camera  An instance of a GPhoto2 camera
 * @param bucket  The name of the AWS-S3 bucket this image should be uploaded to
 * @param imageProps Image metadata including name and timestamp (ts)
 */

function takePicture(camera, bucket, imageProps){

  // keep a callback in case something goes wrong
  var callback = function(){
    takePicture(camera, imageProps);
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

var takeNextPicture = function(camera, nextImage){

  winston.info('taking image ' + nextImage.name + ' (' + nextImage.ts + ')');

  takePicture(camera, nextImage);

  if(exposures.length > 0){

    var currentTime = new Date().getTime(),
        nextImage;

    while((nextImage = exposures.shift()).ts < currentTime){
      winston.info('skipping image ' + nextImage.name + nextImage.ts);
      // skip any images that should have already been taken
    }

    setTimeout(function(){
      takeNextPicture(camera, nextImage);
    }, nextImage.ts - currentTime);

    return;

  }

  winston.info('done');

}

// 'local' variables
var begin, camera, exposures;

begin = new Date().getTime();

if (!fs.existsSync('logs')){
  fs.mkdirSync('logs');
}

winston.add(winston.transports.File, { filename: 'logs/' + begin + '.log' });

winston.info('solar lapse is up and running at ' + begin);

// fake two shots
exposures = getExposures(begin);

takeNextPicture(camera, { name: 'test', bucket: begin, ts: begin });