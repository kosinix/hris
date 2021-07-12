/**
 * Insert test attendance.
 * Usage: node scripts/attendance.test.js
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
        // Create employee
        let momentNow = moment().toDate()
        let employee = new db.main.Employee({
            "firstName": 'Juan',
            "middleName": 'G',
            "lastName": 'Cruz',
            "suffix": "Jr.",
            "mobileNumber": "",
            "emailVerified": false,
            "mobileNumberVerified": false,
            "addresses": [],
            "employments": [],
            "families": [],
            "documents": [],
            "createdAt": momentNow,
            "updatedAt": momentNow,
            "uuid": uuid.v4(),
            "uid": uid.gen(),
        })
        await employee.save()
        console.log(`Added employee.`)
        let employeeId = employee._id
        logs.push(`db.getCollection('employees').remove({_id:ObjectId("${employeeId}")})`)
        // Create employment
        let employment = new db.main.Employment({
            "employeeId": employeeId,
            "position": 'Programmer',
            "salary": 1000,
            "salaryType": 'daily',
            "campus": 'main',
            "group": 'staff',
            "employmentType": 'jo',
            "department": 'MIS',
            "fundSource": 'MIS',
        })
        await employment.save()
        console.log(`Added employment.`)

        let employmentId = employment._id
        logs.push(`db.getCollection('employments').remove({_id:ObjectId("${employmentId}")})`)

        // Create user
        let password = 'admin'
        let salt = passwordMan.randomString(16)
        let passwordHash = passwordMan.hashPassword(password, salt)
        let user = new db.main.User({
            passwordHash: passwordHash,
            salt: salt,
            roles: ["employee"],
            firstName: employee.firstName,
            middleName: employee.middleName,
            lastName: employee.lastName,
            email: 'cruz.juan',
            active: true,
            permissions: [],
        });
        await user.save()
        console.log(`Added user.`)

        let userId = user._id
        employee.userId = userId
        await employee.save()
        logs.push(`db.getCollection('users').remove({_id:ObjectId("${userId}")})`)

        let scanner = new db.main.Scanner({
            "name": 'Test Scanner',
            "campus": 'main',
            "userId": userId
        })
        await scanner.save()
        console.log(`Added scanner.`)

        let scannerId = scanner._id
        logs.push(`db.getCollection('scanners').remove({_id:ObjectId("${scannerId}")})`)

        let attendances = []
        for (d = 1; d <= 15; d++) {
            let dateTime = moment('2021-07-01').startOf('month').date(d)
            if (![0, 6].includes(dateTime.day())) {
                // console.log(dateTime.toISOString(true))
                attendances.push({
                    "employeeId": employeeId,
                    "employmentId": employmentId,
                    "onTravel": false,
                    "logs": [
                        {
                            "scannerId": scannerId,
                            "dateTime": dateTime.clone().hour(7).minutes(0).toISOString(true),
                            "mode": 1
                        },
                        {
                            "scannerId": scannerId,
                            "dateTime": dateTime.clone().hour(13).minutes(0).toISOString(true),
                            "mode": 0
                        },
                    ],
                    createdAt: dateTime.clone().hour(7).minutes(0).toISOString(true),
                })
            }
        }

        let r = await db.main.Attendance.deleteMany({
            "employeeId": employeeId,
        })
        console.log(`Deleted ${r.deletedCount} attendances...`)
        logs.push(`db.getCollection('attendances').remove({employeeId:ObjectId("${employeeId}")})`)

        let r2 = await db.main.Attendance.insertMany(attendances)
        console.log(`Inserted ${r2.length} attendances...`)

        //
        let payroll = await db.main.Payroll.create({
            name: 'July',
            dateStart: '2021-07-01',
            dateEnd: '2021-07-15',
            employments:[
                employment.toObject()
            ]
        })
        console.log(`Payrolls...`)
        logs.push(`db.getCollection('payrolls').remove({_id:ObjectId("${payroll._id}")})`)
        
        attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment(payroll.dateStart).startOf('day').toDate(),
                $lt: moment(payroll.dateEnd).endOf('day').toDate(),
            }
        }).lean()

        attendances = payrollCalc.attachDailyTime(attendances, hoursPerDay = 6)
        // console.log(util.inspect(attendances, false, null, true /* enable colors */))
        //
        file = CONFIG.app.dir + '/scripts/install-data/attendance.test.log'
        fs.writeFileSync(file, logs.join(";\n"), { encoding: 'utf8' })

        // r = await db.main.Attendance.deleteMany({
        //     "employeeId": employeeId,
        // })
        // console.log(`Deleted ${r.deletedCount} attendances...`)

        // await employee.remove()
        // await employment.remove()
        // await user.remove()
        // await scanner.remove()
        // await payroll.remove()
    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


