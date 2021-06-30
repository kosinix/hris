/**
 * Insert employees.
 * Usage: node scripts/install-employees.js
 */
//// Core modules
const fs = require('fs');
const path = require('path');

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


(async () => {
    try {
        let results = []
        fs.createReadStream(CONFIG.app.dir + '/scripts/install-data/employees-june2021.csv', {
            encoding: 'binary',
            mapValues: ({ header, index, value }) => value.trim()
        })
            .pipe(csvParser())
            .on('data', (data) => {
                if (data.name) {
                    let names = data.name.split(',')
                    let middle = ''
                    let first = names[1]
                    if (first) {
                        first = first.trim()
                        let index = first.search(/([A-Z]\.){1}$/) // If middle initial present
                        if (index > -1) {
                            middle = first.slice(index)
                            first = first.slice(0, index)
                            first = first.trim()
                        }
                    }
                    let last = names[0]
                    if (last) {
                        last = last.trim()
                    }

                    let momentNow = moment().toDate()
                    data.employee = {
                        "firstName": first,
                        "middleName": middle,
                        "lastName": last,
                        "suffix": "",
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
                // await db.main.Employee.deleteMany()
                // await db.main.Employment.deleteMany()

                let addedEmployees = []
                let ignoreEmployees = []
                for (let i = 0; i < results.length; i++) {
                    let entry = results[i]
                    let e = await db.main.Employee.findOne({
                        lastName: new RegExp(`^${entry.employee.lastName}$`, "i"),
                        firstName: new RegExp(`^${entry.employee.firstName}$`, "i"),
                    })
                    if (!e) {
                        e = new db.main.Employee(entry.employee)
                        addedEmployees.push(entry.name)
                        await e.save()
                    } else {
                        ignoreEmployees.push(entry.name)
                    }
                }
                console.log(`${addedEmployees.length} employee(s) added.`)
                console.log(`${ignoreEmployees.length} employee(s) ignored as they already exist. ${ignoreEmployees.join(' | ')}`)

                db.main.close();

                // fs.writeFileSync(CONFIG.app.dir + '/scripts/install-data/out.json', JSON.stringify(results), { encoding: 'utf8' })
            });

    } catch (err) {
        console.log(err)
    } finally {

    }
})()


