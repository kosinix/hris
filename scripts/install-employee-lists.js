/**
 * Test.
 * Usage: node scripts/install-employee-lists.js
 */
//// Core modules
const path = require('path');
const process = require('process');

//// External modules
const lodash = require('lodash');
const pigura = require('pigura');

//// Modules
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
const findEmployments = async (db, list, employees) => {
    let promises = employees.map((el, i) => {
        // Employee might have more than 1 employment. We use the first result found....
        let criteria = {
            employeeId: el._id
        }
        // ... Unless criteria is provided
        let employmentType = lodash.get(list[i], `[5]`)
        if (employmentType) {
            lodash.set(criteria, 'employmentType', employmentType)
        }
        return db.main.Employment.findOne(criteria).lean()
    })
    let employments = await Promise.all(promises)

    let missing = []
    employments.forEach((el, i) => {
        if (el === null) {
            missing.push(`${list[i][0]} ${list[i][1]}`)
        }
    })
    if (missing.length > 0) {
        throw new Error(`${missing.length} employment not found for employee(s): ${missing.join(', ')}`)
    }
    return employments
}
const employeesToMembers = async (db, list, employees) => {
    let employments = await findEmployments(db, list, employees)
    return employments.map((employment, i) => {
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
}

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

            let members2 = employments.map((employment, i) => {
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
                members: members2
            })

            await db.main.EmployeeList.create({
                name: 'Permanent Faculty and Staff',
                tags: ['Fund Source'],
                members: members.concat(members2)
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
                if (!employees[i]) {
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

            // GAA NO ATM
            let list = [
                ['Borce', 'Joel', 10, 4],
                ['Grate', 'Ronnel', 10, 6, 5],
                ['Ibieza', 'Johny', 8, 6, 30],
                // ['Prologo', 'Michel John', 5],
            ]

            employees = await findEmps(db, list)
            members = await employeesToMembers(db, list, employees)

            let r = await db.main.EmployeeList.create({
                name: 'GAA NO ATM',
                tags: ['Fund Source'],
                members: members
            })
            console.log(`Created list "${r.name}"`)

            // GAA ATM
            list = [
                ['Bacuyani', 'Donnah', 10, 5, 58],
                ['Bunda', 'Erwin', 10, 6],
                ['De los Santos', 'Karen', 11],
                ['Fernandez', 'Kennette', 11],
                ['Gabalonzo', 'Juline', 10, 6, 59],
                ['Gabo', 'Precious', 10, 5, 6],
                ['Galve', 'Jerry', 11],
                ['Gellada', 'Dan Christian', 10, 6, 57],
                ['Magallanes', 'Garry', 11],
                ['Piodena', 'Angelie', 11],
                ['Paez', 'Nestor'],
                ['Tacadao', 'Mercy', 10, 4],
                // ['Tacdoro', 'Jorilen', 10, 7, 20],
                ['Tanaman', 'Jessa May', 9, 7, 40],

                ['Defensor', 'Sandra', 10, 7, 44],
                ['Gabales', 'Nicole', 11],
                ['Gulaylay', 'Christopher', 10, 2, 14],
                ['Herrera', 'Rodrigo', 11],
                ['Martisano', 'Mary Queen', 10, 7, 40],
                ['Monton', 'Windee', 10, 7, 24],
                // ['Poñate', 'Donnabelle', 11],
                ['Porras', 'Lady Carmel', 11],
                ['Tahum', 'Hernani', 11],

                ['Aguilar', 'John Rey', 11],
                ['Carpio', 'Neresa', 10, 7, 30],
                // ['Concepion', 'Khaye', 5, 3, 28],
                ['Decomotan', 'Rosario', 11],
                // ['Esteban', 'Jefrrey', 6, 6, 44],
                ['Zaragoza', 'Kin', 11]
            ]

            employees = await findEmps(db, list)
            members = await employeesToMembers(db, list, employees)

            r = await db.main.EmployeeList.create({
                name: 'GAA ATM',
                tags: ['Fund Source'],
                members: members
            })
            console.log(`Created list "${r.name}"`)

            // STF
            list = [
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
            members = await employeesToMembers(db, list, employees)

            r = await db.main.EmployeeList.create({
                name: 'STF',
                tags: ['Fund Source'],
                members: members
            })
            console.log(`Created list "${r.name}"`)


            // IGP
            list = [
                ['Cañete', 'Roland', 10, 6, 56],
                ['Concepcion', 'Mary', 11],
                ['Gabito', 'Unicorne', 10, 6],
                ['Platigue', 'John Carlo', 11],
                ['Real', 'Joseph', 9, 3, 8],
                ['Tapangan', 'Lybert', 9, 6, 19]
            ]

            employees = await findEmps(db, list)
            members = await employeesToMembers(db, list, employees)

            r = await db.main.EmployeeList.create({
                name: 'IGP',
                tags: ['Fund Source'],
                members: members
            })
            console.log(`Created list "${r.name}"`)

            // COS Faculty and Part-timers
            list = [
                ['Andrade', 'Eula Mae', 9, 7],
                ['Bermejo', 'Ralph Gerald', 10],

                ['Brillantes', 'Kezia Joice', 10],
                ['Estalogo', 'Christine'],
                ['Germina', 'Luis', 10],
                ['Labra', 'Wenmar'],
                ['Monton', 'Gejette'],
                ['Morada', 'Nenita'],
                ['Ysulan', 'Charlie'],

                ['Ejar', 'Marin', 10],
                ['Hervilla', 'Ralph'],
                ['Occeña', 'Michael'],

                // part-timers
                ['Baylon', 'Neriza', 45, 0, 0, 'part-time'],
                ['Bermejo', 'Edzel', 36, 45, 0, 'part-time'],
                ['Cabagsican', 'Janet', 0, 0, 0, 'part-time'],
                ['Claudio', 'Mark', 0, 0, 0, 'part-time'],
                ['Dulaca', 'Janine', 0, 0, 0, 'part-time'],
                ['Dumadaog', 'Jella', 0, 0, 0, 'part-time'],
                ['Ellaga', 'Riza', 0, 0, 0, 'part-time'],
                ['Gabasa', 'Melajen', 0, 0, 0, 'part-time'],
                ['Gadian', 'Joshua', 0, 0, 0, 'part-time'],
                ['Gaje', 'Michael', 0, 0, 0, 'part-time'],
                ['Infante', 'Kim Adrian', 0, 0, 0, 'part-time'],
                ['Jimenez', 'Carel', 0, 0, 0, 'part-time'],
                ['Nava', 'Jeryl', 0, 0, 0, 'part-time'],
                ['Palerit', 'Jenny', 0, 0, 0, 'part-time'],
                ['Ronco', 'Keince', 0, 0, 0, 'part-time'],
                ['Simora', 'Noreen', 0, 0, 0, 'part-time'],

                ['Baguio', 'Perla', 45, 0, 0, 'part-time'],
                ['Baron', 'Keseiah', 0, 0, 0, 'part-time'],
                ['Chavez', 'Janice', 0, 0, 0, 'part-time'],
                ['Gaborno', 'Lian Jean', 0, 0, 0, 'part-time'],
                ['Gencianeo', 'Salvador', 0, 0, 0, 'part-time'],
                ['Hortinela', 'Phoenix', 0, 0, 0, 'part-time'],
                ['Junco', 'Marianne', 0, 0, 0, 'part-time'],
                ['Lachica', 'Anelyn', 0, 0, 0, 'part-time'],
                ['Mendez', 'Mario', 0, 0, 0, 'part-time'],
                ['Relano', 'Prudencio', 0, 0, 0, 'part-time'],
                ['Satajo', 'Janet', 0, 0, 0, 'part-time'],
                ['Ricablanca', 'June', 0, 0, 0, 'part-time'],
                ['Alameda', 'Jesseca', 0, 0, 0, 'part-time'],
                ['Floro', 'Reciel Jay', 0, 0, 0, 'part-time'],
                ['Gabayeron', 'Lovel', 0, 0, 0, 'part-time'],

                ['Cavan', 'Paulino', 45, 0, 0, 'part-time'],
                ['Dagoon', 'Salvador', 0, 0, 0, 'part-time'],
                ['Dusaban', 'Criscelen', 0, 0, 0, 'part-time'],
                ['Edang', 'Rommel', 0, 0, 0, 'part-time'],
                ['Elvas', 'Mark', 0, 0, 0, 'part-time'],
                ['Estember', 'Ahlie', 0, 0, 0, 'part-time'],
                ['Ferrer', 'Jefrey', 0, 0, 0, 'part-time'],
                ['Gonzales', 'Jonas', 0, 0, 0, 'part-time'],
                ['Hilarion', 'Roga', 0, 0, 0, 'part-time'],
                ['Junco', 'Tomas', 0, 0, 0, 'part-time'],
                ['Lagaña', 'Melvin', 0, 0, 0, 'part-time'],
                ['Lusaya', 'Angelino', 0, 0, 0, 'part-time'],
                ['Padilla', 'Jay', 0, 0, 0, 'part-time'],
                ['Parreño', 'Mark', 0, 0, 0, 'part-time'],
                ['Peremne', 'Rara', 0, 0, 0, 'part-time'],
                ['Balidiong', 'Madelyn', 0, 0, 0, 'part-time'],

                // ['Banez', 'Richard', 45, 0, 0, 'part-time'],
                ['Dador', 'Elvir', 0, 0, 0, 'part-time'],
                ['Estember', 'Rollin', 0, 0, 0, 'part-time'],
                ['Gallo', 'Alfred', 0, 0, 0, 'part-time'],
            ]

            employees = await findEmps(db, list)
            members = await employeesToMembers(db, list, employees)

            r = await db.main.EmployeeList.create({
                name: 'COS Faculty and Part-timers',
                tags: ['Fund Source'],
                members: members
            })
            console.log(`Created list "${r.name}"`)

        } catch (err) {
            console.log(err)
        } finally {
            db.main.close();
        }
    })()


