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
    return`${count} ${noun}${count !== 1 ? suffix : ''}`;
})
env.addFilter('includes', function (array, value) {
    return array.includes(value);
})
env.addFilter('mToTime', function (minutes, format) {
    if (minutes === undefined || minutes === null) return 0
    if (minutes === '') return ''
    format = format || 'h:mmA'
    return moment().startOf('year').startOf('day').add(minutes, 'minutes').format(format)
})
env.addFilter('mToHour', function (minutes) {
    if (minutes === undefined || minutes === null) return 0
    return Math.floor(minutes/60)
})
env.addFilter('mToMin', function (minutes) {
    if (minutes === undefined || minutes === null) return 0
    return Math.round((minutes/60 - Math.floor(minutes/60))*60)
})
env.addFilter('round2', function (num) {
    return Math.round( ( num + Number.EPSILON ) * 100 ) / 100
})
env.addFilter('scheduleBreaks', function (breaks) {
    breaks = breaks.map((br)=>{
        return br.start + ' - ' + br.end
    })
    return breaks.join(', ')
})
/**
 * @param {number} hour 24-hour time from 0 -23
 */
env.addFilter('to12Hour', function (hour) {
    if (hour == 0 ) {
        return '12AM'
    } else if (hour <= 11){
        return hour + 'AM'
    } else if (hour === 12) {
        return hour + 'PM'
    } else {
        return hour - 12 + 'PM'
    }
})

//// Export
module.exports = env;