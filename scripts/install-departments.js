/**
 * Usage: node scripts/install-departments.js
 */
//// Core modules
const path = require('path');

//// External modules
const lodash = require('lodash');

//// Modules
const pigura = require('pigura');


//// First things first
//// Save full path of our root app directory and load config and credentials
global.APP_DIR = path.resolve(__dirname+'/../').replace(/\\/g, '/'); // Turn back slash to slash for cross-platform compat
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


(async ()=>{
    try {
        const LIST = require('./install-data/departments-list'); // Do not remove semi-colon
        console.log('Clearing departments collection...')

        await db.main.Department.deleteMany()
        let promises = LIST.map((o)=>{
            let model = new db.main.Department({
                name: o.name,
                acronym: o.acronym,
                members: o.members,
            });
            console.log(`Inserting "${o.name}" ...`)
            return model.save()
        })
        await Promise.all(promises)
        console.log(`Inserted ${promises.length} rows.`)

    } catch (err) {
        console.log('Rolling back collection...')
        await db.main.Department.deleteMany()
    } finally {
        db.main.close();
    }
})()

