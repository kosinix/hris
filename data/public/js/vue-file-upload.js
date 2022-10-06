// Define a new component
if (typeof VueFileUpload=== 'undefined') {
    function VueFileUpload() { } // Goes to window.VueFileUpload
}

/**
 * Usage:
 * mixins: [
 *      VueFileUpload.mixin
 * ],
 */
VueFileUpload.mixin = {
    // Same-name data are overwritten
    computed: {
        accept: function () {
            return this.acceptedMimeTypes.join(',')
        }
    },
    data: function () {
       return {
            acceptedMimeTypes: ['image/jpeg', 'image/png'],
       }
    },
    methods: {
        watermark: function(){
            return ''
        },
        /**
         * Usage: <input v-on:change="readFile($event, dataHolder)" ...
         * 
         * @param {*} event 
         * @param {*} photoVariable 
         * @returns 
         */
        readFile: function(event, photoVariable, canvasId){
            var me = this;
            var files = [];
            if('target' in event){
                if('files' in event.target){
                    files = event.target.files
                }
            }
            if(files){
                var count = files.length;
                me[photoVariable] = "";

                if(count > 1){
                    // Remove all FileList content
                    event.target.value = "";
                    return alert('Maximum of 1 file only');
                }

                for(var i = 0; i < count; i++){
                    if(me.acceptedMimeTypes.indexOf(files.item(i).type) === -1){
                        // Remove all FileList content
                        event.target.value = "";

                        return alert('File type not allowed. Must be one of the following: ' + me.acceptedMimeTypes.join(', '));
                    }
                }
                
                for(var i = 0; i < count; i++){
                    let file = files.item(i);
                    let reader = new FileReader();
                    reader.onload = function(e) {
                        var base64Data = e.target.result
                        var mime = base64Data.split(';')[0].replace('data:','')
                        // If image types
                        if (['image/jpeg', 'image/png'].includes(mime)) {
                            let blank = new Image();
                            blank.onload = function(e) {
                                let img = e.target;
                                let canvas = document.getElementById(canvasId);
                                let {resizeWidth, resizeHeight} = me.resizeDimensions(img.width, img.height, 1100, 1100)
                                canvas.width = resizeWidth;
                                canvas.height = resizeHeight;
                                let ctx = canvas.getContext("2d");

                                ctx.drawImage(img, 0, 0, resizeWidth, resizeHeight);
                                // let date = new Date();
                                
                                ctx.shadowColor="white";
                                ctx.shadowBlur=7;
                                ctx.lineWidth=5;
                                ctx.font = "bold 14px 'Courier New', sans-serif"
                                ctx.fillStyle = "#000000";
                                ctx.fillText(me.watermark(), 10, resizeHeight - 10)
                                me[photoVariable] = canvas.toDataURL("image/jpeg");
                            }
                            blank.src = base64Data; // data URL base64 encoded
                        } else { // None image
                            me[photoVariable] = base64Data;
                        }
                    }
                    reader.readAsDataURL(file);
                }
            }
        },
        resizeDimensions: function(width, height, newWidth, newHeight){
            var ratio = width / height
    
            // Try basing it on width first
            var resizeWidth  = newWidth;
            var resizeHeight = Math.round(newWidth / ratio);
    
            if ((resizeWidth > newWidth) || (resizeHeight > newHeight)) { // Oops, either width or height does not fit
                // So base on height instead
                resizeHeight = newHeight;
                resizeWidth  = newHeight * ratio;
            }
            return {
                resizeWidth: resizeWidth,
                resizeHeight: resizeHeight,
            }
        }
    }
}

