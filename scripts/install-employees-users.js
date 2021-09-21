/**
 * Create employees user accnt.
 * Usage: node scripts/install-employees-users.js
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


;(async () => {
    try {
        let csvRows = []
        csvRows.push('"username", "password"')
        let employees = await db.main.Employee.find()
        let total = 0;
        for(let x = 0; x < employees.length; x++){

            let o = employees[x]
            let password = passwordMan.randomString(8)
            let salt = passwordMan.randomString(16)
            let passwordHash = passwordMan.hashPassword(password, salt)
            let firstNames = o.firstName.split(' ')
            let firstName = lodash.toLower(firstNames.shift())
            if(firstName === 'ma.'){
                firstName = lodash.toLower(firstNames.shift()) // second name
            }
            let lastName = o.lastName.replace(/ /g, '') // remove spaces for maam josephine "de asis"
            let username = lodash.toLower(`${lastName}`)+'.'+lodash.toLower(`${firstName}`)
            let user = new db.main.User({
                passwordHash: passwordHash,
                salt: salt,
                roles: ["employee"],
                firstName: o.firstName,
                middleName: o.middleName,
                lastName: lastName,
                email: '',
                username: username,
                active: true,
                permissions: [],
            });
            csvRows.push(`"${username}", "${password}"`)
            await user.save()
            o.userId = user._id
            await o.save()
            total++
        }
        
        let loginsFile = CONFIG.app.dir + '/scripts/install-data/logins.csv'
        console.log(`Inserted ${total} users - See '${loginsFile}'`)

        csvRows = csvRows.join("\n")

        fs.writeFileSync(loginsFile, csvRows, { encoding: 'utf8' })

    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


