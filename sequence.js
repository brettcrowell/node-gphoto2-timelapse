var winston = require('winston');

/**
 * Creates a list of this.exposures based on custom criteria
 * @param bucket The name of the bucket to place images into
 */

var Sequence = function(exposures){

  // @todo build in ability to run a timed lapse without fancy array
  this.exposures = exposures || [];
  this._sortImages();

};

Sequence.prototype = {

  _byTs: function(a, b) {
    return a.ts - b.ts;
  },

  _futureOnly: function(delay){
    return function(e){
      return e.ts > (new Date().getTime() + delay);
    }
  },

  _sortImages: function(delay){
    delay = delay || 0;
    this.exposures = this.exposures.sort(this._byTs).filter(this._futureOnly(delay));
  },

  addImage: function(image){
    this.exposures.push(image);
    this._sortImages();
  },

  getNextImage: function(delay){

    delay = delay || 0;

    var currentTime = new Date().getTime(),
        nextImage = undefined;

    while(((nextImage = this.exposures.shift()).ts + delay) < currentTime){

      // skip any images that should have already been taken
      winston.info('skipping image ' + nextImage.name + nextImage.ts);

    }

    return nextImage;

  },

  hasMoreImages: function(delay){
    this._sortImages(delay);
    return this.exposures.length > 0;
  }

};

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

function surround(name, bucket, timestamp, frames, msInterval){

  var result = [];

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

module.exports.Sequence = Sequence;
module.exports.surround = surround;