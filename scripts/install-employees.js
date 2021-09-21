/**
 * Insert employees.
 * Usage: 
 * 
 * Install employees
 *      node scripts/install-employees.js
 * 
 * Drop employees and employments and install employees
 * 
 *      node scripts/install-employees.js reset
 */
//// Core modules
const fs = require('fs');
const path = require('path');
const process = require('process');

//// External modules
const csvParser = require('csv-parser')
const csvStringify = require('csv-stringify')
const lodash = require('lodash');
const moment = require('moment');
const pigura = require('pigura');
const uuid = require('uuid');

//// Modules
const passwordMan = require('../data/src/password-man');
const uid = require('../data/src/uid');
const utils = require('../data/src/utils');


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
        // param
        let isReset = lodash.toString(process.argv[2]).trim()

        let results = []
        fs.createReadStream(CONFIG.app.dir + '/scripts/install-data/employees-2021-06.csv', {
            encoding: 'binary',
            mapValues: ({ header, index, value }) => value.trim()
        })
            .pipe(csvParser())
            .on('data', (data) => {
                if (data.name) {
                    let names = utils.splitName(data.name)

                    let momentNow = moment().toDate()
                    data.employee = {
                        "firstName": names.first,
                        "middleName": names.middle,
                        "lastName": names.last,
                        "suffix": "",
                        "mobileNumber": "",
                        // "emailVerified": false,
                        // "mobileNumberVerified": false,
                        "addresses": [],
                        "employments": [],
                        "families": [],
                        "documents": [],
                        "createdAt": momentNow,
                        "updatedAt": momentNow,
                        "uuid": uuid.v4(),
                        "uid": uid.gen(),
                        "group": data.group,
                        // custom: {
                        //     officeAssignment: data.officeAssignment,
                        //     college: data.college,
                        //     homeDepartment: data.homeDepartment
                        // }
                    }
                    results.push(data)
                }
            })
            .on('end', async () => {
                results.sort(function (a, b) {
                    var nameA = a.employee.lastName.toUpperCase(); // ignore upper and lowercase
                    var nameB = b.employee.lastName.toUpperCase(); // ignore upper and lowercase
                    if (nameA < nameB) {
                        return -1;
                    }
                    if (nameA > nameB) {
                        return 1;
                    }
                    // names must be equal
                    return 0;
                });

                // Reset
                if (isReset) {
                    let r = await db.main.Employee.deleteMany()
                    console.log(`Deleted ${r.deletedCount} employees...`)
                    r = await db.main.Employment.deleteMany()
                    console.log(`Deleted ${r.deletedCount} employments...`)
                    r = await db.main.User.deleteMany({
                        email: {
                            $nin: [
                                'hrmo@gsc.edu.ph',
                                'mis+checker@gsc.edu.ph'
                            ]
                        }
                    })
                    console.log(`Deleted ${r.deletedCount} users assoc with employees...`)
                }

                let addedEmployees = []
                let ignoreEmployees = []
                let positions = []
                for (let i = 0; i < results.length; i++) {
                    let entry = results[i]
                    let e = await db.main.Employee.findOne({
                        lastName: new RegExp(`^${entry.employee.lastName}$`, "i"),
                        firstName: new RegExp(`^${entry.employee.firstName}$`, "i"),
                    })
                    if (!e) {
                        await db.main.Employee.create(entry.employee)
                        addedEmployees.push(entry.name)
                    } else {
                        ignoreEmployees.push(entry.name)
                    }
                    let position = entry.position.trim()
                    position = utils.normalizePositions(position)
                    if (position) {
                        let found = positions.find((v) => {
                            let regex = new RegExp(`^${position}$`, "i")
                            return regex.test(v)
                        })
                        if (!found) {
                            positions.push(position)
                        }
                    }
                }

                positions.sort(function (a, b) {
                    var nameA = a.toUpperCase(); // ignore upper and lowercase
                    var nameB = b.toUpperCase(); // ignore upper and lowercase
                    if (nameA < nameB) {
                        return -1;
                    }
                    if (nameA > nameB) {
                        return 1;
                    }
                    // names must be equal
                    return 0;
                });

                addedFile = CONFIG.app.dir + '/scripts/install-data/employees-added.log'
                ignoredFile = CONFIG.app.dir + '/scripts/install-data/employees-ignored.log'
                positionFile = CONFIG.app.dir + '/scripts/install-data/employees-positions.log'
                console.log(`${addedEmployees.length} employee(s) added. See "${addedFile}""`)
                console.log(`${ignoreEmployees.length} employee(s) ignored as they already exist. See "${ignoredFile}""`)
                // console.log(`${positions.length} position(s) added. See "${positionFile}""`)

                db.main.close();

                fs.writeFileSync(addedFile, addedEmployees.join("\n"), { encoding: 'utf8' })
                fs.writeFileSync(ignoredFile, ignoreEmployees.join("\n"), { encoding: 'utf8' })
                fs.writeFileSync(positionFile, positions.join("\n"), { encoding: 'utf8' })
            });

    } catch (err) {
        console.log(err)
    } finally {

    }
})()


