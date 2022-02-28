window.customValidationMixin = {
    // Same-name data are overwritten
    data: function () {
        return {
            isFormTouched: false, // Flag for validation checks only when form is touched
        }
    },
    computed: {
        hasValidationError: function(){
            var me = this;
            var hasError = false;
            _.each(me.validations, function(validation, fieldName){
                if(validation.message !== '') {
                    hasError = true;
                }      
            });
            return hasError;
        }
    },
    methods: {
        validateOne: function(name){
            var me = this;
            if(!me.isFormTouched) return; // Do not validate yet if form is untouched
            _.invoke(me, 'validations[' + name + '].validate', 
                _.get(me, 'validations[' + name + ']'),
                _.get(me, name),
                me
            )
        },
        validate: function(){
            var me = this;
            if(!me.isFormTouched) return; // Do not validate yet if form is untouched

            _.each(me.validations, function(validation, fieldName){
                validation.validate(validation, me[fieldName], me)        
            });
        },
        getError: function(name){
            return _.get(this, 'validations[' + name + '].message')
        },
    }
}