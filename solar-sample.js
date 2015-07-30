var suncalc, tl, seq;

tl = require('./timelapse.js');
seq = require('./sequence.js');

var now = new Date().getTime(),
    exposures = [];

// take 30 exposures, one every 30 seconds, starting immediatey

for(var i = 0; i < 30; i++){
  exposureTimes.push({
    name: 'test-lapse',
    now + (i * 30000)
  });
}

var myTestSequence = new seq.Sequence(exposures);

new tl.Timelapse(myTestSequence);
