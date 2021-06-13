// Define a new component
if (typeof VuePhAddress === 'undefined') {
    function VuePhAddress() { } // Goes to window.VuePhAddress
}

/**
 * Usage:
 * mixins: [
 *      VuePhAddress.mixin
 * ],
 */
VuePhAddress.mixin = {
    // Same-name data are overwritten
    computed: {
        headers () {
            return {
                'X-Requested-With': 'XMLHttpRequest'
            }
        },
    },
    data: function () {
       
    },
    methods: {
        onSelect: function(o){
            this.s = o.display
        },
        dataSource: function(input) {
            return '/address?s=' + input
        },
        formattedDisplay: function (result) {
            return result.name
        },
    }
}

