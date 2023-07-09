/**
 * Clear options collection and insert options.
 * Usage: node scripts/install-options.js
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
let optionsList = require('./install-data/options-list'); // Do not remove semi-colon


(async ()=>{
    try {

        console.log('Clearing options collection...')

        await db.main.Option.deleteMany()
        let promises = lodash.map(optionsList, (o)=>{
            let option = new db.main.Option({
                key: o.key,
                name: o.name,
                value: o.value,
            });
            console.log(`Inserting "${o.key}" ...`)
            return option.save()
        })
        await Promise.all(promises)
        console.log(`Inserted ${promises.length} options.`)

    } catch (err) {
        console.log('Rolling back options collection...')
        await db.main.Option.deleteMany()
    } finally {
        db.main.close();
    }
})()

