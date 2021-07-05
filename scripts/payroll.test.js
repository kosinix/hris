/**
 * Insert test attendance.
 * Usage: node scripts/payroll.test.js
 */
//// Core modules
const path = require('path');

//// External modules
const moment = require('moment');
const lodash = require('lodash');
const pigura = require('pigura');
const uuid = require('uuid');

//// Modules
const passwordMan = require('../data/src/password-man');
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

        let scanner = new db.main.Scanner({
            "name": 'Test Scanner',
            "campus": 'main',
            "userId": userId
        })
        await scanner.save()
        console.log(`Added scanner.`)

        let scannerId = scanner._id

        let attendances = []
        for (d = 1; d <= 15; d++) {
            let dateTime = moment().startOf('month').date(d)
            if (![0, 6].includes(dateTime.day())) {
                console.log(dateTime.toISOString(true))
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

        let r2 = await db.main.Attendance.insertMany(attendances)
        console.log(`Inserted ${r2.length} attendances...`)


        // Cleanup
        r = await db.main.Attendance.deleteMany({
            "employeeId": employeeId,
        })
        console.log(`Deleted ${r.deletedCount} attendances...`)

        await employee.remove()
        await employment.remove()
        await user.remove()
        await scanner.remove()
    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


