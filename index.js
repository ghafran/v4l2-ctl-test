var _ = require('lodash'),
    promise = require('bluebird'),
    shelljs = require('shelljs');

class ptz {

    static runShell(command) {
        return new promise((resolve, reject) => {
            shelljs.exec(command, {
                silent: true
            }, (code, stdout, stderr) => {
                if (stderr) {
                    reject(new Error(stderr));
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    static discover() {
        return ptz.runShell(`v4l2-ctl --list-devices`).then((result) => {
            /*
            result will look like this:
            Camera 123 (usb-0000:00:14.0-1):
            /dev/video0

            Camera 456 (usb-0000:00:14.0-2):
            /dev/video1

            */
            result = result.replace(/\t/g, '');
            var devices = [];
            var lines = result.split('\n');
            var state = false;
            var name;
            _.each(lines, (line) => {
                if (line.indexOf('usb-') > -1) {
                    name = line;
                    state = true;
                } else if (line.indexOf('/dev/video') > -1) {
                    if (state) {
                        devices.push({
                            name: name,
                            path: line
                        });
                        state = false;
                    }
                } else {
                    state = false;
                }
            });
            return devices;
        });
    }

    static getCamera() {
        return ptz.discover().then(devices => {
            if (devices.length === 0) {
                return promise.resolve();
            } else {
                var ptzDevice = devices[0];
                return promise.resolve(ptzDevice);
            }
        });
    }

    static getCapabilities(camera) {

        return ptz.runShell(`v4l2-ctl --device=${camera.path} --list-ctrls`).then((result) => {
            /*
        result will look like this:
                 brightness (int)    : min=0 max=14 step=1 default=6 value=6
                   contrast (int)    : min=0 max=14 step=1 default=8 value=8
                 saturation (int)    : min=60 max=200 step=10 default=110 value=110
                        hue (int)    : min=0 max=14 step=1 default=7 value=7
                      gamma (int)    : min=0 max=63 step=1 default=0 value=0
       power_line_frequency (menu)   : min=0 max=2 default=1 value=2
                  sharpness (int)    : min=0 max=15 step=1 default=4 value=4
     backlight_compensation (int)    : min=0 max=1 step=1 default=0 value=0
               pan_absolute (int)    : min=-612000 max=612000 step=3600 default=0 value=0
              tilt_absolute (int)    : min=-108000 max=324000 step=3600 default=0 value=0
             focus_absolute (int)    : min=0 max=3900 step=1 default=1675 value=1607 flags=inactive
                 focus_auto (bool)   : default=1 value=1
              zoom_absolute (int)    : min=0 max=16384 step=1 default=0 value=0
            zoom_continuous (int)    : min=0 max=7 step=1 default=6 value=0 flags=write-only
                  pan_speed (int)    : min=0 max=24 step=1 default=15 value=0
                 tilt_speed (int)    : min=0 max=20 step=1 default=15 value=0
        */
            result = result.replace(/\t/g, '');
            var ret = {
                absolutePanTilt: false,
                absoluteZoomRange: false,
                relativePanTilt: false,
                relativeZoom: false
            };
            var attr, data, params;
            var lines = result.split(/\n/);
            _.each(lines, (line) => {
                if (line.indexOf(':') > -1) {
                    if (line.indexOf('pan_absolute') > -1) {
                        attr = 'pan_absolute';
                        data = line.split(':')[1].trim().replace(/ /g, ';');
                        params = ptz.parse(data);
                        var pan = {
                            min: params.min,
                            max: params.max,
                            res: params.step,
                            default: params.default,
                            value: params.value
                        };
                        if (!ret.absolutePanTilt) {
                            ret.absolutePanTilt = {};
                        }
                        ret.absolutePanTilt.pan = pan;
                    } else if (line.indexOf('tilt_absolute') > -1) {
                        attr = 'tilt_absolute';
                        data = line.split(':')[1].trim().replace(/ /g, ';');
                        params = ptz.parse(data);
                        var tilt = {
                            min: params.min,
                            max: params.max,
                            res: params.step,
                            default: params.default,
                            value: params.value
                        };
                        if (!ret.absolutePanTilt) {
                            ret.absolutePanTilt = {};
                        }
                        ret.absolutePanTilt.tilt = tilt;
                    } else if (line.indexOf('zoom_absolute') > -1) {
                        attr = 'zoom_absolute';
                        data = line.split(':')[1].trim().replace(/ /g, ';');
                        params = ptz.parse(data);
                        ret.absoluteZoom = {
                            min: params.min,
                            max: params.max,
                            res: params.step,
                            default: params.default,
                            value: params.value
                        };
                    } else if (line.indexOf('zoom_continuous') > -1) {
                        attr = 'zoom_continuous';
                        data = line.split(':')[1].trim().replace(/ /g, ';');
                        params = ptz.parse(data);
                        ret.relativeZoom = {
                            min: params.min,
                            max: params.max,
                            res: params.step,
                            default: params.default,
                            value: params.value
                        };
                    } else if (line.indexOf('pan_speed') > -1) {
                        attr = 'pan_speed';
                        data = line.split(':')[1].trim().replace(/ /g, ';');
                        params = ptz.parse(data);
                        var rpan = {
                            min: params.min,
                            max: params.max,
                            res: params.step,
                            default: params.default,
                            value: params.value
                        };
                        if (!ret.relativePanTilt) {
                            ret.relativePanTilt = {};
                        }
                        ret.relativePanTilt.pan = rpan;
                    } else if (line.indexOf('tilt_speed') > -1) {
                        attr = 'tilt_speed';
                        data = line.split(':')[1].trim().replace(/ /g, ';');
                        params = ptz.parse(data);
                        var rtilt = {
                            min: params.min,
                            max: params.max,
                            res: params.step,
                            default: params.default,
                            value: params.value
                        };
                        if (!ret.relativePanTilt) {
                            ret.relativePanTilt = {};
                        }
                        ret.relativePanTilt.tilt = rtilt;
                    }
                }
            });
            return ret;
        });
    }

    static absolutePanTilt(camera, pan, tilt) {
        return ptz.runShell(`v4l2-ctl --device=${camera.path} --set-ctrl=pan_absolute=${pan},tilt_absolute=${tilt}`).then(() => {
            return;
        });
    }

    static absoluteZoom(camera, zoom) {
        return ptz.runShell(`v4l2-ctl --device=${camera.path} --set-ctrl=zoom_absolute=${zoom}`).then(() => {
            return;
        });
    }

    static doPTZCommand(x, y, z) {

        ptz.absolutePanTilt(camera, x, y);
        ptz.absoluteZoom(camera, z);
    };
}

ptz.getCamera().then((camera) => {
    ptz.getCapabilities(camera).then(capabilities => {

        ptz.doPTZCommand({
            x: 0,
            y: 0,
            z: 0
        }).then(() => {

            return promise.delay(5000).then(() => {

                return ptz.doPTZCommand({
                    x: capabilities.absolutePanTilt.pan.max,
                    y: capabilities.absolutePanTilt.pan.max,
                    z: capabilities.absoluteZoom.max
                }).then(() => {
                    return promise.delay(5000).then(() => {

                        return ptz.doPTZCommand({
                            x: capabilities.absolutePanTilt.pan.min,
                            y: capabilities.absolutePanTilt.pan.min,
                            z: capabilities.absoluteZoom.min
                        }).then(() => {

                            return promise.delay(5000).then(() => {

                                return ptz.doPTZCommand({
                                    x: 0,
                                    y: 0,
                                    z: 0
                                }).then(() => {

                                    console.log('test complete');
                                    process.exit(-1);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}).catch((err) => {
    console.error(err);
    process.exit(-1);
})