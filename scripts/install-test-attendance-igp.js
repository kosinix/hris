/**
 * Use actual employees and add attendance
 * 
 * Usage: node scripts/install-test-attendance-igp.js
 */
//// Core modules
const path = require('path');
const fs = require('fs');
const util = require('util');

//// External modules
const moment = require('moment');
const lodash = require('lodash');
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

const db = require('../data/src/db-install');


; (async () => {
    try {
        // June 1 - 15th IGP
        let dateStart = '2021-06-01'

        let logs = []
        // 1. List of employees to use that are in db
        let list = [
            ['Cañete', 'Roland', 10, 6, 56],
            ['Concepcion', 'Mary', 11],
            ['Gabito', 'Unicorne', 10, 6],
            ['Platigue', 'John Carlo', 11],
            ['Real', 'Joseph', 9, 3, 8],
            ['Tapangan', 'Lybert', 9, 6, 19]
        ]


        let lastNames = []
        let firstNames = []
        list.forEach((el) => {
            lastNames.push(new RegExp(`^${el[0]}`, "i"))
            firstNames.push(new RegExp(`^${el[1]}`, "i"))
        })

        let promises = list.map((el) => {
            return db.main.Employee.findOne({
                lastName: new RegExp(`^${el[0]}`, "i"),
                firstName: new RegExp(`^${el[1]}`, "i"),
            }).lean()
        })
        let employees = await Promise.all(promises)

        let missing = []
        employees.forEach((el, i) => {
            if (el === null) {
                missing.push(list[i][0])
            }
        })
        if (missing.length > 0) {
            throw new Error(`${missing.length} employee(s) not found: ${missing.join(', ')}`)
        }


        promises = employees.map((el, i) => {
            // Employee might have more than 1 employment. We use the first result found.
            return db.main.Employment.findOne({
                employeeId: el._id
            }).lean()
        })
        let employments = await Promise.all(promises)

        missing = []
        employments.forEach((el, i) => {
            if (el === null) {
                missing.push(list[i][0])
            }
        })
        if (missing.length > 0) {
            throw new Error(`Employee Employment not found: ${missing.join(', ')}`)
        }

        // console.log(util.inspect(employments, false, null, true))

        // 2. Use first found scanner
        let scanner = await db.main.Scanner.findOne()
        if (!scanner) {
            throw new Error('scanner not found.')
        }
        let scannerId = scanner._id

        // 3. Insert test attendances
        let attendances = []
        employees.forEach((employee, i) => {
            let days = lodash.get(list, `${i}.2`, 0)
            let hours = lodash.get(list, `${i}.3`, 0)
            let minutes = lodash.get(list, `${i}.4`, 0)
            let employment = employments[i]

            let dayCount = 0
            let breakFree = false
            for (d = 1; d <= 15; d++) {
                let dateTime = moment(dateStart).startOf('month').date(d)

                if (![0, 6].includes(dateTime.day())) { // Workdays only
                    let inAM = null
                    let outAM = null
                    let inPM = null
                    let outPM = null

                    if (dayCount < days) {
                        inAM = dateTime.clone().hour(8).minutes(0).toISOString(true)
                        outAM = dateTime.clone().hour(12).minutes(0).toISOString(true)
                        inPM = dateTime.clone().hour(13).minutes(0).toISOString(true)
                        outPM = dateTime.clone().hour(17).minutes(0).toISOString(true)
                        dayCount++
                    } else {
                        if (hours >= 5) {
                            inAM = dateTime.clone().hour(8).minutes(0).toISOString(true)
                            outAM = dateTime.clone().hour(12).minutes(0).toISOString(true)
                            inPM = dateTime.clone().hour(13).minutes(0).toISOString(true)
                            outPM = dateTime.clone().hour(13).minutes(0).add(hours - 4, 'hours').add(minutes, 'minutes').toISOString(true)
                        } else {
                            inAM = dateTime.clone().hour(8).minutes(0).toISOString(true)
                            outAM = dateTime.clone().hour(8).minutes(0).clone().add(hours, 'hours').add(minutes, 'minutes').toISOString(true)
                        }
                        breakFree = true
                    }

                    attendances.push({
                        "employeeId": employee._id,
                        "employmentId": employment._id,
                        "onTravel": false,
                        "wfh": false,
                        "logs": [
                            {
                                "scannerId": scannerId,
                                "dateTime": inAM,
                                "mode": 1
                            },
                            {
                                "scannerId": scannerId,
                                "dateTime": outAM,
                                "mode": 0
                            },
                            {
                                "scannerId": scannerId,
                                "dateTime": inPM,
                                "mode": 1
                            },
                            {
                                "scannerId": scannerId,
                                "dateTime": outPM,
                                "mode": 0
                            },
                        ],
                        createdAt: inAM,
                    })

                    logs.push(`db.getCollection('attendances').remove({employeeId:ObjectId("${employee._id}")})`)
                    if (breakFree) {
                        break;
                    }
                }
            }
        })
        let insertedAttendances = await db.main.Attendance.insertMany(attendances)
        console.log(`Inserted ${insertedAttendances.length} attendances into ${employees.length} employees...`)
        
        file = CONFIG.app.dir + '/logs/attendance-igp.log'
        fs.writeFileSync(file, logs.join(";\n"), { encoding: 'utf8' })
        console.log(`Log file "${file}"`)

    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


