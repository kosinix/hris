/**
 * Use actual employees and add attendance
 * 
 * Usage: node scripts/install-payroll-stf.js
 */
//// Core modules
const path = require('path');
const fs = require('fs');
const util = require('util');

//// External modules
const moment = require('moment');
const lodash = require('lodash');
const pigura = require('pigura');

//// Modules
const dtrHelper = require('../data/src/dtr-helper')
const uid = require('../data/src/uid')

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
        let payrollName = 'June 15th STF'
        let dateStart = '2021-06-01'
        let dateEnd = '2021-06-15'

        let logs = []
        // 1. List of employees to use that are in db
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

        let lastNames = []
        let firstNames = []
        list.forEach((el,i) => { console.log(i)
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

        let missing = []
        employees.forEach((el, i) => {
            if (el === null) {
                missing.push(`${list[i][0]} ${list[i][1]}`)
            }
        })
        if (missing.length > 0) {
            throw new Error(`${missing.length} employee(s) not found: ${missing.join(', ')}`)
        }



        promises = employees.map((el, i) => {
            // Employee might have more than 1 employment. We use the first result found.
            return db.main.Employment.findOne({
                employeeId: el._id
            }).lean()
        })
        let employments = await Promise.all(promises)

        missing = []
        employments.forEach((el, i) => {
            if (el === null) {
                missing.push(list[i][0])
            }
        })
        if (missing.length > 0) {
            throw new Error(`Employee Employment not found: ${missing.join(', ')}`)
        }

        // console.log(util.inspect(employments, false, null, true))

        // 2. Use first found scanner
        let scanner = await db.main.Scanner.findOne()
        if (!scanner) {
            throw new Error('scanner not found.')
        }
        let scannerId = scanner._id

        // 3. Insert test attendances
        let attendances = []
        employees.forEach((employee, i) => {
            let days = lodash.get(list, `${i}.2`, 11)
            let hours = lodash.get(list, `${i}.3`, 0)
            let minutes = lodash.get(list, `${i}.4`, 0)
            let employment = employments[i]

            let dayCount = 0
            let breakFree = false
            for (d = 1; d <= 15; d++) {
                let dateTime = moment(dateStart).startOf('month').date(d)

                if (![0, 6].includes(dateTime.day())) { // Workdays only
                    let inAM = null
                    let outAM = null
                    let inPM = null
                    let outPM = null

                    if (dayCount < days) {
                        inAM = dateTime.clone().hour(8).minutes(0).toISOString(true)
                        outAM = dateTime.clone().hour(12).minutes(0).toISOString(true)
                        inPM = dateTime.clone().hour(13).minutes(0).toISOString(true)
                        outPM = dateTime.clone().hour(17).minutes(0).toISOString(true)
                        dayCount++
                    } else {
                        if (hours >= 5) {
                            inAM = dateTime.clone().hour(8).minutes(0).toISOString(true)
                            outAM = dateTime.clone().hour(12).minutes(0).toISOString(true)
                            inPM = dateTime.clone().hour(13).minutes(0).toISOString(true)
                            outPM = dateTime.clone().hour(13).minutes(0).add(hours - 4, 'hours').add(minutes, 'minutes').toISOString(true)
                        } else {
                            inAM = dateTime.clone().hour(8).minutes(0).toISOString(true)
                            outAM = dateTime.clone().hour(8).minutes(0).clone().add(hours, 'hours').add(minutes, 'minutes').toISOString(true)
                        }
                        breakFree = true
                    }

                    attendances.push({
                        "employeeId": employee._id,
                        "employmentId": employment._id,
                        "onTravel": false,
                        "wfh": false,
                        "logs": [
                            {
                                "scannerId": scannerId,
                                "dateTime": inAM,
                                "mode": 1
                            },
                            {
                                "scannerId": scannerId,
                                "dateTime": outAM,
                                "mode": 0
                            },
                            {
                                "scannerId": scannerId,
                                "dateTime": inPM,
                                "mode": 1
                            },
                            {
                                "scannerId": scannerId,
                                "dateTime": outPM,
                                "mode": 0
                            },
                        ],
                        createdAt: inAM,
                    })

                    logs.push(`db.getCollection('attendances').remove({employeeId:ObjectId("${employee._id}")})`)
                    if (breakFree) {
                        break;
                    }
                }
            }
        })
        let insertedAttendances = await db.main.Attendance.insertMany(attendances)
        console.log(`Inserted ${insertedAttendances.length} attendances into ${employees.length} employees...`)

        let rows = employments.map((employment, i) => {
            let employee = employees[i]
            return {
                uid: uid.gen(),
                type: 1,
                employment: employment,
                employee: employee,
                timeRecord: {},
                cells: [
                    {
                        columnUid: 'tax3',
                        value: 0
                    },
                    {
                        columnUid: 'tax10',
                        value: 0
                    },
                    {
                        columnUid: 'contributionSss',
                        value: 0
                    },
                    {
                        columnUid: 'ecSss',
                        value: 0
                    }
                ],
                attendances: [],
            }
        })

        for (let x = 0; x < rows.length; x++) {
            let row = rows[x]

            // Get attendances based on payroll date range
            let attendances = await db.main.Attendance.find({
                employmentId: row.employment._id,
                createdAt: {
                    $gte: moment(dateStart).startOf('day').toDate(),
                    $lt: moment(dateEnd).endOf('day').toDate(),
                }
            }).lean()

            // Attach computed values
            let totalMinutes = 0
            let totalMinutesUnderTime = 0
            for (let a = 0; a < attendances.length; a++) {
                let attendance = attendances[a] // daily
                let dtr = dtrHelper.calcDailyAttendance(attendance, 8, 480)
                totalMinutes += dtr.totalMinutes
                totalMinutesUnderTime += dtr.underTimeTotalMinutes
                attendances[a].dtr = dtr
            }

            row.timeRecord = dtrHelper.getTimeBreakdown(totalMinutes, totalMinutesUnderTime, 8)
            row.attendances = attendances

        }

        // 4. Insert Payroll
        let columns = [
            {
                uid: 'fundSource',
                title: 'Fund',
                computed: true,
            },
            {
                uid: 'name',
                title: 'Name',
                computed: true,
            },
            {
                uid: 'position',
                title: 'Position',
                computed: true,
            },
            {
                uid: 'basePay',
                title: 'Salary',
                computed: true,
            },
            {
                uid: 'attendance',
                title: 'Time worked',
                computed: true,
            },
            {
                uid: 'amountWorked',
                title: 'Gross Pay',
                computed: true,
            },
            {
                uid: '5Premium',
                title: '5% Premium',
                computed: true,
            },
            {
                uid: 'grossPay',
                title: 'Total',
                computed: true,
            },
            {
                uid: 'tax3',
                title: '3% Tax',
                computed: false,
            },
            {
                uid: 'tax10',
                title: '10% Tax',
                computed: false,
            },
            {
                uid: 'totalTax',
                title: 'Total Tax',
                computed: true,
            },
            {
                uid: 'contributionSss',
                title: 'Contribution',
                computed: false,
            },
            {
                uid: 'ecSss',
                title: 'EC',
                computed: false,
            },
            {
                uid: 'totalSss',
                title: 'Total SSS',
                computed: true,
            },
            {
                uid: 'totalDeductions',
                title: 'Total Deductions',
                computed: true,
            },
            {
                uid: 'netPay',
                title: 'Net Amnt ',
                computed: true,
            },
        ]
        let payroll = {
            name: payrollName,
            dateStart: dateStart,
            dateEnd: dateEnd,
            rows: rows,
            columns: columns,
            template: 'cos_staff',
        }

        payroll = await db.main.Payroll.create(payroll)

        console.log(`Payrolls...`)
        logs.push(`db.getCollection('payrolls').remove({_id:ObjectId("${payroll._id}")})`)

        file = CONFIG.app.dir + '/scripts/logs/attendance.permanent.log'
        fs.writeFileSync(file, logs.join(";\n"), { encoding: 'utf8' })
        console.log(`Log file "${file}"`)

    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


