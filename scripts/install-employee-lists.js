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
const findEmps = require('./find-emps');

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
            tags: ['Employment'],
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
            tags: ['Employment'],
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
            tags: ['Employment'],
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
            tags: ['Employment'],
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
            tags: ['Employment'],
            members: members
        })

        // STF

        let list = [
            ['Aleman', 'Ricyl', 10, 7, 40],
            ['Aliman-go', 'Ma. Siema', 11],
            ['Alminaza', 'Rhea Marie', 11],
            // ['Bojeador', 'Renzelle', 9, 5, 59],
            ['De la Torre', 'Jury', 10, 5],
            ['Fernandez', 'Arnold', 11],
            ['Gabales', 'Jannah Rubbie', 10, 6, 24],
            ['Gabito', 'Kristal Joy', 11],
            ['Galapin', 'Lenio', 10, 2, 51],
            ['Javellana', 'Amador', 11],
            ['Javellana', 'Vincent', 11],
            ['Mendoza', 'Lawrence', 9, 2, 51],
            ['Moreno', 'Christine Joy', 10, 2, 32],
            ['Padilla', 'Marian', 11],
            ['Ricablanca', 'June Rheo', 9, 7, 35],
            ['Sallegue', 'Cristy Love', 11],
            ['Socamo', 'Joso Rheam', 10],
            ['Uy', 'Wilmar', 11],
            ['Varona', 'Gerillyn', 9, 7, 25],
            ['Villagoniza', 'Vera'],
            ['Villarma', 'Janemar', 10, 3, 5],
            ['Alameda', 'Jesseca', 11],
            ['Borreros', 'Alfred', 10, 5, 51],
            ['Floro', 'Reciel Jay', 11],
            ['Gabayeron', 'Erwin', 10, 4, 30],
            ['Gabayeron', 'Lovel', 11],
            ['Gaitan', 'Denmark', 21, 4, 14],

            ['Iligan', 'Bernadil', 9, 5, 55],
            ['Namuag', 'Mylen', 11],
            ['Terrenal', 'Mark', 10, 7],

            ['Balidiong', 'Madelyn', 11],
            ['Malay', 'Julie', 10, 7, 30],
            ['Muya', 'Joel', 9, 1, 22],

            ['Fenequito', 'Shiela', 11],
            ['Tanaman', 'Maudy', 10, 4, 23],
            ['Villegas', 'Mynie', 11],

            ['Almayda', 'Jedmark', 10, 2, 11],
            ['Arnan', 'Jeffrey', 11],
            ['Bacuyani', 'Bernaldo', 10, 7, 43],
            ['Decomotan', 'Peres', 10, 6,],
            // ['De la Cruz', 'Larry', 10, 5, 13],
            ['Fernandez', 'Karen', 11],
            ['Fulgencio', 'Princess', 7, 2,],
            ['Ga', 'Bryan', 10, 7, 30],
            ['Gabitanan', 'Mark', 7, 7, 31],
            ['Germina', 'Nimrod', 11],
            ['Habaña', 'Dan', 11],
            ['Habaña', 'John', 11],
            ['Habaña', 'Kitt', 11],
            ['Huyan', 'Glenn', 10, 6, 57],
            ['Lampitoc', 'Joey', 10, 7,],
            ['Marilla', 'Roan', 10, 2, 44],
            ['Mucho', 'Chelmae', 11],
            ['Mucho', 'Willie', 10, 5, 32],
            ['Oja', 'Flosel', 11],
            ['Perales', 'Antonia', 7],
            ['Poñate', 'Marilou', 10, 2, 47],
            ['Sarabia', 'Cherry', 11],
            ['Sartorio', 'Jofre', 10, 4, 1],
            ['Tahum', 'Ian'],
            ['Ymalay', 'Julie', 11],

            ['Dayang', 'Hannah', 11],
            ['Esteves', 'Genelyn', 11],
            ['Garganera', 'Q.P.', 11],
            ['Sobremisana', 'Chyra', 11],
            ['Balvidadez', 'Marlon', 9, 5],

            ['Broces', 'Marjun', 8, 6, 48],
            ['Gallarda', 'Desiree', 10, 7, 33],
            ['Nolasco', 'Mark', 10, 4],

            ['Arroyo', 'Christian', 9, 7, 16],
            ['Amarilla', 'Nico', 10, 5, 7],
            ['Calibjo', 'Marvin', 10, 6, 58],
            ['Ferrer', 'Analyn', 11],
            // ['Galfo', 'Roshelle', 10, 7, 14],
            ['Gallego', 'Danny'],
            ['Garcia', 'John', 11],
            ['Perlas', 'Joel'],
            ['Tentativa', 'Rona', 10, 7, 9],

            ['Silva', 'Marie', 10, 6, 44],
            ['Poñate', 'Rhuel', 5, 5, 15],
            ['Recto', 'Jeneefer', 8, ,],
            ['Gabion', 'Jo-em', 9, 7, 35],
            ['Job', 'Jomore', 10, 6,],
            ['Morada', 'Norton', 11, ,],
            ['Tubongbanua', 'Jesa', 9, ,],
            ['Tumapang', 'Lemuel', 10, 7, 30],
            ['Galfo', 'Beverly', 10, 7, 30],

            ['Abonado', 'Quirnel', 10],
            ['Escamillan', 'Fretch', 11],
            ['Gallego', 'Mary', 11],
            ['Gamilong', 'Shammah', 10, 4],
            ['Ibieza', 'Zinnia', 11],
            ['Pillora', 'Clair', 11],

            ['Abancio', 'Nilse', 10],
            ['Sartorio', 'Janine', 11],
            ['Javellana', 'Catherine'],
            ['Laquian', 'Juvi'],
            ['Cajilig', 'Benjie', 11],
            ['Galapin', 'Eden', 11],
            ['Natividad', 'Lyssa', 11],
            ['Epelipcia', 'Joydah', 10, 7, 28],
            ['Figueroa', 'Kenneth'],
            ['Ginete', 'Jee', 10, 7, 35],

            ['Carbon', 'Rafael', 10],
            ['Escaza', 'Louren', 11],
            ['Gange', 'Angelica',],
            ['Luceño', 'Niel', 9, 7, 34],
            ['Muya', 'Lito', 10, 2,],
            ['Palencia', 'Rolando', 9, 2, 11],
            ['Rafil', 'Arnold', 6, 5, 21],
            ['Sevilla', 'Pritzie', 11],
            ['Tabangcura', 'Adonis', 10, 7, 25],
            ['Toledano', 'Jaime', 7, 5, 54],
            ['Valenzon', 'Mary', 11],

            ['Agarrado', 'Dan', 10, 5, 22],
            ['Gallego', 'Daverose'],
        ]

        employees = await findEmps(db, list)

        promises = employees.map((el, i) => {
            // Employee might have more than 1 employment. We use the first result found.
            return db.main.Employment.findOne({
                employeeId: el._id
            }).lean()
        })
        employments = await Promise.all(promises)

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
            name: 'STF',
            tags: ['Fund Source'],
            members: members
        })

    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


