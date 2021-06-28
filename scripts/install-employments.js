/**
 * Insert employees.
 * Usage: node scripts/install-employments.js
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
        fs.createReadStream(CONFIG.app.dir + '/scripts/install-data/employees-employments.csv', { encoding: 'binary' })
            .pipe(csvParser())
            .on('data', (data) => {
                if (data.name) {
                    let names = data.name.split(',')
                    let middle = ''
                    let first = names[1]
                    let last = names[0]
                    if (first) {
                        first = first.trim()
                        let index = first.search(/([A-Z]\.){1}$/)
                        if (index > -1) {
                            middle = first.slice(index).trim()
                            first = first.slice(0, index).trim()
                        }
                    }
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
                let notFound = 0
                let promises = []
                results.forEach(async (o, i) => {
                    let e = await db.main.Employee.findOne({
                        lastName: new RegExp(o.lastName,"ig"),
                        firstName: new RegExp(o.firstName,"ig"),
                    })
                    if (e) {
                        let emplymnt = new db.main.Employment({
                            "employeeId": e._id,
                            "position": o.position,
                            "salary": o.salary.replace(/,/g, ''),
                            "salaryType": o.salaryType,
                            "campus": o.campus,
                            "group": o.group,
                            "employmentType": o.employmentType,
                            "department": o.fundSource,
                            "fundSource": o.fundSource,
                        })
                        promises.push(emplymnt.save())
                    } else {

                        console.log(`${++notFound} "${o.lastName}, ${o.firstName}" not found.`)
                    }
                    // x.employments[0]._id = new db.mongoose.Types.ObjectId()
                    // return x.save()
                })
                await Promise.all(promises)
                // db.main.close();
                // console.log(`${results.length} added`)
                // fs.writeFileSync(CONFIG.app.dir + '/scripts/install-data/out.json', JSON.stringify(results), { encoding: 'utf8' })
            });

    } catch (err) {
        console.log(err)
    } finally {

    }
})()


