window.vuelidateExtendMixin = {
    // Same-name data are overwritten
    data: function () {
        return {
            errorMessage: '' // The main error message for the entire form
        }
    },
    methods: {
        getError: function (field) {
            var me = this;
            var v = me.$v[field] // Try string prop name
            if (!v) v = _.get(me.$v, field) // Might be object path
            if (v && v.$error === true) {
                if (v.required === false) {
                    return 'This field is required.'
                }
                if (v.email === false) {
                    return 'Please provide a valid email.'
                }
                if (v.minLength === false) {
                    return 'Must be at least ' + v.$params.minLength.min + ' characters long.'
                }
                if (v.minValue === false) {
                    return 'Must be at least ' + v.$params.minValue.min + '.'
                }
                if (v.isStrong === false) {
                    return 'Invalid password.'
                }
                if (v.isTrue === false) {
                    if (v.$params && v.$params.isTrue && v.$params.isTrue.errMsg) {
                        return v.$params.isTrue.errMsg
                    }
                }
                if (v.isUniqueEmail === false) {
                    if (v.$params && v.$params.isUniqueEmail && v.$params.isUniqueEmail.errMsg) {
                        return v.$params.isUniqueEmail.errMsg
                    }
                }

                if (v.isUniqueMobile === false) {
                    if (v.$params && v.$params.isUniqueMobile && v.$params.isUniqueMobile.errMsg) {
                        return v.$params.isUniqueMobile.errMsg
                    }
                }
                if (v.isUniqueMobile === false) {
                    if (v.$params && v.$params.isUniqueMobile && v.$params.isUniqueMobile.errMsg) {
                        return v.$params.isUniqueMobile.errMsg
                    }
                }
                if (v.isFbUrl === false) {
                    if (v.$params && v.$params.isFbUrl && v.$params.isFbUrl.errMsg) {
                        return v.$params.isFbUrl.errMsg
                    }
                }
                if (v.isMoneyFormat === false) {
                    if (v.$params && v.$params.isMoneyFormat && v.$params.isMoneyFormat.errMsg) {
                        return v.$params.isMoneyFormat.errMsg
                    }
                }
                if (v.isStrongPassword === false) {
                    if (v.$params && v.$params.isStrongPassword && v.$params.isStrongPassword.errMsg) {
                        return v.$params.isStrongPassword.errMsg
                    }
                }
                return 'Validation error.'

            }
        },
        isInvalid: function (name) {
            if (this.$v[name] && this.$v[name].$error) {
                return 'is-invalid'
            }
            return ''
        }
    }
}

/**
 * Custom validators callback function must return true for error and false if valid.
 */
window.customValidators = {
    isTrue: function (errMsg) {
        return window.vuelidate.withParams(
            {
                type: 'isTrue',
                errMsg: errMsg || 'Must be true.'
            },
            function (value) {
                return value === true
            }
        )
    },
    isUniqueEmail: function (endPoint, errMsg) {
        return window.vuelidate.withParams(
            {
                type: 'isUniqueEmail',
                endPoint: endPoint,
                errMsg: errMsg || 'Must be unique email address.',
            },
            function (value) {
                // standalone validator ideally should not assume a field is required
                if (value === '') return true
                return window.app.ajax.post(endPoint, { email: value })
            }
        )
    },
    isUniqueMobile: function (endPoint, errMsg) {
        return window.vuelidate.withParams(
            {
                type: 'isUniqueEmail',
                endPoint: endPoint,
                errMsg: errMsg || 'Must be unique mobile number.',
            },
            function (value) {
                // standalone validator ideally should not assume a field is required
                if (value === '') return true
                return window.app.ajax.post(endPoint, { mobileNo: value })
            }
        )
    },
    isFbUrl: function (errMsg) {
        return window.vuelidate.withParams(
            {
                type: 'isFbUrl',
                errMsg: errMsg || 'Not a valid Facebook URL.'
            },
            function (value) {
                if (!/^(https?:\/\/)?(www\.|m\.|h\.|mobile\.)?facebook.com\/[a-zA-Z0-9(\.\?)?]+/.test(value)) {
                    return false;
                }
                if (/home\.php/.test(value)) {
                    return false;
                }
                if (/\/eclcph/.test(value)) {
                    return false;
                }
                return true;
            }
        )

    },
    isMoneyFormat: function (errMsg) {
        return window.vuelidate.withParams(
            {
                type: 'isMoneyFormat',
                errMsg: errMsg || 'Not a valid money format.'
            },
            function (value) {
                return !window.validators.helpers.req(value) || /^(-?)((\d+)|(\d{1,3})(\,\d{3}|)*)(\.\d{2}|)$/.test(value);
            }
        )
    },
    isStrongPassword: function (errMsg) {
        return window.vuelidate.withParams(
            {
                type: 'isStrongPassword',
                errMsg: errMsg || 'Weak password.'
            },
            function (value) {
                return !this.weakPassword
            }
        )
    }
}