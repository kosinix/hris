if (typeof MediaDevicesPresets === 'undefined') {
    function MediaDevicesPresets() { } // Goes to window.MediaDevicesPresets
}

// Older browsers might not implement mediaDevices at all, so we set an empty object first
if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
}

// Some browsers partially implement mediaDevices. We can't just assign an object
// with getUserMedia as it would overwrite existing properties.
// Here, we will just add the getUserMedia property if it's missing.
if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {

        // First get ahold of the legacy getUserMedia, if present
        var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

        // Some browsers just don't implement it - return a rejected promise with an error
        // to keep a consistent interface
        if (!getUserMedia) {
            return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
        }

        // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
        return new Promise(function (resolve, reject) {
            getUserMedia.call(navigator, constraints, resolve, reject);
        });
    }
}

/*
QCIF	    176 x 120	Quarter CIF (half the height and width as CIF)
CIF	        352 x 240	
2CIF	    704 x 240	2 times CIF width
4CIF	    704 x 480	2 times CIF width and 2 times CIF height
D1	        720 x 480	aka "Full D1"
720p HD	    1280 x 720	720p High Definitionaka "HD-SDI"
960p HD	    1280 x 960	960p High Definition - a Sony specific HD standard
1.3 MP	    1280 x 1024	aka "1 Megapixel" or "1MP"
2 MP	    1600 x 1200	2 Megapixel
1080p HD	1920 x 1080	1080p High Definition
*/
MediaDevicesPresets.createWebcamPhotoSnapper = function (videoEl, canvasEl, options) {

    var context = null

    options = _.defaults(options, {
        frontCam: true,
        width: 352,
        height: 240,
        imageWidth: 352,
        imageHeight: 240,
        mirrored: true
    })

    var constraints = {
        video: {
            width: options.width,
            height: options.height,
            facingMode: options.frontCam ? 'user' : 'environment'
        }
    }
    if (videoEl) {
        videoEl.addEventListener('loadedmetadata', function () {
            videoEl.play();
        })
    }
    
    return navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        if (videoEl) {

            videoEl.setAttribute("playsinline", true); // required to tell iOS safari we don't want fullscreen

            var videoTrack = stream.getVideoTracks().pop() // Get last video track if there's any
            if (videoTrack) {
                var settings = videoTrack.getSettings();

                var width = settings.width;
                var height = settings.height;
                var ratio = width / height;

                var newWidth = options.imageWidth
                var newHeight = options.imageHeight

                // Try basing it on width first
                var resizeWidth = newWidth;
                var resizeHeight = Math.round(newWidth / ratio);

                if (resizeWidth > newWidth || resizeHeight > newHeight) { // Oops, either width or height does not fit
                    // So base on height instead
                    resizeHeight = newHeight;
                    resizeWidth = newHeight * ratio;
                }

                canvasEl.width = resizeWidth;
                canvasEl.height = resizeHeight;
                canvasEl.hidden = true;
            }
            context = canvasEl.getContext("2d");

            if (options.mirrored) {
                var t = videoEl.style.getPropertyValue('transform');
                videoEl.style.setProperty('transform', t + ' rotateY(180deg)');
                context.scale(-1, 1);
            }

            // Older browsers may not have srcObject
            if ("srcObject" in videoEl) {
                videoEl.srcObject = stream;
            } else {
                // Avoid using this in new browsers, as it is going away.
                videoEl.src = window.URL.createObjectURL(stream);
            }
        }
        return {
            videoEl: videoEl,
            canvasEl: canvasEl,
            options: options,
            pause: function () {
                stream.getTracks().forEach(function (track) {
                    track.enabled = false
                });
            },
            resume: function () {
                stream.getTracks().forEach(function (track) {
                    track.enabled = true
                });
            },
            stop: function () {
                stream.getTracks().forEach(function (track) {
                    track.stop()
                });
            },
            snap: function () {
                if (options.mirrored) {
                    context.drawImage(videoEl, 0, 0, canvasEl.width * -1, canvasEl.height);
                } else {
                    context.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
                }
                return canvasEl.toDataURL('image/jpeg', 0.6); // imageBase64Data
            }
        }
    }).catch(function (err) {
        console.log(err.name + ": " + err.message);
        throw err
    });
}
