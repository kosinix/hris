/**
 * node scripts/install-biometrics.js
 */
//// Core modules
const fs = require('fs');
const path = require('path');
const process = require('process');

//// External modules
const csvParser = require('csv-parser')
const lodash = require('lodash');
const moment = require('moment');
const pigura = require('pigura');
const uuid = require('uuid');

//// Modules
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



    ; (async () => {
        try {
            // param
            let isReset = lodash.toString(process.argv[2]).trim()

            let results = []


            fs.createReadStream(`${CONFIG.app.dir}/scripts/install-data/biometrics.csv`, {
                encoding: 'utf8',
                mapValues: ({ header, index, value }) => value.trim()
            })
                .pipe(csvParser())
                .on('data', (data) => {
                    if (data['Biometrics ID']) {
                        // console.log(data['Name'], data['Biometrics ID'])
                        let names = data['Name'].split(',')
                        let lastName = names.at(0).trim()
                        let firstName = names.at(1).trim()
                        results.push({
                            lastName: lastName,
                            firstName: firstName,
                            biometricsId: parseInt(data['Biometrics ID']),
                        })


                    }
                })
                .on('end', async () => {
                    const db = require('../data/src/db-install');

                    let ok = []
                    let not = []
                    for (let x = 0; x < results.length; x++) {
                        let employee = results[x]
                        let e = await db.main.Employee.findOne({
                            lastName: new RegExp(`^${employee.lastName}$`, "i"),
                            firstName: new RegExp(`^${employee.firstName}$`, "i"),
                        })
                        if (e) {
                            ok.push(`${employee.firstName} ${employee.lastName} ${employee.biometricsId}`)
                            e.biometricsId = employee.biometricsId
                            await e.save()
                            // console.log(e)
                            // console.log('ok', employee.firstName, employee.lastName, employee.biometricsId)

                        } else if (!e){
                            not.push(`${employee.firstName} ${employee.lastName} ${employee.biometricsId}`)
                            // console.log(employee.firstName, employee.lastName)
                        }
                    }
                    console.log('ok', ok.length, 'not', not.length)
                    console.log(not)
                    db.main.close()

                    // fs.writeFileSync(`${CONFIG.app.dir}/scripts/install-data/biometrics2.csv`, not.join("\n"), {encoding:'utf8'})
                    // console.log(results)
                });

        } catch (err) {
            console.log(err)
        } finally {
        }
    })()


