/**
 * Use actual employees and add attendance
 * 
 * Usage: node scripts/install-test-attendance-cos-faculty-part-time.js
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
        // June 1 - 15th stf
        let dateStart = '2021-06-01'

        let logs = []
        // 1. List of employees to use that are in db
        let list = [
            ['Andrade', 'Eula Mae', 9, 7],
            ['Bermejo', 'Ralph Gerald', 10],

            ['Brillantes', 'Kezia Joice', 10],
            ['Estalogo', 'Christine'],
            ['Germina', 'Luis', 10],
            ['Labra', 'Wenmar'],
            ['Monton', 'Gejette'],
            ['Morada', 'Nenita'],
            ['Ysulan', 'Charlie'],

            ['Ejar', 'Marin', 10],
            ['Hervilla', 'Ralph'],
            ['Occeña', 'Michael'],

            // part-timers
            ['Baylon', 'Neriza', 0, 45, 0, 'part-time'],
            ['Bermejo', 'Edzel', 0, 36, 45, 'part-time'],
            ['Cabagsican', 'Janet', 0, 0, 0, 'part-time'],
            ['Claudio', 'Mark', 0, 0, 0, 'part-time'],
            ['Dulaca', 'Janine', 0, 0, 0, 'part-time'],
            ['Dumadaog', 'Jella', 0, 0, 0, 'part-time'],
            ['Ellaga', 'Riza', 0, 0, 0, 'part-time'],
            ['Gabasa', 'Melajen', 0, 0, 0, 'part-time'],
            ['Gadian', 'Joshua', 0, 0, 0, 'part-time'],
            ['Gaje', 'Michael', 0, 0, 0, 'part-time'],
            ['Infante', 'Kim Adrian', 0, 0, 0, 'part-time'],
            ['Jimenez', 'Carel', 0, 0, 0, 'part-time'],
            ['Nava', 'Jeryl', 0, 0, 0, 'part-time'],
            ['Palerit', 'Jenny', 0, 0, 0, 'part-time'],
            ['Ronco', 'Keince', 0, 0, 0, 'part-time'],
            ['Simora', 'Noreen', 0, 0, 0, 'part-time'],

            ['Baguio', 'Perla', 0, 45, 0, 'part-time'],
            ['Baron', 'Keseiah', 0, 0, 0, 'part-time'],
            ['Chavez', 'Janice', 0, 0, 0, 'part-time'],
            ['Gaborno', 'Lian Jean', 0, 0, 0, 'part-time'],
            ['Gencianeo', 'Salvador', 0, 0, 0, 'part-time'],
            ['Hortinela', 'Phoenix', 0, 0, 0, 'part-time'],
            ['Junco', 'Marianne', 0, 0, 0, 'part-time'],
            ['Lachica', 'Anelyn', 0, 0, 0, 'part-time'],
            ['Mendez', 'Mario', 0, 0, 0, 'part-time'],
            ['Relano', 'Prudencio', 0, 0, 0, 'part-time'],
            ['Satajo', 'Janet', 0, 0, 0, 'part-time'],
            ['Ricablanca', 'June', 0, 0, 0, 'part-time'],
            ['Alameda', 'Jesseca', 0, 0, 0, 'part-time'],
            ['Floro', 'Reciel Jay', 0, 0, 0, 'part-time'],
            ['Gabayeron', 'Lovel', 0, 0, 0, 'part-time'],

            ['Cavan', 'Paulino', 5, 5, 0, 'part-time'],
            ['Dagoon', 'Salvador', 0, 0, 0, 'part-time'],
            ['Dusaban', 'Criscelen', 0, 0, 0, 'part-time'],
            ['Edang', 'Rommel', 0, 0, 0, 'part-time'],
            ['Elvas', 'Mark', 0, 0, 0, 'part-time'],
            ['Estember', 'Ahlie', 0, 0, 0, 'part-time'],
            ['Ferrer', 'Jefrey', 0, 0, 0, 'part-time'],
            ['Gonzales', 'Jonas', 0, 0, 0, 'part-time'],
            ['Hilarion', 'Roga', 0, 0, 0, 'part-time'],
            ['Junco', 'Tomas', 0, 0, 0, 'part-time'],
            ['Lagaña', 'Melvin', 0, 0, 0, 'part-time'],
            ['Lusaya', 'Angelino', 0, 0, 0, 'part-time'],
            ['Padilla', 'Jay', 0, 0, 0, 'part-time'],
            ['Parreño', 'Mark', 0, 0, 0, 'part-time'],
            ['Peremne', 'Rara', 0, 0, 0, 'part-time'],
            ['Balidiong', 'Madelyn', 0, 0, 0, 'part-time'],

            // ['Banez', 'Richard', 0, 45,  0, 'part-time'],
            ['Dador', 'Elvir', 0, 0, 0, 'part-time'],
            ['Estember', 'Rollin', 0, 0, 0, 'part-time'],
            ['Gallo', 'Alfred', 0, 0, 0, 'part-time'],
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
            // Employee might have more than 1 employment. We use the first result found....
            let criteria = {
                employeeId: el._id
            }
            // ... Unless criteria is provided
            let employmentType = lodash.get(list[i], `[5]`)
            if (employmentType) {
                lodash.set(criteria, 'employmentType', employmentType)
            }
            return db.main.Employment.findOne(criteria).lean()
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

        file = CONFIG.app.dir + '/logs/attendance-stf.log'
        fs.writeFileSync(file, logs.join(";\n"), { encoding: 'utf8' })
        console.log(`Log file "${file}"`)

    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


