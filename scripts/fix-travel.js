/**
 * Usage: node scripts/fix-travel.js
 */
//// Core modules
const path = require('path');

//// External modules
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
        let ats = await db.main.AuthorityToTravel.find().lean()
        let promises = ats.map((a, i) => {
            let controlNumber = a.controlNumber
            controlNumber = controlNumber.replace(' (Online)', '')
            let parts = controlNumber.split('-')
            let prefix = `${parts[0]}-${parts[1]}` // 2022-01-
            let newCtrl = prefix + '-' + new String(i + 1).padStart(3, '0') + ' (Online)'
            return db.main.AuthorityToTravel.updateOne({ _id: a._id },
                {
                    controlNumber: newCtrl,
                    controlNumberOld: a.controlNumber,
                }
            )
        })
        let result = await Promise.all(promises)
        console.log(result)
    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


