/**
 * Test.
 * Usage: node scripts/dtr.test.js
 */
//// Core modules
const path = require('path');
const util = require('util');

//// External modules
const lodash = require('lodash');
const moment = require('moment');
const pigura = require('pigura');

//// Modules
const dtrHelper = require('../data/src/dtr-helper');


//// First things first
//// Save full path of our root app directory and load config and credentials
global.APP_DIR = path.resolve(__dirname + '/../').replace(/\\/g, '/'); // Turn back slash to slash for cross-platform compat
global.ENV = lodash.get(process, 'env.NODE_ENV', 'dev')

const configLoader = new pigura.ConfigLoader({
    configName: './configs/config.json',
    appDir: APP_DIR,
    env: ENV,
    logging: true
})
global.CONFIG = configLoader.getConfig()

const credLoader = new pigura.ConfigLoader({
    configName: './credentials/credentials.json',
    appDir: APP_DIR,
    env: ENV,
    logging: true
})
global.CRED = credLoader.getConfig()

    ; (async () => {
        try {
            let shift = dtrHelper.createShift({ hour: 0 }, { hour: 0 }, { hour: 0, minute: 15 })
            // console.log(shift)
            if(Number.isNaN(shift.start) || Number.isNaN(shift.end) || Number.isNaN(shift.grace)) throw new Error('Test fail')

            let shifts = []
            shifts.push(dtrHelper.createShift({ hour: 8, minute: 0 }, { hour: 12, minute: 0 }, { hour: 0, minute: 15 }))
            shifts.push(dtrHelper.createShift({ hour: 13, minute: 0 }, { hour: 17, minute: 0 }, { hour: 0, minute: 15 }))
            console.log(shifts)

            let attendances = [
                moment.utc('2021-07-01T12:16:00.000Z'),
                moment.utc('2021-07-01T12:20:00.000Z'),
                moment.utc('2021-07-01T13:10:00.000Z'),
                moment.utc('2021-07-01T17:00:00.000Z'),
            ]
            // console.log(attendances)

            // Shift 1
            let startMinutes = dtrHelper.momentToMinutes(attendances[0])
            let shiftCurrent = dtrHelper.getNextShift(startMinutes, shifts)
            console.log('shiftCurrent', shiftCurrent)

            if (startMinutes <= shiftCurrent.start + shiftCurrent.grace) { // late but graced
                startMinutes = shiftCurrent.start // set to shift start
            }
            console.log('startMinutes', startMinutes)

            let logoutMinutes = dtrHelper.momentToMinutes(attendances[1])
            if(logoutMinutes < shiftCurrent.start){
                throw new Error('Logging out before shift start.')
            }
            if(logoutMinutes > shiftCurrent.end){
                logoutMinutes = shiftCurrent.end // Not counted outshide shift
            }
            console.log('logoutMinutes', logoutMinutes)

            let minutes = logoutMinutes - startMinutes
            console.log('minutes', minutes)

            let hoursPerDay = 8
            let renderedDays = minutes / 60 / hoursPerDay
            let renderedHours = (renderedDays - Math.floor(renderedDays)) * hoursPerDay
            let renderedMinutes = (renderedHours - Math.floor(renderedHours)) * 60
            renderedDays = Math.floor(renderedDays)
            renderedHours = Math.floor(renderedHours)
            renderedMinutes = Math.floor(renderedMinutes)

            console.log(renderedDays, 'days', renderedHours, 'hours', renderedMinutes, 'minutes')


        } catch (err) {
            console.log(err)
        } finally {
        }
    })()


