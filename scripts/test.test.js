/**
 * Test.
 * Usage: node scripts/test.test.js
 */
//// Core modules
const path = require('path');
const util = require('util');

//// External modules
const lodash = require('lodash');
const moment = require('moment');

//// Modules


let start = moment.utc('2021-07-01')
let end = moment.utc('2021-07-15')

console.log(start)
console.log(end)
console.log(start.diff(end, 'days'))
let days = []
for (let m = start.clone(); m.diff(end, 'days') <= 0; m.add(1, 'days')) {
    let day = {
        date: m.diff(end, 'days'),
        // year: m.format('YYYY'),
        // month: m.format('M'),
        // weekDay: m.format('ddd'),
        day:  m.toDate(),
        // dtr: dtr,
        // attendance: attendance
    }
    days.push(day)
}
console.log(days)
