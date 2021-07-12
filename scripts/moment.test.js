/**
 * Insert test date.
 * Usage: node scripts/moment.test.js
 */
//// Core modules
const path = require('path');
const util = require('util');

//// External modules
const lodash = require('lodash');
const moment = require('moment');
const pigura = require('pigura');

//// Modules


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
            let shifts = [
                {
                    start: {
                        hour: 8, minute: 0
                    },
                    end: {
                        hour: 12, minute: 0
                    },
                    grace: {
                        hour: 0, minute: 15
                    }
                },
                {
                    start: {
                        hour: 13, minute: 0
                    },
                    end: {
                        hour: 17, minute: 0
                    },
                    grace: {
                        hour: 0, minute: 15
                    }
                }
            ].map((sh) => {
                return {
                    start: sh.start.hour * 60 + sh.start.minute,
                    end: sh.end.hour * 60 + sh.end.minute,
                    grace: sh.grace.hour * 60 + sh.grace.minute,
                }
            })

            let login = moment.utc('2021-07-01T08:00:00.000Z')
            let logout = moment.utc('2021-07-01T12:00:00.000Z')
            let needle = login.hour() * 60 + login.minute()
            let shiftCurrent = getNearestShift(needle, shifts)
            // console.log(needle, shiftCurrent, shifts )

            let loginMinutes = login.hour() * 60 + login.minute()
            let logoutMinutes = logout.hour() * 60 + logout.minute()
            console.log(loginMinutes, logoutMinutes)

            let startMinutes = loginMinutes
            if (loginMinutes <= shiftCurrent.start + grace) { // late but graced
                startMinutes = shiftCurrent.start // set to shift start
            }
        } catch (err) {
            console.log(err)
        } finally {
        }
    })()


