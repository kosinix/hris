/**
 * Use actual employees and add attendance
 * 
 * Usage: node scripts/attendance.perma.test.js
 */
//// Core modules
const path = require('path');
const fs = require('fs');
const util = require('util');

//// External modules
const moment = require('moment');
const lodash = require('lodash');
const pigura = require('pigura');
const uuid = require('uuid');

//// Modules
const passwordMan = require('../data/src/password-man');
const payrollCalc = require('../data/src/payroll-man');
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
        let logs = []
        // 1. List of employees to use that are in db
        let list = [['Alminaza', 'Reiner'],
        ['Alumbro', 'Adrian'],
        ['Anas', 'Anelyn'],
        ['Arboleda', 'Daniel'],
        ['Arceña', 'Agustin'],
        ['Arensol', 'Joe'],
        ['Arsenio', 'Jason'],
        ['Artajo', 'Sheila'],
        ['Artajo', 'Tommy'],
        ['Arturo', 'Rey'],
        ['Arturo', 'Rosabeth'],
        ['Asprilla', 'Ivony'],
        ['Bales', 'Alvin'],
        ['Basañes', 'Sol'],
        ['Berondo', 'Ronilo'],
        ['Borro', 'Rogelio'],
        ['Buelva', 'Raquel'],
        ['Bullo', 'Jean'],
        ['Caber', 'Jocyl'],
        ['Cablas', 'Joven'],
        ['Cadornigara', 'Jasmine'],
        ['Cainday', 'Simeon'],
        ['Calumpita', 'Conrado'],
        ['Cang', 'Geraldo'],
        ['Cariaga', 'Kissy'],
        ['Catalan', 'Eric'],
        ['Catalan', 'Ruby'],
        ['David', 'Marie'],
        ['De Asis', 'Josephine'],
        ['De la Cruz', 'Margie'],
        ['de la Rama', 'khristian'],
        ['Dilag', 'Criste'],
        ['Dumagpi', 'Erwin'],
        ['Efondo', 'Violeta'],
        ['Egael', 'Lovely'],
        ['Encarquez', 'Ana'],
        ['Eres', 'Aizle'],
        ['Espin', 'Antonieta'],
        ['Estilo', 'Aziel'],
        ['Fernandez', 'Jufel'],
        ['Flora', 'Rhea'],
        ['Forca', 'Adrian'],
        ['Ga', 'James'],
        ['Gabayoyo', 'Adora'],
        ['Gabion', 'Jonathan'],
        ['Gabo', 'Jessierey'],
        ['Gadian', 'Jasmin'],
        ['Gadian', 'Juliet'],
        ['Gaitano', 'Josie'],
        ['Gajo', 'Elizabeth'],
        ['Gal', 'Frenz'],
        ['Galapin', 'Revenlie'],
        ['Galimba', 'Dioremark'],
        ['Gallos', 'Loveson'],
        ['Galve', 'Fermin'],
        ['Gamo', 'Gerald'],
        ['Garbosa', 'Freddie'],
        ['Gardose', 'Rences'],
        ['Garmay', 'Beverly'],
        ['Gerada', 'Jo'],
        ['Gonzales', 'Kristine'],
        ['Gonzales', 'Michael'],
        ['Gonzales', 'Niel'],
        ['Gumaling', 'Riza'],
        ['Habaña', 'Jesrelle'],
        ['Habaña', 'Ruben'],
        ['Herrera', 'Reynro'],
        ['Ibieza', 'Daisy'],
        ['Infante', 'Julieta'],
        ['Isogon', 'Ervin'],
        ['Jalando-on', 'Anthony'],
        ['Janaban', 'Anelyn'],
        ['Japitana', 'Joel'],
        ['Job', 'Aser'],
        ['Junco', 'Ethel'],
        ['Lausing', 'Aubrey'],
        ['Libutaque', 'Fernando'],
        ['Luzuriaga', 'Jimmy'],
        ['Magbanua', 'Jeffrey'],
        ['Maramento', 'Ellyn'],
        ['Marquez', 'Nenen'],
        ['Martir', 'Erly'],
        ['Martirez', 'Rodney'],
        ['Molate', 'Mary'],
        ['Moralista', 'Rome'],
        ['Niego', 'Katherine'],
        ['Norilla', 'Agatha'],
        ['Occeña', 'Crisanto'],
        ['Paglomutan', 'Rodrigo'],
        ['Paguntalan', 'Andrew'],
        ['Palma', 'Kyrl'],
        ['Palma', 'Norie'],
        ['Paltiguera', 'Shiela'],
        ['Parreño', 'Mary'],
        ['Perrocha', 'Methusela'],
        ['Pillora', 'Kert'],
        ['Porras', 'Ferick'],
        ['Ramos', 'Joebert'],
        ['Rodriguez', 'Nelson'],
        ['Rueda', 'Roger'],
        ['Salinas', 'Jerry'],
        ['Siva', 'Enriqueta'],
        ['Sollano', 'Mona'],
        ['Soqueña', 'Arthur'],
        ['Sorongon', 'Maychelle'],
        ['Sumalde', 'Maribeth'],
        ['Tabale', 'Liezel'],
        ['Tagudin', 'John'],
        ['Tamdang', 'Divon'],
        ['Tellermo', 'Efren'],
        ['Tumapang', 'Leopoldo'],
        ['Vergara', 'Julius'],
        ['Vilbar', 'Helen'],
        ['Villaflor', 'Rodante'],
        ['Yanguas', 'Ma.'],
        ['Ymalay', 'Lea'],
        ['Parreño', 'Lilian'],
        ['Aleman', 'Janet'],
        ['Baterzal', 'Jean'],
        ['Cinco', 'Rosalinda'],
        ['Depamallo', 'Vivie'],
        ['Dulla', 'Ronel'],
        ['Ello', 'Grace'],
        ['Gabiota', 'Mirhjan'],
        ['Gajo', 'Zosimo'],
        ['Galve', 'Randy'],
        ['Herrero', 'Cornelia'],
        ['Jarangue', 'Hazel'],
        ['Lamera', 'Luna'],
        ['Pillora', 'Ken'],
        ['Pillora', 'Ma.'],
        ['Prologo', 'Philippe'],
        ['Tembrevilla', 'Rosebelle'],
        ['Traifalgar', 'Regina'],
        ['Tumapang', 'Ann'],
        ['Villa', 'Arnel'],
        ['Yucon', 'Johnny'],
        ['Yanguas', 'Roland']]

        let lastNames = []
        let firstNames = []
        list.forEach((el) => {
            lastNames.push(new RegExp(`^${el[0]}`, "i"))
            firstNames.push(new RegExp(`^${el[1]}`, "i"))
        })

        let promises = []
        list.forEach((el) => {
            promises.push(db.main.Employee.findOne({
                lastName: new RegExp(`^${el[0]}`, "i"),
                firstName: new RegExp(`^${el[1]}`, "i"),
            }).lean())
        })
        let employees = await Promise.all(promises)

        employees = employees.filter((el) => {
            return el !== null
        })

        promises = []
        employees.forEach((el, i) => {
            promises.push(db.main.Employment.find({
                employeeId: el._id
            }).lean())
        })

        let employments = await Promise.all(promises)
        employees = employees.map((el, i) => {
            el.employments = employments[i]
            return el
        })
       
        console.log(util.inspect(employments, false, null, true))

        if (employees.length <= 0) {
            throw new Error('No employees found.')
        }

        // 2. Use first found scanner
        let scanner = await db.main.Scanner.findOne()
        if (!scanner) {
            throw new Error('scanner not found.')
        }
        let scannerId = scanner._id

        // 3. Insert attendances
        let attendances = []
        for (d = 1; d <= 15; d++) {
            let dateTime = moment('2021-06-01').startOf('month').date(d)
            if (![0, 6].includes(dateTime.day())) { // Workdays only
                // console.log(dateTime.toISOString(true))
                employees.forEach((employee) => {
                    if (lodash.has(employee, 'employments.0')) {
                        attendances.push({
                            "employeeId": employee._id,
                            "employmentId": employee.employments[0]._id,
                            "onTravel": false,
                            "logs": [
                                {
                                    "scannerId": scannerId,
                                    "dateTime": dateTime.clone().hour(8).minutes(15).toISOString(true),
                                    "mode": 1
                                },
                                {
                                    "scannerId": scannerId,
                                    "dateTime": dateTime.clone().hour(12).minutes(0).toISOString(true),
                                    "mode": 0
                                },
                                {
                                    "scannerId": scannerId,
                                    "dateTime": dateTime.clone().hour(13).minutes(0).toISOString(true),
                                    "mode": 1
                                },
                                {
                                    "scannerId": scannerId,
                                    "dateTime": dateTime.clone().hour(17).minutes(0).toISOString(true),
                                    "mode": 0
                                },
                            ],
                            createdAt: dateTime.clone().hour(8).minutes(0).toISOString(true),
                        })

                        logs.push(`db.getCollection('attendances').remove({employeeId:ObjectId("${employee._id}")})`)
                    }
                })
            }
        }
        let r2 = await db.main.Attendance.insertMany(attendances)
        console.log(`Inserted ${r2.length} attendances into ${employees.length} employees...`)

        employments = []
        employees.forEach((employee) => {
            if (lodash.has(employee, 'employments.0')) {
                employments.push({
                    _id: employee.employments[0]._id,
                    employeeId: employee.employments[0].employeeId,
                })
            }
        })

        // 4. Insert Payroll
        let payroll = await db.main.Payroll.create({
            name: 'June 1st Quincena Perma',
            dateStart: '2021-06-01',
            dateEnd: '2021-06-15',
            employments: employments,
            incentives: [{
                "name": "Allowance PERA/ACA",
                "type": "normal",
                "initialAmount": 2000,
                "_id": db.mongoose.Types.ObjectId(),
                "uid": "allowancePeraAca"
            }],
            template: 'permanent',
        })
        console.log(`Payrolls...`)
        logs.push(`db.getCollection('payrolls').remove({_id:ObjectId("${payroll._id}")})`)


        // file = CONFIG.app.dir + '/scripts/logs/attendance.perma.test.log'
        // fs.writeFileSync(file, logs.join(";\n"), { encoding: 'utf8' })
        // console.log(`Log file "${file}""`)
    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


