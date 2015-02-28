#!/usr/bin/env node
'use strict';
var meow = require('meow');
var solarLapse = require('./');

var cli = meow({
  help: [
    'Usage',
    '  solar-lapse <input>',
    '',
    'Example',
    '  solar-lapse Unicorn'
  ].join('\n')
});

solarLapse(cli.input[0]);
