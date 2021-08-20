/**
 * Test.
 * Usage: node scripts/test.list.test.js
 */
//// Core modules
const path = require('path');

//// External modules
const moment = require('moment');
const lodash = require('lodash');
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


; (async () => {
    try {
        let employments = await db.main.Employment.find().limit(5).lean()
        let employees = employments.map((e) => {
            return db.main.Employee.findById(e.employeeId).lean()
        })
        employees = await Promise.all(employees)

        let members = employments.map((e, i) => {
            return {
                employeeId: e.employeeId,
                employmentId: e._id,
                firstName: employees[i].firstName,
                middleName: employees[i].middleName,
                lastName: employees[i].lastName,
                suffix: employees[i].suffix,
                position: e.position,
            }
        })

        await db.main.EmployeeList.create({
            name: 'Permanent',
            members: members
        })

    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


