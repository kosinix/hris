/**
 * Use actual employees and add attendance
 * 
 * Usage: node scripts/install-payroll-permanent.js
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
        let payrollName = 'July 15th Permanent'
        let dateStart = '2021-07-01'
        let dateEnd = '2021-07-15'

        let logs = []
        // 1. List of employees to use that are in db
        let list = [['Alminaza', 'Reiner', 10, 30],
        ['Alumbro', 'Adrian'],
        ['Anas', 'Anelyn'],
        ['Arboleda', 'Daniel'],
        ['Arceña', 'Agustin'],
        // ['Arensol', 'Joe'],
        // ['Arsenio', 'Jason'],
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
        // ['Gallos', 'Loveson'],
        ['Galve', 'Fermin'],
        ['Gamo', 'Gerald'],
        ['Garbosa', 'Freddie'],
        ['Gardose', 'Rences'],
        ['Garmay', 'Beverly'],
        ['Gerada', 'Jo'],
        ['Gonzales', 'Kristine'],
        // ['Gonzales', 'Michael'],
        ['Gonzales', 'Niel'],
        ['Gumaling', 'Riza'],
        // ['Habaña', 'Jesrelle'],
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
        // ['Lausing', 'Aubrey'],
        ['Libutaque', 'Fernando'],
        ['Luzuriaga', 'Jimmy'],
        ['Magbanua', 'Jeffrey'],
        ['Maramento', 'Ellyn'],
        ['Marquez', 'Nenen'],
        ['Martir', 'Erly'],
        // ['Martirez', 'Rodney'],
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
                        columnUid: 'emergencyLoan',
                        value: 0
                    },
                    {
                        columnUid: 'eal',
                        value: 0
                    },
                    {
                        columnUid: 'consoLoan',
                        value: 0
                    },
                    {
                        columnUid: 'ouliPremium',
                        value: 0
                    },
                    {
                        columnUid: 'policyOuliLoan',
                        value: 0
                    },
                    {
                        columnUid: 'regularPolicyLoan',
                        value: 0
                    },
                    {
                        columnUid: 'gfal',
                        value: 0
                    },
                    {
                        columnUid: 'mpl',
                        value: 0
                    },
                    {
                        columnUid: 'cpl',
                        value: 0
                    },
                    {
                        columnUid: 'help',
                        value: 0
                    },
                    {
                        columnUid: 'medicare',
                        value: 0
                    },
                    {
                        columnUid: 'pagibigContribution',
                        value: 0
                    },
                    {
                        columnUid: 'mplLoan',
                        value: 0
                    },
                    {
                        columnUid: 'calamityLoan',
                        value: 0
                    },
                    {
                        columnUid: 'withholdingTax',
                        value: 0
                    },
                    {
                        columnUid: 'teachersScholars',
                        value: 0
                    },
                    {
                        columnUid: 'ffaLoan',
                        value: 0
                    },
                    {
                        columnUid: 'citySavingsBank',
                        value: 0
                    },
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
        let columns =  [
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
                uid: 'peraAca',
                title: 'Allowance PERA/ACA',
                computed: true,
            },
            {
                uid: 'grossPayAllowance',
                title: 'Total',
                computed: true,
            },
            {
                uid: 'tardiness',
                title: 'Less: Late/Tardiness',
                computed: true,
            },
            {
                uid: 'grossPay',
                title: 'Grant Total',
                computed: true,
            },
            {
                uid: 'rlipPs9',
                title: 'RLIP PS 9%',
                computed: true,
            },
            // 
            {
                uid: 'emergencyLoan',
                title: 'Emergency Loan',
                computed: false,
            },
            {
                uid: 'eal',
                title: 'EAL',
                computed: false,
            },
            {
                uid: 'consoLoan',
                title: 'CONSO LOAN',
                computed: false,
            },
            {
                uid: 'ouliPremium',
                title: 'OULI Premium',
                computed: false,
            },
            {
                uid: 'policyOuliLoan',
                title: 'Policy OULI Loan',
                computed: false,
            },
            {
                uid: 'regularPolicyLoan',
                title: 'Regular Policy Loan',
                computed: false,
            },
            {
                uid: 'gfal',
                title: 'GFAL',
                computed: false,
            },
            {
                uid: 'mpl',
                title: 'MPL',
                computed: false,
            },
            {
                uid: 'cpl',
                title: 'CPL',
                computed: false,
            },
            {
                uid: 'help',
                title: 'HELP',
                computed: false,
            },
            {
                uid: 'medicare',
                title: 'Medicare',
                computed: false,
            },
            {
                uid: 'pagibigContribution',
                title: 'PAGIBIG Contribution',
                computed: false,
            },
            {
                uid: 'mplLoan',
                title: 'MPL Loan',
                computed: false,
            },
            {
                uid: 'calamityLoan',
                title: 'Calamity Loan',
                computed: false,
            },
            {
                uid: 'withholdingTax',
                title: 'Withholding Tax',
                computed: false,
            },
            // //
            {
                uid: 'totalMandatoryDeductions',
                title: 'Total Mandatory Deductions',
                computed: true,
            },
            {
                uid: 'netAfterTotalMandatoryDeductions',
                title: 'Net Amount After Deductions',
                computed: true,
            },
            // //
            {
                uid: 'teachersScholars',
                title: 'Teachers Scholars',
                computed: false,
            },
            {
                uid: 'ffaLoan',
                title: 'FFA Loan and Others',
                computed: false,
            },
            {
                uid: 'citySavingsBank',
                title: 'City Savings Bank',
                computed: false,
            },
            // //
            {
                uid: 'totalNonMandatoryDeductions',
                title: 'Total Non-Mandatory Deductions',
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
            template: 'permanent',
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


