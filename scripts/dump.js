/**
 * node scripts/dump.js
 *
 */
//// Core modules
const { promisify } = require('util')
const execAsync = promisify(require('child_process').exec)
const path = require('path')
const process = require('process')

//// External modules
const lodash = require('lodash')
const moment = require('moment')
const pigura = require('pigura')

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



    ; // Dont omit
(async () => {
    try {
        let result = await execAsync(`sudo mongodump --uri="mongodb://${CRED.mongodb.connections.admin.username}:${CRED.mongodb.connections.admin.password}@${CONFIG.mongodb.connections.main.host}/${CONFIG.mongodb.connections.main.db}?authSource=admin" --out=${CONFIG.app.dirs.upload}/dbdump_${moment().format('YYYYMMDD')} --gzip`,
        {
            cwd: `${CONFIG.mongodb.dir.bin}`,
        })
        console.log(result)
    } catch (err) {
        console.error(err)
    } finally {

    }
})()


