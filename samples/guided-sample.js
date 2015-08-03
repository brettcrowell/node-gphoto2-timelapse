var tl, seq, winston;

tl = require('../timelapse.js');
seq = require('../sequence.js');
winston = require('winston');

var now = new Date().getTime(),
    myTestSequence = new seq.Sequence();

var params = {

  name: "guided-sample-lapse",

  startTime: now,

  input: {

    // starting at startTime, how long would you like to lapse for (real-time)?

    days: 0,
    hours: 3,
    minutes: 30,
    seconds: 0

  },

  output: {

    // how long would you like your output to be?

    minutes: 0,
    seconds: 45,
    frameRate: 30

  }

};

// calculate lapse properties based on preferences @todo integrate moment.js!
var numFrames = ((params.output.minutes * 60) + params.output.seconds) * params.output.frameRate,
    secondsToLapse = (params.input.days * 24 * 60 * 60) + (params.input.hours * 60 * 60) + (params.input.minutes * 60) + params.input.seconds,
    frameInterval = parseInt(secondsToLapse / numFrames, 10);

if(frameInterval < 10){
  winston.warn("some cameras/configurations may have trouble capturing more frequently than every 10 seconds.  be careful!")
}

for(var i = 0; i < numFrames; i++){
  myTestSequence.addImage({

    name: params.name,
    ts: params.startTime + (i * (frameInterval * 1000))

  });
}

new tl.Timelapse(myTestSequence);
