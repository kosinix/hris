/**
 * Clear role collection and insert permissions
 * Usage: node scripts/install-permissions.js
 */
//// Core modules
const path = require('path');

//// External modules
const lodash = require('lodash');
const pigura = require('pigura');

//// Modules


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
let permissionList = require('./install-data/permissions-list'); // Do not remove semi-colon

(async ()=>{
    try {
        console.log('Clearing permissions collection...')

        await db.main.Permission.deleteMany()
        let promises = lodash.map(permissionList, (p) => {
            let permission = new db.main.Permission({
                key: p,
            });
            console.log(`Inserting "${p}" ...`)
            return permission.save()
        })
        await Promise.all(promises)
        console.log(`Inserted ${promises.length} permissions.`)

    } catch (err) {
        console.log('Rolling back permissions collection...')
        await db.main.Permission.deleteMany()
    } finally {
        db.main.close();
    }
})()


