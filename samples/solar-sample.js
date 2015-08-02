var suncalc, tl, seq;

suncalc = require('suncalc');
tl = require('../timelapse.js');
seq = require('../sequence.js');

/*
  Create a custom timelapse which runs for n days, taking photos at
  sunrise, 9am, 12:30pm, golden hour, and 6:30pm
 */

var now = bucket = new Date().getTime(),
    exposures = [];

// shoot 0.5 seconds at startup, just in case that's all we get
exposures = exposures.concat(seq.surround('startup', bucket, now, 30, 12000));

// sunrise lapse
var epoch  = 1425380400000, // 3/3/15 @ 6:00am Boston time
    numDays = 400;

for(var i = 0; i < numDays; i++){

  // we need a reference for today's unix time, so lets just use 6am
  var todayAtSixAm = epoch + (i * 86400000);

  /*

    hard-coded lapses are simple.  just calculate the difference between 6am and each
    required time, and add.

    note: surround is a function defined by Sequence.js which 'surrounds' a given timestamp
          with the desired number of exposures at that moment.

   */

  var todayAtNineAm = todayAtSixAm + 10800000;
  exposures = exposures.concat(seq.surround('morning', bucket, todayAtNineAm, 30, 12000));

  var todayAtNoon = todayAtSixAm + 23400000;
  exposures = exposures.concat(seq.surround('noon', bucket, todayAtNoon, 30, 12000));

  var todayAtSixThirtyPm = todayAtNoon + 23400000;
  exposures = exposures.concat(seq.surround('evening', bucket, todayAtSixThirtyPm, 30, 12000));

  /*
    now use the impressive SunCalc library to add 'special' lapses at sunrise and goldenHour.
    We'll need a JavaScript date reference to do this, so generate one based on our 6am benchmark.
   */

  var today = new Date(todayAtSixAm);

  // sun positions as calculated by suncalc for Boston, MA
  var sc = suncalc.getTimes(today, 42.3601, -71.0589);

  // sunrise lapse
  exposures = exposures.concat(seq.surround('sunrise', bucket, sc.sunrise.getTime(), 30, 12000));

  // golden hour lapse
  exposures = exposures.concat(seq.surround('goldenHour', bucket, sc.goldenHour, 30, 12000));

}

/*
  Preparations are done, now run a timelapse!
 */

new tl.Timelapse(exposures);