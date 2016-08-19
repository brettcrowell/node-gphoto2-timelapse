var tl = require('../timelapse.js');
var seq = require('../sequence.js');

var now = new Date().getTime(),
    myTestSequence = new seq.Sequence();

// take 30 exposures, one every 30 seconds, starting immediatey

for(var i = 0; i < 2700; i++){
  myTestSequence.addImage({
    name: 'goldenDome',
    bucket: 'goldenDome' + now,
    ts: now + (i * 32000)
  });
}

new tl.Timelapse(myTestSequence);
