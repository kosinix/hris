/**
 * Test.
 * Usage: node scripts/install-employee-lists.js
 */
//// Core modules
const path = require('path');
const process = require('process');

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
        // param
        let isReset = lodash.toString(process.argv[2]).trim()

        // Reset
        if (isReset) {
            let r = await db.main.EmployeeList.deleteMany()
            console.log(`Deleted ${r.deletedCount} Employee Lists...`)

        }

        // Permanent Faculty
        let employments = await db.main.Employment.find({
            group: 'faculty',
            employmentType: 'permanent',
        })
        let employees = employments.map((e) => {
            return db.main.Employee.findById(e.employeeId).lean()
        })
        employees = await Promise.all(employees)

        let members = employments.map((employment, i) => {
            return {
                employeeId: employment.employeeId,
                employmentId: employment._id,
                firstName: employees[i].firstName,
                middleName: employees[i].middleName,
                lastName: employees[i].lastName,
                suffix: employees[i].suffix,
                position: employment.position,
            }
        })

        await db.main.EmployeeList.create({
            name: 'Permanent Faculty',
            members: members
        })

        // Permanent Staff
        employments = await db.main.Employment.find({
            group: 'staff',
            employmentType: 'permanent',
        })
        employees = employments.map((e) => {
            return db.main.Employee.findById(e.employeeId).lean()
        })
        employees = await Promise.all(employees)

        members = employments.map((employment, i) => {
            return {
                employeeId: employment.employeeId,
                employmentId: employment._id,
                firstName: employees[i].firstName,
                middleName: employees[i].middleName,
                lastName: employees[i].lastName,
                suffix: employees[i].suffix,
                position: employment.position,
            }
        })

        await db.main.EmployeeList.create({
            name: 'Permanent Staff',
            members: members
        })

        // COS Staff
        employments = await db.main.Employment.find({
            group: 'staff',
            employmentType: 'cos',
        })
        employees = employments.map((e) => {
            return db.main.Employee.findById(e.employeeId).lean()
        })
        employees = await Promise.all(employees)

        members = employments.map((employment, i) => {
            if(!employees[i]){
                console.log(employment, i)
            }
            return {
                employeeId: employment.employeeId,
                employmentId: employment._id,
                firstName: employees[i].firstName,
                middleName: employees[i].middleName,
                lastName: employees[i].lastName,
                suffix: employees[i].suffix,
                position: employment.position,
            }
        })

        await db.main.EmployeeList.create({
            name: 'COS Staff',
            members: members
        })

        // COS Faculty
        employments = await db.main.Employment.find({
            group: 'faculty',
            employmentType: 'cos',
        })
        employees = employments.map((e) => {
            return db.main.Employee.findById(e.employeeId).lean()
        })
        employees = await Promise.all(employees)

        members = employments.map((employment, i) => {
            return {
                employeeId: employment.employeeId,
                employmentId: employment._id,
                firstName: employees[i].firstName,
                middleName: employees[i].middleName,
                lastName: employees[i].lastName,
                suffix: employees[i].suffix,
                position: employment.position,
            }
        })

        await db.main.EmployeeList.create({
            name: 'COS Faculty',
            members: members
        })

        // Part-time
        employments = await db.main.Employment.find({
            group: 'faculty',
            employmentType: 'part-time',
        })
        employees = employments.map((e) => {
            return db.main.Employee.findById(e.employeeId).lean()
        })
        employees = await Promise.all(employees)

        members = employments.map((employment, i) => {
            return {
                employeeId: employment.employeeId,
                employmentId: employment._id,
                firstName: employees[i].firstName,
                middleName: employees[i].middleName,
                lastName: employees[i].lastName,
                suffix: employees[i].suffix,
                position: employment.position,
            }
        })

        await db.main.EmployeeList.create({
            name: 'Part-time Teaching',
            members: members
        })

    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


