/**
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

    // const db = require('../data/src/db-install');


    ; (async () => {
        try {
            let ObjectId = (r) => r
            let ISODate = (r) => r

            // AM logged out within afternoon shift
            let attendance = {
                "_id": ObjectId("6149576037690619e03246de"),
                "employeeId": ObjectId("614937e277c6f30e50e70a11"),
                "employmentId": ObjectId("61493d06a11ba42d0cff5c66"),
                "onTravel": false,
                "logs": [
                    {
                        "_id": ObjectId("6149576037690619e03246df"),
                        "scannerId": ObjectId("6145ee7cba723d272c936f81"),
                        "dateTime": ISODate("2021-09-21T03:54:00.516Z"),
                        "mode": 1
                    },
                    {
                        "_id": ObjectId("61495d3fcf6a97370418adb9"),
                        "scannerId": ObjectId("6145ee7cba723d272c936f81"),
                        "dateTime": ISODate("2021-09-21T06:19:00.589Z"),
                        "mode": 0
                    },
                    {
                        "scannerId": ObjectId("6145ee7cba723d272c936f81"),
                        "dateTime": ISODate("2021-09-21T07:00:11.589Z"),
                        "mode": 1
                    },
                    {
                        "scannerId": ObjectId("6145ee7cba723d272c936f81"),
                        "dateTime": ISODate("2021-09-21T09:19:11.589Z"),
                        "mode": 0
                    }
                ],
                "createdAt": ISODate("2021-09-21T03:54:08.527Z")
            }
            
            let dtr = dtrHelper.calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints)
            if (dtr.totalMinutes !== 205) {
                console.log(new Error(`totalMinutes must be 205, got ${dtr.totalMinutes}`))
            } else {
                console.log('Ok')
            }

            // AM logout on lunch break
            attendance = {
                "_id": ObjectId("6149576037690619e03246de"),
                "employeeId": ObjectId("614937e277c6f30e50e70a11"),
                "employmentId": ObjectId("61493d06a11ba42d0cff5c66"),
                "onTravel": false,
                "logs": [
                    {
                        "_id": ObjectId("6149576037690619e03246df"),
                        "scannerId": ObjectId("6145ee7cba723d272c936f81"),
                        "dateTime": ISODate("2021-09-21T03:54:00.516Z"),
                        "mode": 1
                    },
                    {
                        "_id": ObjectId("61495d3fcf6a97370418adb9"),
                        "scannerId": ObjectId("6145ee7cba723d272c936f81"),
                        "dateTime": ISODate("2021-09-21T04:19:00.589Z"),
                        "mode": 0
                    },
                    {
                        "scannerId": ObjectId("6145ee7cba723d272c936f81"),
                        "dateTime": ISODate("2021-09-21T05:00:11.589Z"),
                        "mode": 1
                    },
                    {
                        "scannerId": ObjectId("6145ee7cba723d272c936f81"),
                        "dateTime": ISODate("2021-09-21T09:19:11.589Z"),
                        "mode": 0
                    }
                ],
                "createdAt": ISODate("2021-09-21T03:54:08.527Z")
            }
            
            dtr = dtrHelper.calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints)
            if (dtr.totalMinutes !== 246) {
                console.log(new Error(`totalMinutes must be 246, got ${dtr.totalMinutes}`))
            } else {
                console.log('Ok')
            }
        } catch (err) {
            console.log(err)
        } finally {
            // db.main.close()
        }
    })()


