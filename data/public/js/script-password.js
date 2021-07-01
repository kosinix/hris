// Define a new component
if (typeof VuePassword === 'undefined') {
    function VuePassword() { } // Goes to window.VuePassword
}
VuePassword.mixin = {
    // Same-name data are overwritten
    computed: {
        passwordDesc: function () {
            if (this.passwordScore === 0) {
                return "Risky";
            } else if (this.passwordScore === 1) {
                return "Weak";
            } else if (this.passwordScore === 2) {
                return "Fair";
            } else if (this.passwordScore === 3) {
                return "Strong";
            } else if (this.passwordScore === 4) {
                return "Very Strong";
            }
        },
        weakPassword: function () {
            return this.passwordUpper !== true ||
                this.passwordLower !== true ||
                this.passwordSpecial !== true ||
                this.passwordMoreThan8 !== true ||
                this.passwordStrong !== true;
        },
    },
    data: function () {
        return {
            passwordType: 'password',
            passwordType2: 'password',
            passwordUpper: false,
            passwordLower: false,
            passwordSpecial: false,
            passwordMoreThan8: false,
            passwordStrong: false,
            passwordScore: 0,
            passSuggest: ''
        }
    },
    methods: {
        togglePassword: function () {
            if (this.passwordType === "password") {
                return this.passwordType = "text";
            }
            this.passwordType = "password"
        },
        togglePassword2: function () {
            if (this.passwordType2 === "password") {
                return this.passwordType2 = "text";
            }
            this.passwordType2 = "password"
        },

        checkPassword: function (password, userInputs) {
            if (/([A-Z])+/.test(password)) {
                this.passwordUpper = true;
            } else {
                this.passwordUpper = false;
            }

            if (/([a-z])+/.test(password)) {
                this.passwordLower = true;
            } else {
                this.passwordLower = false;
            }

            if (/([^0-9a-zA-Z])+/.test(password)) {
                this.passwordSpecial = true;
            } else {
                this.passwordSpecial = false;
            }

            if (password.length >= 8) {
                this.passwordMoreThan8 = true;
            } else {
                this.passwordMoreThan8 = false;
            }

            var result = zxcvbn(password, userInputs);
            this.passwordScore = result.score;
            this.passSuggest = result.feedback.warning + ' ' + result.feedback.suggestions.join('. ')
            if (result.score >= 3) {
                this.passwordStrong = true;
            } else {
                this.passwordStrong = false;
            }
        },
    }
}


