/**
 * Create employees user accnt.
 * Usage: node scripts/install-employees-users.js
 */
//// Core modules
const fs = require('fs');
const path = require('path');

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
        
        let results = []
        let employees = await db.main.Employee.find()
        let promises = employees.map((o)=>{
            let password = passwordMan.randomString(8)
            let salt = passwordMan.randomString(16)
            let passwordHash = passwordMan.hashPassword(password, salt)
            let firstNames = o.firstName.split(' ')
            let firstName = lodash.toLower(firstNames.shift())
            if(firstName === 'ma.'){
                firstName = lodash.toLower(firstNames.shift()) // second name
            }
            let username = lodash.toLower(`${o.lastName}`)+'.'+lodash.toLower(`${firstName}`)
            let user = new db.main.User({
                passwordHash: passwordHash,
                salt: salt,
                roles: ["employee"],
                firstName: o.firstName,
                middleName: o.middleName,
                lastName: o.lastName,
                email: username,
                active: true,
                permissions: [],
            });
            
            console.log(`Inserting "${o.lastName}, ${o.firstName}" - "${username}" - "${password}"...`)
            return user.save()
        })
        let users = await Promise.all(promises)
        promises = employees.map((employee, i)=>{
            
                employee.userId = users[i]._id
                return employee.save()
        })
        await Promise.all(promises)


    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


