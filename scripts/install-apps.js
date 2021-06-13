/**
 * Insert default users.
 * Usage: node scripts/install-users.js
 */
//// Core modules
const path = require('path');

//// External modules
const lodash = require('lodash');
const pigura = require('pigura');

//// Modules
const passwordMan = require('../data/src/password-man');


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
let list = require('./install-data/apps-list'); // Do not remove semi-colon


(async ()=>{
    try {
        let promises = lodash.map(list, (o)=>{
            let app = new db.main.App({
                passwordHash: o.passwordHash,
                salt: o.salt,
                username: o.username,
                name: o.name,
                active: o.active,
            });

            console.log(`Inserting "${o.username}" ...`)
            return app.save()
        })
        await Promise.all(promises)
        console.log(`Inserted ${promises.length} apps.`)

    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


