jQuery(document).ready(function ($) {
    $('.toggler').on('click', function () {
        var $body = $('body');
        $body.toggleClass('hide-menu');
        if ($body.hasClass("hide-menu")) {
            setCookie('hideNav', 'true');
        } else {
            setCookie('hideNav', 'false');
        }
    })
});

// Define a new component
if (typeof VueMoney === 'undefined') {
    function VueMoney() { } // Goes to window.VueMoney
}
VueMoney.mixin = {
    // Same-name data are overwritten
    computed: {

    },
    data: function () {

    },
    methods: {
        money: function (value) {
            return parseFloat(_.toNumber(value).toFixed(2));
        },
        /**
         * Readable money format
         * 
         * @param {String|Number} value 
         * @param {String} sep 
         * @param {Number} decPlace 
         * 
         * @returns {String} Readable money format
         */
        currency: function (value, sep, decPlace) {
            if (!sep) sep = ',';
            if (!decPlace) decPlace = 2;
            var rounded = _.toNumber(value).toFixed(decPlace);
            var split = _.split(rounded, '.');
            var whole = _.toArray(_.get(split, '[0]', []));
            var cent = _.toString(_.get(split, '[1]', ''));

            var out = [];
            var length = whole.length;
            for (c = 0; c < length; c++) {
                var rev = length - c;
                if (rev % 3 === 0) {
                    out.push(sep);
                    out.push(whole[c]);
                } else {
                    out.push(whole[c]);
                }
            }
            var merged = _.join(out, ''); // Join arrays
            merged = _.trimStart(merged, sep); // Remove left-most sep
            if (cent) { // If there is a cent, append
                merged += '.' + cent;
            }
            return merged;
        },
    }
}


