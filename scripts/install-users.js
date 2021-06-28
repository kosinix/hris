/**
 * Insert default users.
 * Usage: node scripts/install-users.js
 */
//// Core modules
const fs = require('fs');
const path = require('path');

//// External modules
const lodash = require('lodash');
const pigura = require('pigura');

//// Modules
const passwordMan = require('../data/src/password-man');


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
let adminsList = require('./install-data/users-list'); // Do not remove semi-colon


; (async () => {
    try {
        // await db.main.User.deleteMany()


        let csvRows = ['"username", "password"']
        let promises = lodash.map(adminsList, (o) => {
            let password = passwordMan.randomString(10)
            let salt = passwordMan.randomString(16)
            let passwordHash = passwordMan.hashPassword(password, salt)

            let user = new db.main.User({
                passwordHash: passwordHash,
                salt: salt,
                roles: o.roles,
                firstName: o.firstName,
                middleName: o.middleName,
                lastName: o.lastName,
                email: o.email,
                active: o.active,
                permissions: o.permissions,
            });
            csvRows.push(`"${o.email}", "${password}"`)
            console.log(`Inserting "${o.email}" ...`)
            return user.save()
        })
        await Promise.all(promises)
        console.log(`Inserted ${promises.length} users.`)
        csvRows = csvRows.join("\n")
        fs.writeFileSync(CONFIG.app.dir + '/scripts/install-data/logins-admin.csv', csvRows, { encoding: 'utf8' })

    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


