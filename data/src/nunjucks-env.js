//// Core modules

//// External modules
const lodash = require('lodash');
const nunjucks = require('nunjucks');
const nunjucksFilters = require('nunjucks-filters');
const moment = require('moment');

//// Modules

let dirView = CONFIG.app.dirs.view; // Path to view directory

//// Setup view
// Setup nunjucks loader. See https://mozilla.github.io/nunjucks/api.html#loader
let loaderFsNunjucks = new nunjucks.FileSystemLoader(dirView, CONFIG.nunjucks.loader);

// Setup nunjucks environment. See https://mozilla.github.io/nunjucks/api.html#environment
let env = new nunjucks.Environment(loaderFsNunjucks, CONFIG.nunjucks.environment);

// Add filters
nunjucksFilters.extend(env)

// Custom app specific filter
env.addFilter('s3_url', function (value, sizePrefix = "") {
    if (!value) {
        return ''
    }
    if (sizePrefix) {
        sizePrefix += "-";
    }
    return `/file-getter/${CONFIG.aws.bucket1.name}/${CONFIG.aws.bucket1.prefix}/${sizePrefix}${value}`
})

env.addFilter('view_url', function (value, sizePrefix = "") {
    if (sizePrefix) {
        sizePrefix += "-";
    }
    return `/file-viewer/${CONFIG.aws.bucket1.name}/${CONFIG.aws.bucket1.prefix}/${sizePrefix}${value}`
})

env.addFilter('customFilter', function (array, filterObj) {
    return lodash.filter(array, filterObj)
})

env.addFilter('mapValue', function (value, list) {
    return lodash.get(lodash.find(list, (o) => o.value === value), 'text', '')
})

env.addFilter('generateArray', function (value, offset = 0) {
    return Array.from(Array(value).keys()).slice(offset)
})
env.addFilter('padStart', function (value, length = 2, pads = '0') {
    return String(value).padStart(length, pads)
})
env.addFilter('maybePluralize', function (count, noun, suffix = 's') {
    return `${count} ${noun}${count !== 1 ? suffix : ''}`;
})
env.addFilter('includes', function (array, value) {
    return array.includes(value);
})
env.addFilter('mToTime', function (minutes, format, shorten = false) {
    if (minutes === undefined || minutes === null) return 0
    if (minutes === '') return ''
    format = format || 'h:mmA'
    let m = moment().startOf('year').startOf('day').add(minutes, 'minutes')
    if (shorten && m.format('m') === '0') {
        return m.format('h A')
    }
    return m.format(format)
})
env.addFilter('mToHour', function (minutes) {
    if (minutes === undefined || minutes === null) return 0
    return Math.floor(minutes / 60)
})
env.addFilter('mToMin', function (minutes) {
    if (minutes === undefined || minutes === null) return 0
    return Math.round((minutes / 60 - Math.floor(minutes / 60)) * 60)
})
env.addFilter('round2', function (num) {
    return Math.round((num + Number.EPSILON) * 100) / 100
})
env.addFilter('scheduleBreaks', function (breaks) {
    breaks = breaks.map((br) => {
        return br.start + ' - ' + br.end
    })
    return breaks.join(', ')
})
/**
 * @param {number} hour 24-hour time from 0 -23
 */
env.addFilter('to12Hour', function (hour, compact = false) {

    let h = Math.floor(hour)
    let m = Math.round((hour - h) * 60)

    let a = h >= 12 ? 'PM' : 'AM'
    h = h <= 0 ? 12 : h // 12 AM
    h = h >= 13 ? h - 12 : h // 1 PM onwards


    m = new String(m).padStart(2, '0')
    let hm = `${h}:${m}`
    if (compact) {
        hm = hm.replace(':00', '')
        return `${hm}${a}`
    }
    h = new String(h).padStart(2, '0')
    return `${hm} ${a}`


})

env.addFilter('mobile_num', (mobileNo) => {
    mobileNo = lodash.toString(mobileNo);
    mobileNo = mobileNo.replace(/[^0-9.]/g, ''); // Remove non-numeric chars

    mobileNo = lodash.toArray(mobileNo);
    mobileNo.splice(4, 0, ' ');
    mobileNo.splice(8, 0, ' ');
    return lodash.join(mobileNo, '');
});

env.addFilter('blank', (num) => {
    if (!num) {
        return ''
    }
    return num
});

env.addFilter('roundOff', (number, precision) => {
    number = parseFloat(number)
    precision = parseInt(precision)
    let factor = Math.pow(10, precision)
    let n = precision < 0 ? number : 0.01 / factor + number
    return Math.round(n * factor) / factor
});

env.addFilter('toFixed', (number, precision) => {
    return parseFloat(number).toFixed(precision)
});

env.addFilter('uppercase', (val) => {
    return lodash.upperCase(val)
});

env.addFilter('acronym', (val) => {
    val = new String(val)
    val = val.replace(/(\s)+/, ' ').split(' ')
    val = val.map(word => {
        first = word.at(0)
        if (first === first.toUpperCase()) {
            return first
        }
        return ''
    })
    return val.join('')
});

// Change ALL CAPS into All Caps
env.addFilter('noCaps', (val) => {
    val = new String(val)
    val = val.replace(/(\s)+/g, ' ').split(' ') // Turn extra spaces into single space and split by single space
    val = val.map(word => {
        // Split word into array of letters
        word = word.split('').map((v, k, arr) => {
            if (k == 0) {
                return v // As is - respects lowercase first letter
            } else { // Ignore if...
                if (arr.at(k + 1) === '.') { // If next is a period, might be an acronym, so ignore - C.P.U.
                    return v
                }
                if (arr.at(0) === '(' && arr.at(-1) === ')') { // If surrounded by parenthesis (CPU)
                    return v
                }
            }
            return v.toLowerCase()
        })
        return word.join('')
    })
    return val.join(' ')
});

//// Export
module.exports = env;