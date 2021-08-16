/**
 * Use actual employees and add attendance
 * 
 * Usage: node scripts/install-payroll-igp.js
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
const dtrHelper = require('../data/src/dtr-helper')
const uid = require('../data/src/uid')
const formulas = require('../data/src/formulas').cos

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
        let payrollName = 'July 15th IGP'
        let dateStart = '2021-07-01'
        let dateEnd = '2021-07-15'

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

        let rows = employments.map((employment, i) => {
            let employee = employees[i]
            return {
                uid: uid.gen(),
                type: 1,
                employment: employment,
                employee: employee,
                timeRecord: {},
                cells: [
                    {
                        columnUid: 'tax3',
                        value: 0
                    },
                    {
                        columnUid: 'tax10',
                        value: 0
                    },
                    {
                        columnUid: 'contributionSss',
                        value: 0
                    },
                    {
                        columnUid: 'ecSss',
                        value: 0
                    }
                ],
                attendances: [],
            }
        })

        for (let x = 0; x < rows.length; x++) {
            let row = rows[x]

            // Get attendances based on payroll date range
            let attendances = await db.main.Attendance.find({
                employmentId: row.employment._id,
                createdAt: {
                    $gte: moment(dateStart).startOf('day').toDate(),
                    $lt: moment(dateEnd).endOf('day').toDate(),
                }
            }).lean()

            // Attach computed values
            let totalMinutes = 0
            let totalMinutesUnderTime = 0
            for (let a = 0; a < attendances.length; a++) {
                let attendance = attendances[a] // daily
                let dtr = dtrHelper.calcDailyAttendance(attendance, 8, 480)
                totalMinutes += dtr.totalMinutes
                totalMinutesUnderTime += dtr.underTimeTotalMinutes
                attendances[a].dtr = dtr
            }

            row.timeRecord = dtrHelper.getTimeBreakdown(totalMinutes, totalMinutesUnderTime, 8)
            row.attendances = attendances

        }

        // 4. Insert Payroll
        let columns =  [
            {
                uid: 'fundSource',
                title: 'Fund',
                computed: true,
            },
            {
                uid: 'name',
                title: 'Name',
                computed: true,
            },
            {
                uid: 'position',
                title: 'Position',
                computed: true,
            },
            {
                uid: 'basePay',
                title: 'Salary',
                computed: true,
            },
            {
                uid: 'attendance',
                title: 'Time worked',
                computed: true,
            },
            {
                uid: 'amountWorked',
                title: 'Gross Pay',
                computed: true,
            },
            {
                uid: '5Premium',
                title: '5% Premium',
                computed: true,
            },
            {
                uid: 'grossPay',
                title: 'Total',
                computed: true,
            },
            {
                uid: 'tax3',
                title: '3% Tax',
                computed: false,
            },
            {
                uid: 'tax10',
                title: '10% Tax',
                computed: false,
            },
            {
                uid: 'totalTax',
                title: 'Total Tax',
                computed: true,
            },
            {
                uid: 'contributionSss',
                title: 'Contribution',
                computed: false,
            },
            {
                uid: 'ecSss',
                title: 'EC',
                computed: false,
            },
            {
                uid: 'totalSss',
                title: 'Total SSS',
                computed: true,
            },
            {
                uid: 'totalDeductions',
                title: 'Total Deductions',
                computed: true,
            },
            {
                uid: 'netPay',
                title: 'Net Amnt ',
                computed: true,
            },
        ]
        let payroll = {
            name: payrollName,
            dateStart: dateStart,
            dateEnd: dateEnd,
            rows: rows,
            columns: columns,
            template: 'cos_staff',
        }

        payroll = await db.main.Payroll.create(payroll)

        console.log(`Payrolls...`)
        logs.push(`db.getCollection('payrolls').remove({_id:ObjectId("${payroll._id}")})`)

        file = CONFIG.app.dir + '/scripts/logs/payroll-igp.log'
        fs.writeFileSync(file, logs.join(";\n"), { encoding: 'utf8' })
        console.log(`Log file "${file}"`)

    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


