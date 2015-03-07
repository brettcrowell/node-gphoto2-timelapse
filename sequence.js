var suncalc = require('suncalc');

/**
 * Creates a list of this.exposures based on custom criteria
 * @param bucket The name of the bucket to place images into
 * @returns {Array}
 */

var Sequence = function(bucket){

  this.exposures = [];

  var now = new Date().getTime();

  // shoot a second at startup, just in case that's all we get
  this.exposures = this.exposures.concat(this._surround('startup', bucket, now, 30, 12000));

  // sunrise lapse
  var epoch  = 1425380400000;

  for(var i = 0; i < 120; i++){

    // take a photo at 6am each day
    var todayAtSixAm = epoch + (i * 86400000);

    var todayAtNineAm = todayAtSixAm + 10800000;

    this.exposures = this.exposures.concat(this._surround('morning', bucket, todayAtNineAm, 30, 12000));

    var todayAtNoon = todayAtSixAm + 23400000;

    this.exposures = this.exposures.concat(this._surround('noon', bucket, todayAtNoon, 30, 12000));

    var todayAtSixThirtyPm = todayAtNoon + 23400000;

    this.exposures = this.exposures.concat(this._surround('evening', bucket, todayAtSixThirtyPm, 30, 12000));

    // take a photo at solar noon each day
    var today = new Date(todayAtSixAm);

    // sun positions
    var sc = suncalc.getTimes(today, 42.3601, -71.0589);

    // sunrise lapse
    this.exposures = this.exposures.concat(this._surround('sunrise', bucket, sc.sunrise.getTime(), 30, 12000));

    // golden hour lapse
    this.exposures = this.exposures.concat(this._surround('goldenHour', bucket, sc.goldenHour, 30, 12000));


  }

  /*var timespan = 60, //minutes
   realSeconds = timespan * 60,
   outputSeconds = 30,
   frames = outputSeconds * 30,
   intervalSeconds = realSeconds / frames,
   intervalMs = intervalSeconds * 1000;

   for(var i = 0; i < 60; i++){
   this.exposures.push(begin + (i * 60000));
   }
   */

  this.exposures = this.exposures.sort(function(a, b) {
    return a.ts - b.ts;
  });

  this.exposures = this.exposures.filter(function(e){
    return e.ts > now;
  });

}

Sequence.prototype = {

  getNextImage: function(){

    var currentTime = new Date().getTime(),
        nextImage = null;

    while((nextImage = this.exposures.shift()).ts < currentTime){

      // skip any images that should have already been taken
      winston.info('skipping image ' + nextImage.name + nextImage.ts);

    }

    return nextImage;

  },

  hasMoreImages: function(){
    return this.exposures.length > 0;
  },

  /**
   * Takes in a timestamp (+ other metadata), a number of frames,
   * and a capture interval, and evenly distributes this.exposures around
   * the timestamp
   *
   * @param name  The name for this group of this.exposures
   * @param bucket  The S3 bucket the this.exposures should be placed into
   * @param timestamp The central timestamp for this exposure group
   * @param frames  The number of frames to encode
   * @param msInterval  The requested delay between frames
   * @returns {Array}
   */

  _surround: function(name, bucket, timestamp, frames, msInterval){
  
    var result = [];
  
    var now = new Date().getTime();
  
    var msPreset = timestamp - ((frames / 2) * msInterval);
  
    for(var i = 0; i < frames; i++){
      result.push({
        name: name,
        bucket: bucket,
        ts: msPreset + (msInterval * i)
      });
    }
  
    return result;
  
  }

};

module.exports.Sequence = Sequence;