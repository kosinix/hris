/**
 * Use actual employees and add attendance
 * 
 * Usage: node scripts/attendance.actual.test.js
 */
//// Core modules
const path = require('path');
const fs = require('fs');
const util = require('util');

//// External modules
const moment = require('moment');
const lodash = require('lodash');
const pigura = require('pigura');
const uuid = require('uuid');

//// Modules
const passwordMan = require('../data/src/password-man');
const payrollCalc = require('../data/src/payroll-man');
const uid = require('../data/src/uid');


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
        let logs = []
        // 1. List of employees to use that are in db
        let list = [
            ['Cañete', 'Roland'],
            ['Concepcion', 'Mary'],
        ]
        // let testAttendances = [
        //     ['2021-06-01 08:00:00.000Z', '2021-06-01 08:00:00.000Z', '2021-06-01 08:00:00.000Z']
        // ]
        let lastNames = []
        let firstNames = []
        list.forEach((el) => {
            lastNames.push(new RegExp(`^${el[0]}`, "i"))
            firstNames.push(new RegExp(`^${el[1]}`, "i"))
        })
        let employees = await db.main.Employee.aggregate([
            {
                $match: {
                    $and: [
                        {
                            "lastName": {
                                $in: lastNames
                            },
                        },
                        {
                            "firstName": {
                                $in: firstNames
                            }
                        }
                    ]
                }
            },
            {
                $lookup: {
                    from: "employments",
                    localField: "_id",
                    foreignField: "employeeId",
                    as: "employments"
                }
            }
        ])
        // console.log(util.inspect(employees, false, null, true))

        if (employees.length <= 0) {
            throw new Error('No employees found.')
        }

        // 2. Use first found scanner
        let scanner = await db.main.Scanner.findOne()
        if (!scanner) {
            throw new Error('scanner not found.')
        }
        let scannerId = scanner._id

        // 3. Insert attendances
        let attendances = []
        for (d = 1; d <= 15; d++) {
            let dateTime = moment('2021-06-01').startOf('month').date(d)
            if (![0, 6].includes(dateTime.day())) { // Workdays only
                // console.log(dateTime.toISOString(true))
                employees.forEach((employee) => {
                    attendances.push({
                        "employeeId": employee._id,
                        "employmentId": employee.employments[0]._id,
                        "onTravel": false,
                        "logs": [
                            {
                                "scannerId": scannerId,
                                "dateTime": dateTime.clone().hour(8).minutes(0).toISOString(true),
                                "mode": 1
                            },
                            {
                                "scannerId": scannerId,
                                "dateTime": dateTime.clone().hour(12).minutes(0).toISOString(true),
                                "mode": 0
                            },
                            {
                                "scannerId": scannerId,
                                "dateTime": dateTime.clone().hour(13).minutes(0).toISOString(true),
                                "mode": 1
                            },
                            {
                                "scannerId": scannerId,
                                "dateTime": dateTime.clone().hour(17).minutes(0).toISOString(true),
                                "mode": 0
                            },
                        ],
                        createdAt: dateTime.clone().hour(8).minutes(0).toISOString(true),
                    })
                    
                    logs.push(`db.getCollection('attendances').remove({employeeId:ObjectId("${employee._id}")})`)

                })
            }
        }
        let r2 = await db.main.Attendance.insertMany(attendances)
        console.log(`Inserted ${r2.length} attendances into ${employees.length} employees...`)

        let employments = []
        employees.forEach((employee) => {
            employments.push({
                _id: employee.employments[0]._id,
                employeeId: employee.employments[0].employeeId,
            })
        })

        let payroll = await db.main.Payroll.create({
            name: 'June 1st Quincena',
            dateStart: '2021-06-01',
            dateEnd: '2021-06-15',
            employments: employments
        })
        console.log(`Payrolls...`)
        logs.push(`db.getCollection('payrolls').remove({_id:ObjectId("${payroll._id}")})`)

        
        file = CONFIG.app.dir + '/scripts/logs/attendance.actual.test.log'
        fs.writeFileSync(file, logs.join(";\n"), { encoding: 'utf8' })
        console.log(`Log file "${file}""`)
    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


