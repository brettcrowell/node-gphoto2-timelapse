var tl, seq, suncalc, winston;


tl = require('../timelapse.js');
seq = require('../sequence.js');
suncalc = require('suncalc');
winston = require('winston');

var lapseName = "goldenDomeDaily";
var awsBucketName = lapseName + new Date().getTime();

var numDays = 7;
var outputMinutes = 1;
var outputFPS = 30;

var epoch = new Date("2016-8-18").getTime();
var myTestSequence = new seq.Sequence();

for(var i = 0; i < numDays; i++) {

  // 86400000 is # milliseconds in a day
  buildTimelapseDay(new Date(epoch + (i * 86400000)), myTestSequence);

}

myTestSequence.addImage({

  name: 'test-image',
  bucket: awsBucketName,
  ts: new Date().getTime() + 1000

});

function buildTimelapseDay(date, sequence){

  var times = suncalc.getTimes(date, 42.3601, -71.0589);

  var dawn = times.nauticalDawn.getTime();
  var dusk = times.nauticalDusk.getTime();

  // calculate lapse properties based on preferences @todo integrate moment.js!
  var numFrames = (outputMinutes * 60) * outputFPS,
      secondsToLapse = (dusk - dawn) / 1000,
      frameInterval = parseInt(secondsToLapse / numFrames, 10);

  winston.info("frame interval calculated at " + frameInterval + "s for day");

  if(frameInterval < 10){
    winston.warn("some cameras/configurations may have trouble capturing more frequently than every 10 seconds.  be careful!")
  }

  for(var i = 0; i < numFrames; i++){
    sequence.addImage({

      name: lapseName,
      bucket: awsBucketName,
      ts: dawn + (i * (frameInterval * 1000))

    });
  }

}

new tl.Timelapse(myTestSequence);
