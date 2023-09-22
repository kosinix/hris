/**
 * Adjust flag raising attendees to 4:30PM logout
 * Usage: node cron/flag-raising.js
 */

//// Core modules
const path = require('path')
const process = require('process')

//// External modules
const lodash = require('lodash')
const moment = require('moment')
const pigura = require('pigura')

//// Modules
const flagRaising = require('../data/src/flag-raising')


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

const dbModule = require('../data/src/db-connect');
let db = null; // Hold db here

; (async () => {
    try {
        db = await dbModule.connect()

        let date, rollback, rest
        [date, rollback, ...rest] = process.argv.slice(2)

        if (!date) {
            throw new Error('Missing date.')
        }
        rollback = rollback?.trim()
        if (rollback === 'true') {
            rollback = true
        } else if (rollback === 'false') {
            rollback = false
        } else {
            throw new Error('Invalid value for rollback.')
        }

        // 1. Schedules
        let schedule1 = await db.main.WorkSchedule.findOne({
            name: 'Regular Working Hours'
        }).lean()
        if (!schedule1) throw new Error('Could not find schedule 1')

        let schedule2 = await db.main.WorkSchedule.findOne({
            name: /Flag Raising Early Out/i
        }).lean()
        if (!schedule2) throw new Error('Could not find schedule 2')

        // Get candidates
        const flagAttendances = await flagRaising.getCandidates(db, date, schedule1, schedule2, rollback)
        const attendanceIds = flagAttendances.map(a => a.attendanceId)

        // Adjust
        let flashMessage = await flagRaising.adjustCandidates(db, 'gsc.mis.amarilla', attendanceIds, schedule1, schedule2, rollback)
       
        console.log(flashMessage)
    } catch (err) {
        console.error(err)
    } finally {
        db?.main?.close();
    }
})()


