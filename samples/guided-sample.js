var tl, seq, suncalc, winston;


tl = require('../timelapse.js');
seq = require('../sequence.js');
suncalc = require('suncalc');
winston = require('winston');

var now = new Date().getTime();
var myTestSequence = new seq.Sequence();

/*
  using the suncalc library to calculate a full day lapse in boston tomorrow.
  ignore this if you'd rather start immediately!
 */

var solarDate = new Date("2016-8-18");

var times = suncalc.getTimes(solarDate, 42.3601, -71.0589);

var dawn = times.nauticalDawn.getTime();
var dusk = times.nauticalDusk.getTime();
var duration = (dusk - dawn) / 1000;

/*
  end of solar lapse calculations
 */

var params = {

  name: "guided-sample-lapse",

  input: {

    // starting at startTime, how long would you like to lapse for (real-time)?

    days: 0,
    hours: 0,
    minutes: 0,
    seconds: duration

  },

  output: {

    // how long would you like your output to be?

    minutes: 0,
    seconds: 60,
    frameRate: 30

  }

};

var startTime = dawn;

// calculate lapse properties based on preferences @todo integrate moment.js!
var numFrames = ((params.output.minutes * 60) + params.output.seconds) * params.output.frameRate,
    secondsToLapse = (params.input.days * 24 * 60 * 60) + (params.input.hours * 60 * 60) + (params.input.minutes * 60) + params.input.seconds,
    frameInterval = parseInt(secondsToLapse / numFrames, 10);

winston.info("frame interval calculated at " + frameInterval + "s");

if(frameInterval < 10){
  winston.warn("some cameras/configurations may have trouble capturing more frequently than every 10 seconds.  be careful!")
}

for(var i = 0; i < numFrames; i++){
  myTestSequence.addImage({

    name: params.name,
    ts: startTime + (i * (frameInterval * 1000))

  });
}

myTestSequence.addImage({

  name: 'test-image',
  ts: new Date().getTime() + 1000

});

new tl.Timelapse(myTestSequence);
