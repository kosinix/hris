/**
 * Fix Admin Aide in employments.
 * Usage: node scripts/install-employments-fix.js
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

                let positionsRestored = []
                for (let i = 0; i < results.length; i++) {
                    let entry = results[i]
                    let e = await db.main.Employee.findOne({
                        lastName: new RegExp(`^${entry.lastName}$`, "i"),
                        firstName: new RegExp(`^${entry.firstName}`, "i"),
                    })
                    if (e) {
                        let position = entry.position.trim()
                        position = utils.normalizePositions(position)

                        let emps = await db.main.Employment.find({
                            employeeId: e._id,
                            position: 'Administrative Aide',
                        })
                        if (emps.length > 0) {
                            for (let x = 0; x < emps.length; x++) {
                                let emp = emps[x]
                                positionsRestored.push(`${entry.lastName} restored from ${emp.position} to ${position}`)
                            }
                        }
                    }
                }
                positionFileRes = CONFIG.app.dir + '/scripts/install-data/employees-positions-restored.log'

                console.log(`${positionsRestored.length} position(s) restored. See "${positionFileRes}""`)

                db.main.close();

                fs.writeFileSync(positionFileRes, positionsRestored.join("\n"), { encoding: 'utf8' })
            });

    } catch (err) {
        console.log(err)
    } finally {

    }
})()


