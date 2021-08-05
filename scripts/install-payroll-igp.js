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
        let list = [['Cañete', 'Roland'],
        ['Concepcion', 'Mary'],
        ['Gabito', 'Unicorne'],
        ['Platigue', 'John Carlo'],
        ['Real', 'Joseph'],
        ['Tapangan', 'Lybert']]

        let lastNames = []
        let firstNames = []
        list.forEach((el) => {
            lastNames.push(new RegExp(`^${el[0]}`, "i"))
            firstNames.push(new RegExp(`^${el[1]}`, "i"))
        })

        let promises = []
        list.forEach((el) => {
            promises.push(db.main.Employee.findOne({
                lastName: new RegExp(`^${el[0]}`, "i"),
                firstName: new RegExp(`^${el[1]}`, "i"),
            }).lean())
        })
        let employees = await Promise.all(promises)

        employees = employees.filter((el) => {
            return el !== null
        })

        promises = []
        employees.forEach((el, i) => {
            promises.push(db.main.Employment.find({
                employeeId: el._id
            }).lean())
        })

        let employments = await Promise.all(promises)
        employees = employees.map((el, i) => {
            el.employments = employments[i]
            return el
        })
       
        console.log(util.inspect(employments, false, null, true))

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
            let dateTime = moment('2021-07-01').startOf('month').date(d)
            if (![0, 6].includes(dateTime.day())) { // Workdays only
                // console.log(dateTime.toISOString(true))
                employees.forEach((employee) => {
                    if (lodash.has(employee, 'employments.0')) {
                        let inAM = dateTime.clone().hour(8).minutes(15).toISOString(true)
                        if(employee.firstName === 'Sol' && d === 15){
                            inAM = dateTime.clone().hour(8).minutes(16).toISOString(true)//16 min late
                        }
                        attendances.push({
                            "employeeId": employee._id,
                            "employmentId": employee.employments[0]._id,
                            "onTravel": false,
                            "logs": [
                                {
                                    "scannerId": scannerId,
                                    "dateTime": inAM,
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
                    }
                })
            }
        }
        let r2 = await db.main.Attendance.insertMany(attendances)
        console.log(`Inserted ${r2.length} attendances into ${employees.length} employees...`)

        employments = []
        employees.forEach((employee) => {
            if (lodash.has(employee, 'employments.0')) {
                employments.push({
                    _id: employee.employments[0]._id,
                    employeeId: employee.employments[0].employeeId,
                })
            }
        })

        // 4. Insert Payroll
        let payroll = await db.main.Payroll.create({
            name: 'July 15th IGP',
            dateStart: '2021-07-01',
            dateEnd: '2021-07-15',
            employments: employments,
            incentives: [
                {
                    "name": "5% Premium",
                    "type": "percentage",
                    "percentage": 5,
                    "percentOf": "amountWorked",
                    "initialAmount": 0,
                    "_id": db.mongoose.Types.ObjectId(),
                    "uid": lodash.camelCase("5% Premium")
                }
            ],
            deductions: [
                {
                    
                    uid: '3Tax',
                    name: '3 %',
                    mandatory: true,
                    deductionType: 'normal',
                    initialAmount: 0,
                    groupName: 'Tax'
                },
                {
                    
                    uid: '10Tax',
                    name: '10 %',
                    mandatory: true,
                    deductionType: 'normal',
                    initialAmount: 0,
                    groupName: 'Tax'
                },
                {
                    
                    uid: 'contributionSSS',
                    name: 'Contribution',
                    mandatory: true,
                    deductionType: 'normal',
                    initialAmount: 0,
                    groupName: 'SSS'
                },
                {
                    
                    uid: 'ecSSS',
                    name: 'EC',
                    mandatory: true,
                    deductionType: 'normal',
                    initialAmount: 0,
                    groupName: 'SSS'
                }
            ],
            template: 'cos_staff',
        })
        console.log(`Payrolls...`)
        logs.push(`db.getCollection('payrolls').remove({_id:ObjectId("${payroll._id}")})`)

        file = CONFIG.app.dir + '/scripts/logs/payroll-igp.log'
        fs.writeFileSync(file, logs.join(";\n"), { encoding: 'utf8' })
        console.log(`Log file "${file}""`)
    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


