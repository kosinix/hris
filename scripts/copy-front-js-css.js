/**
 * Copy front end files
 * Usage: node ./scripts/copy-front-js-css.js
 */

//// Core modules
const fs = require('fs');
const path = require('path');

//// External modules

//// Modules


global.APP_DIR = path.resolve(__dirname + '/../').replace(/\\/g, '/'); // Turn back slash to slash for cross-platform compat

const files = [
    {
        src: `${APP_DIR}/node_modules/jquery/dist/jquery.min.js`,
        dest: `${APP_DIR}/data/public/js/jquery.min.js`,
    },
    {
        src: `${APP_DIR}/node_modules/jquery/dist/jquery.min.map`,
        dest: `${APP_DIR}/data/public/js/jquery.min.map`,
    },

    {
        src: `${APP_DIR}/node_modules/@popperjs/core/dist/umd/popper.min.js`,
        dest: `${APP_DIR}/data/public/js/popper.min.js`,
    },
    {
        src: `${APP_DIR}/node_modules/@popperjs/core/dist/umd/popper.min.js.map`,
        dest: `${APP_DIR}/data/public/js/popper.min.js.map`,
    },

    {
        src: `${APP_DIR}/node_modules/bootstrap/dist/js/bootstrap.min.js`,
        dest: `${APP_DIR}/data/public/js/bootstrap.min.js`,
    },
    {
        src: `${APP_DIR}/node_modules/bootstrap/dist/js/bootstrap.min.js.map`,
        dest: `${APP_DIR}/data/public/js/bootstrap.min.js.map`,
    },


    {
        src: `${APP_DIR}/node_modules/lodash/lodash.min.js`,
        dest: `${APP_DIR}/data/public/js/lodash.min.js`,
    },

    {
        src: `${APP_DIR}/node_modules/moment/min/moment.min.js`,
        dest: `${APP_DIR}/data/public/js/moment.min.js`,
    },
    {
        src: `${APP_DIR}/node_modules/moment/min/moment.min.js.map`,
        dest: `${APP_DIR}/data/public/js/moment.min.js.map`,
    },

    {
        src: `${APP_DIR}/node_modules/axios/dist/axios.min.js`,
        dest: `${APP_DIR}/data/public/js/axios.min.js`,
    },
    {
        src: `${APP_DIR}/node_modules/axios/dist/axios.min.map`,
        dest: `${APP_DIR}/data/public/js/axios.min.map`,
    },

    {
        src: `${APP_DIR}/node_modules/vue/dist/vue.min.js`,
        dest: `${APP_DIR}/data/public/js/vue.min.js`,
    },
    {
        src: `${APP_DIR}/node_modules/vue/dist/vue.js`,
        dest: `${APP_DIR}/data/public/js/vue.js`,
    },

    {
        src: `${APP_DIR}/node_modules/vuelidate/dist/vuelidate.min.js`,
        dest: `${APP_DIR}/data/public/js/vuelidate.min.js`,
    },

    {
        src: `${APP_DIR}/node_modules/vuelidate/dist/validators.min.js`,
        dest: `${APP_DIR}/data/public/js/validators.min.js`,
    },

    {
        src: `${APP_DIR}/node_modules/jsqr/dist/jsQR.js`,
        dest: `${APP_DIR}/data/public/js/jsQR.js`,
    },

    {
        src: `${APP_DIR}/node_modules/zxcvbn/dist/zxcvbn.js`,
        dest: `${APP_DIR}/data/public/js/zxcvbn.js`,
    },

    {
        src: `${APP_DIR}/node_modules/vuejs-auto-complete/dist/build.js`,
        dest: `${APP_DIR}/data/public/js/vuejs-auto-complete.js`,
    },
    {
        src: `${APP_DIR}/node_modules/vuejs-auto-complete/dist/build.js.map`,
        dest: `${APP_DIR}/data/public/js/vuejs-auto-complete.map`,
    },

    {
        src: `${APP_DIR}/node_modules/bootstrap/dist/css/bootstrap.min.css`,
        dest: `${APP_DIR}/data/public/css/bootstrap.min.css`,
    },
    {
        src: `${APP_DIR}/node_modules/bootstrap/dist/css/bootstrap.min.css.map`,
        dest: `${APP_DIR}/data/public/css/bootstrap.min.css.map`,
    },
    {
        src: `${APP_DIR}/node_modules/sortablejs/Sortable.min.js`,
        dest: `${APP_DIR}/data/public/js/Sortable.min.js`,
    },
    {
        src: `${APP_DIR}/node_modules/money-math/money.js`,
        dest: `${APP_DIR}/data/public/js/money.js`,
    },
    {
        src: `${APP_DIR}/node_modules/webcamjs/webcam.min.js`,
        dest: `${APP_DIR}/data/public/js/webcam.min.js`,
    },
]
files.forEach((o)=>{
    fs.copyFile(o.src, o.dest, (err) => {
        if (err) throw err;
        console.log(`Copied ${o.src} to ${o.dest}`);
    });
})
