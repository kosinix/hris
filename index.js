/**
 * Load configuration and credentials depending on environment.
 * Load server module.
 */

//// Core modules
const path = require('path');

//// External modules
const lodash = require('lodash');

//// Modules
const pigura = require('pigura');
const packageJson = require('./package.json');

//// First things first
//// Save full path of our root app directory and load config and credentials
global.APP_DIR = path.resolve(__dirname).replace(/\\/g, '/'); // Turn back slash to slash for cross-platform compat
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
global.PACKAGE_JSON = packageJson

//// Create our app
require('./data/src/server')