/**
 * Usage:
 * mixins: [
 *      window.vueJsAutoCompleteExtendMixin
 * ],
 */
window.vueJsAutoCompleteExtendMixin = {
    // Same-name data are overwritten, component's data are prioritized
    data: function () {
       
    },
    // Hooks will be called before the component's own hooks
    computed: {
        headers () {
            return {
                'X-Requested-With': 'XMLHttpRequest'
            }
        },
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

