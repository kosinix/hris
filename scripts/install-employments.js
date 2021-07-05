/**
 * Insert employments.
 * Usage: node scripts/install-employments.js
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

//// Modules
const passwordMan = require('../data/src/password-man');
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
        fs.createReadStream(CONFIG.app.dir + '/scripts/install-data/employments-2021-06.csv', {
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
                        first = first.replace(/\s\s+/g, ' ') // Replace multi space with 1 space

                        let index = first.search(/([A-Z]\.){1}$/) // If middle initial present
                        if (index > -1) {
                            middle = first.slice(index)
                            first = first.slice(0, index)
                            first = first.trim()
                        }
                        index = first.search(' ') // If space present
                        if (index > -1) {
                            first = first.slice(0, index) // Get only first word of first name 
                            first = first.trim()
                        }
                    }
                    let last = names[0]
                    if (last) {
                        last = last.trim()
                    }

                    data.firstName = first
                    data.middleName = middle
                    data.lastName = last

                    results.push(data)
                }
            })
            .on('end', async () => {
                results.sort(function (a, b) {
                    var nameA = a.lastName.toUpperCase(); // ignore upper and lowercase
                    var nameB = b.lastName.toUpperCase(); // ignore upper and lowercase
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
                    let r = await db.main.Employment.deleteMany()
                    console.log(`Deleted ${r.deletedCount} employments...`)
                }

                let addedEmployments = []
                let ignoreEmployees = []
                let positions = []
                for (let i = 0; i < results.length; i++) {
                    let entry = results[i]
                    let e = await db.main.Employee.findOne({
                        lastName: new RegExp(`^${entry.lastName}$`, "i"),
                        firstName: new RegExp(`^${entry.firstName}`, "i"),
                    })
                    if (e) {
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
                        let emp = await db.main.Employment.findOne({
                            employeeId: e._id,
                            position: new RegExp(`^${position}`, "i"),
                        })
                        if (!emp) { // If position already exist, ignore
                            await db.main.Employment.create({
                                "employeeId": e._id,
                                "position": position,
                                "salary": entry.salary.replace(/,/g, ''),
                                "salaryType": entry.salaryType,
                                "campus": 'main',
                                "group": e.group,
                                "employmentType": entry.employmentType,
                                // "department": entry.department,
                                "fundSource": entry.fundSource,
                            })
                            addedEmployments.push(position)
                        }
                    } else {
                        console.log({
                            lastName: new RegExp(`^${entry.lastName}$`, "i"),
                            firstName: new RegExp(`^${entry.firstName}`, "i"),
                        })
                        ignoreEmployees.push(entry.name)
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

                addedFile = CONFIG.app.dir + '/scripts/install-data/employments-added.log'
                ignoredFile = CONFIG.app.dir + '/scripts/install-data/employees-employments-ignored.log'
                positionFile = CONFIG.app.dir + '/scripts/install-data/employees-positions2.log'
                console.log(`${addedEmployments.length} employment(s) added. See "${addedFile}""`)
                console.log(`${ignoreEmployees.length} employee(s) ignored as they are not found. See "${ignoredFile}""`)
                console.log(`${positions.length} position(s) added. See "${positionFile}""`)

                db.main.close();

                fs.writeFileSync(addedFile, addedEmployments.join("\n"), { encoding: 'utf8' })
                fs.writeFileSync(ignoredFile, ignoreEmployees.join("\n"), { encoding: 'utf8' })
                fs.writeFileSync(positionFile, positions.join("\n"), { encoding: 'utf8' })
            });

    } catch (err) {
        console.log(err)
    } finally {

    }
})()


