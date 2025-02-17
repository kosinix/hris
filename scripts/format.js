/**
 * Insert employees.
 * Usage: 
 * 
 * Install employees
 *      node scripts/format.js
 *
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



    ; (async () => {
        try {
            // param
            let isReset = lodash.toString(process.argv[2]).trim()

            let results = []
            fs.createReadStream(CONFIG.app.dir + '/scripts/install-data/tmp.csv', {
                encoding: 'binary',
                mapValues: ({ header, index, value }) => value.trim()
            })
                .pipe(csvParser())
                .on('data', (data) => {
                    if (data.name) {
                        let names = utils.splitName(data.name, true)
                        results.push(`['${names.last}', '${names.first}']`)
                    }
                })
                .on('end', async () => {
                    let loginsFile = CONFIG.app.dir + '/scripts/install-data/format.log'
                    fs.writeFileSync(loginsFile, '[' + results.join(`,\n`) + ']', { encoding: 'utf8' })
                });

        } catch (err) {
            console.log(err)
        } finally {

        }
    })()


