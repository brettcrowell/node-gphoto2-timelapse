The classes found in this package allow users to run clock-time based timelapses using Node.JS, gPhoto2, and optionally SunCalc & AWS.  This project was designed specifically to run headless on a Raspberry Pi, using Forever.

## Install

This package relies heavily on external software.  Below you'll find a crash course to get your Pi up and running.  Most other machines should come up by following similar steps.

1) Install gPhoto2 using the gPhoto2 Updater (https://github.com/gonzalo/gphoto2-updater)

```sh
$ wget https://raw.githubusercontent.com/gonzalo/gphoto2-updater/master/gphoto2-updater.sh && chmod +x gphoto2-updater.sh && sudo ./gphoto2-updater.sh
```

2) Install Node.JS.  Note that on the Pi, we must use an ARM distribution (http://node-arm.herokuapp.com/) and for node-gphoto2, we must be using Node 10...

```sh
wget http://node-arm.herokuapp.com/node_0.10.35_armhf.deb
sudo dpkg -i node_0.10.35_armhf.deb
```
_Non Raspberry Pi users may want to consider using NVM to maintain multiple versions of Node.  More information can be found at https://github.com/creationix/nvm_

3) Install node-gyp to ease the installation of node-gphoto2...

```sh
sudo npm install -g node-gyp
```

4) Install node-gphoto2 globally...

```sh
sudo npm install -g gphoto2
```

5) Install forever globally...

```sh
sudo npm install -g forever
```

6) And finally, install this package...

```sh
$ npm install --global solar-lapse
```

## Usage

As mentioned above, this package allows you to create timelapses based on clock-time.  This is facilitated by two main classes, Sequence and Timelapse.  Getting started is quite simple...

```js

// take 30 exposures, one every 30 seconds, starting immediatey
var tl = require('solar-lapse');
var exposureTimes = [];

var now = new Date().getTime();
for(var i = 0; i < 30; i++){
  exposureTimes.push(now + (i * 30000));
}

new tl.Timelapse(exposureTimes);

```

For a more complicated lapse based on sun position, check out the sample code.

## License

MIT © [Brett Crowell]()


[npm-url]: https://npmjs.org/package/solar-lapse
[npm-image]: https://badge.fury.io/js/solar-lapse.svg
[daviddm-url]: https://david-dm.org/brettcrowell/solar-lapse.svg?theme=shields.io
[daviddm-image]: https://david-dm.org/brettcrowell/solar-lapse
