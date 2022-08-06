/**
 * Usage: node scripts/segment.test.js
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

const db = require('../data/src/db');




    ; // Do not omit
(async () => {
    try {

        let attendance = await db.main.Attendance.findById('629017ee6c0c003454173768').lean()
        let workSchedule = await db.main.WorkSchedule.findById(attendance.workScheduleId).lean()
        workSchedule = Object.fromEntries(Object.entries(workSchedule).filter(([key]) => !['_id'].includes(key))) // remove _id
        
        workScheduleTimeSegments = dtrHelper.getWorkScheduleTimeSegments(workSchedule, attendance.createdAt)

        // workScheduleTimeSegments = [
        //     {
        //         grace: 15,
        //         flexible: false,
        //         start: 450, // 7:30AM
        //         end: 720, // 12 PM
        //         // max: 270, // 4.5 hours
        //         breaks: []
        //     },
        //     {
        //         grace: 15,
        //         flexible: false,
        //         start: 750, // 12:30PM
        //         end: 1080, // 6:00PM
        //         // max: 330, // 5.5 hours
        //         breaks: [
        //             {
        //                 type: 'vacant',
        //                 start: 930, // 3:30pm
        //                 end: 1020, // 5pm
        //                 //max: 90 // 1.5
        //             }
        //         ]
        //     }
        // ]

        // Overtime
        workScheduleTimeSegments.push({
            name: "OT",
            grace: 0,
            flexible: false,
            start: workScheduleTimeSegments[workScheduleTimeSegments.length - 1].end,
            end: 1440, // 12 midnight
            breaks: []
        })

        let timeSegments = dtrHelper.buildTimeSegments(workScheduleTimeSegments)
        // console.dir(timeSegments, { depth: null })

        let logSegments = [
            {
                start: 494,
                end: 792,
            },
            {
                start: 758,
                end: 1339,
            },

        ]

        console.dir(dtrHelper.countWork(timeSegments, logSegments), { depth: null })
    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


