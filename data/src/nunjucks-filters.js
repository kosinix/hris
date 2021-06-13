//// Core modules
const querystring = require('querystring');

//// External modules
const lodash = require('lodash');
const moment = require('moment');

//// Modules
const extended = (env)=>{

    /**
     * Matches a value with list. If match found, return value of activeClass. Empty string otherwise.
     */
    env.addFilter('active_class', (value, list, activeClass = 'active') => {
        if(Array.isArray(list)){
            for(let x = 0; x < list.length; x++){
                let o = list[x]
                let typeString = Object.prototype.toString.call(o)
                if(typeString.includes('RegExp')){
                    if(o.test(value)){
                        return activeClass
                    }
                } else {
                    if(o === value){
                        return activeClass
                    }
                }
            }
        } else {
            if(value === list){
                return activeClass
            }
        }
        return ''
    });

    /**
     * Get difference in years from a given date.
     */
    env.addFilter('age', function (value) {
        return moment().diff(value, 'years')
    })

    /**
     * Camel-case.
     */
    env.addFilter('camel_case', (value) => {
        return lodash.camelCase(value);
    });

    /**
     * Capitalize string.
     */
    env.addFilter('capitalize', (value) => {
        return lodash.capitalize(value);
    });

    /**
     * Format number into money format.
     */
    env.addFilter('currency', (value, sep = ',', decPlace = 2) => {
        value = lodash.toNumber(value).toFixed(decPlace);
        let split = lodash.split(value, '.');
        let whole = lodash.toArray(lodash.get(split, '[0]', []));
        let cent = lodash.toString(lodash.get(split, '[1]', ''));

        let out = [];
        let length = whole.length;
        for (c = 0; c < length; c++) {
            let rev = length - c;
            if (rev % 3 === 0) {
                out.push(sep);
                out.push(whole[c]);
            } else {
                out.push(whole[c]);
            }
        }
        let merged = lodash.join(out, ''); // Join arrays
        merged = lodash.trimStart(merged, sep); // Remove left-most sep
        if (cent) { // If there is a cent, append
            merged += '.' + cent;
        }
        return merged;
    });

    /**
     * Get first character from string.
     */
    env.addFilter('first', (value) => {
        return lodash.toString(value)[0];
    });

    /**
     * Format date using moment format.
     */
    env.addFilter('format_date', function (value, format, timeZone = '+0800') {
        let formatted = moment(value).utcOffset(timeZone).format(format);
        if (formatted === "Invalid date") {
            return null;
        }
        return formatted;
    });

    /**
     * Return human readable text of how far from given date.
     */
    env.addFilter('from_now', (date) => {
        return moment(date).fromNow();
    });

    /**
     * Land line phone format.
     */
    env.addFilter('landline', (value) => {
        value = lodash.toString(value);
        value = value.replace(/[^0-9.]/g, ''); // Remove non-numeric chars

        return value.substr(0, 3) + ' ' + value.substr(-7);
    });

    /**
     * Format into standard mobile number format.
     */
    env.addFilter('phone', (mobileNo, countryCode = "+63") => {
        mobileNo = lodash.toString(mobileNo);
        mobileNo = mobileNo.replace(/[^0-9.]/g, ''); // Remove non-numeric chars
        if (mobileNo.length > 10) {
            mobileNo = countryCode + mobileNo.substr(-10); // Trim to 10 chars and prepend countryCode: (eg. "63")
        } else if (mobileNo.length === 10) {
            mobileNo = countryCode + mobileNo;
        }
        return mobileNo;
    });

    /**
     * Format into standard mobile number format with space separators.
     */
    env.addFilter('phone_readable', (mobileNo, countryCode = "63") => {
        mobileNo = lodash.toString(mobileNo);
        mobileNo = mobileNo.replace(/[^0-9.]/g, ''); // Remove non-numeric chars
        if (mobileNo.length > 10) {
            mobileNo = countryCode + mobileNo.substr(-10); // Trim to 10 chars and prepend countryCode: (eg. "63")
        } else if (mobileNo.length === 10) {
            mobileNo = countryCode + mobileNo;
        }
        mobileNo = lodash.toArray(mobileNo);
        mobileNo.splice(2, 0, ' ');
        mobileNo.splice(6, 0, ' ');
        mobileNo.splice(10, 0, ' ');
        return lodash.join(mobileNo, '');
    });

    /**
     * Merge query string with default querystring.
     */
    env.addFilter('query_string', (defs, params) => {
        let merged = { ...defs, ...params }
        return querystring.stringify(merged);
    });

    /**
     * Replace search with replacement
     */
    env.addFilter('replace', (value, search, replacement) => {
        if (value) {
            value = value.toString();
            return value.replace(search, replacement)
        }
        return value;
    });

    /**
     * Format into start-case.
     */
    env.addFilter('start_case', (value) => {
        return lodash.startCase(value);
    });

    /**
     * Stringify object.
     */
    env.addFilter('stringify', function (value) {
        return JSON.stringify(value);
    });

    /**
     * Turns text into slug (kebab case).
     */
    env.addFilter('slug', function (value) {
        return lodash.kebabCase(value)
    })

    /**
     * Get type of value.
     */
    env.addFilter('type_of', (value) => {
        return typeof value;
    });
}

//// Export
module.exports = {
    extend: extended
};