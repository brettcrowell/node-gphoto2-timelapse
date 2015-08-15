The classes found in this package allow users to run clock-time based timelapses using Node.JS, gPhoto2, and optionally SunCalc & AWS.  This project was designed specifically to run headless on a Raspberry Pi, using Forever.

#### Sample Videos

Check out this [YouTube Channel](https://www.youtube.com/playlist?list=PLcadkFhxgoIj8_AKHufKrx85mjtlHP8Cb) to view videos created using this codebase.

## Basic Installation

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

3) Clone this repo...

```sh
$ git clone git@github.com:brettcrowell/node-gphoto2-timelapse.git
```

4) Install Node dependencies...

```sh
$ cd node-gphoto2-timelapse
$ npm install
```

### USB Reset Script

During the course of a long-running capture, gPhoto2 may lose its connection to the camera.  If this situation is detected, `node-gphoto2-timelapse` will execute a script which resets the USB port the camera is connected to.

In order for this all to work, that script (`usbreset.c`) must be compiled using `gcc` before running the app...

```
$ gcc -o usbreset usbreset.c
```

## Usage

As mentioned above, this package allows you to create timelapses based on clock-time.  This is facilitated by two main classes, Sequence and Timelapse.

A `Sequence` is a specialized queue whose elements are exposure times, represented as Objects containing UTC timestamps and metadata such as a filename prefix and S3 Bucket (if applicable).  A sample object follows...

```
{
  name: 'sunrise',
  bucket: 'bcrowell-timelapse',
  ts: 1425380400000
}
```

_Note: If `bucket` is omitted, no attempt will be made to upload to S3, and images will be stored in the `./output` directory_

`Sequence` exposes two methods to its consumer, `getNextImage` and `hasMoreImages`.  Unlike a queue, `getNextImage` won't necessarialy return the object on top of the stack, but rather the next image whose timestamp is in the future.  If a sequence contains many exposures with timestamps that have passed, it will skip them.  This becomes extremely helpful in situations where a long-running capture might be interrupted.

When a `Timelapse` is created, a `Sequence` must be passed in.  `Timelapse` will then handle connecting to the camera, capturing each image at the correct time, downloading it from the camera, and saving or uploading to Amazon S3.

```js
var tl = require('../timelapse.js');
var seq = require('../sequence.js');

var now = new Date().getTime();
var myTestSequence = new seq.Sequence();

// take 30 exposures, one every 30 seconds, starting immediatey

for(var i = 0; i < 30; i++){
  myTestSequence.addImage({
    name: 'test-lapse',
    ts: now + (i * 30000)
  });
}

new tl.Timelapse(myTestSequence);
```

To run the example above, assuming it is in a file called `simple-sample.js`, simply point node there...

```
$ node ./samples/simple-sample.js
```

For longer running lapses, it can be very useful to install and use `forever`...

```
$ npm install -g forever
$ forever ./samples/simple-sample.js
```
_More information on `forever` can be found at https://github.com/foreverjs/forever_

For a more complicated lapse based on sun position, check out `solar-sample.js`

## Tips and Tricks

- On Ubuntu, cameras must be *unmounted* in order to be reserved for `node-gphoto2-timelapse`

## License

MIT © [Brett Crowell]()


[npm-url]: https://npmjs.org/package/solar-lapse
[npm-image]: https://badge.fury.io/js/solar-lapse.svg
[daviddm-url]: https://david-dm.org/brettcrowell/solar-lapse.svg?theme=shields.io
[daviddm-image]: https://david-dm.org/brettcrowell/solar-lapse
