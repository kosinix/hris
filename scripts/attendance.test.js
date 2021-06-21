/**
 * Insert test attendance.
 * Usage: node scripts/attendance.test.js
 */
//// Core modules
const path = require('path');

//// External modules
const moment = require('moment');
const lodash = require('lodash');
const pigura = require('pigura');

//// Modules


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


(async () => {
    try {
        let employeeId = new db.mongoose.Types.ObjectId("60b22ee0e846b00efc16941a")
        let attendances = [
            {

                "employeeId": employeeId,
                "onTravel": false,
                "logs": [
                    {
                        "scannerId": new db.mongoose.Types.ObjectId("60c02806cac3cc38e0ccccbf"),
                        "dateTime": moment().hour(8).minutes(15).toDate(),
                        "mode": 1
                    },
                    {
                        "scannerId": new db.mongoose.Types.ObjectId("60c02806cac3cc38e0ccccbf"),
                        "dateTime": moment().hour(14).minutes(0).toDate(),
                        "mode": 0
                    },
                    {
                        "scannerId": new db.mongoose.Types.ObjectId("60c02806cac3cc38e0ccccbf"),
                        "dateTime": moment().hour(14).minutes(0).toDate(), 
                        "mode": 1
                    },
                    {
                        "scannerId": new db.mongoose.Types.ObjectId("60c02806cac3cc38e0ccccbf"),
                        "dateTime": moment().hour(17).minutes(0).toDate(),
                        "mode": 0
                    }
                ]
            },
            // {

            //     "employeeId": employeeId,
            //     "onTravel": false,
            //     "logs": [
            //         {
            //             "scannerId": new db.mongoose.Types.ObjectId("60c02806cac3cc38e0ccccbf"),
            //             "dateTime": moment().hour(8).minutes(16).toDate(),
            //             "mode": 1
            //         },
            //         {
            //             "scannerId": new db.mongoose.Types.ObjectId("60c02806cac3cc38e0ccccbf"),
            //             "dateTime": moment().hour(12).minutes(0).toDate(),
            //             "mode": 0
            //         },
            //         {
            //             "scannerId": new db.mongoose.Types.ObjectId("60c02806cac3cc38e0ccccbf"),
            //             "dateTime": moment().hour(13).minutes(15).toDate(),
            //             "mode": 1
            //         },
            //         {
            //             "scannerId": new db.mongoose.Types.ObjectId("60c02806cac3cc38e0ccccbf"),
            //             "dateTime": moment().hour(17).minutes(0).toDate(),
            //             "mode": 0
            //         }
            //     ],
            //     createdAt: moment().subtract(1, 'days').toDate(),
            // },
            // {

            //     "employeeId": employeeId,
            //     "onTravel": false,
            //     "logs": [
            //         {
            //             "scannerId": new db.mongoose.Types.ObjectId("60c02806cac3cc38e0ccccbf"),
            //             "dateTime": moment().hour(8).minutes(0).toDate(),
            //             "mode": 1
            //         },
            //         {
            //             "scannerId": new db.mongoose.Types.ObjectId("60c02806cac3cc38e0ccccbf"),
            //             "dateTime": moment().hour(12).minutes(0).toDate(),
            //             "mode": 0
            //         },
            //         {
            //             "scannerId": new db.mongoose.Types.ObjectId("60c02806cac3cc38e0ccccbf"),
            //             "dateTime": moment().hour(13).minutes(0).toDate(),
            //             "mode": 1
            //         },
            //         {
            //             "scannerId": new db.mongoose.Types.ObjectId("60c02806cac3cc38e0ccccbf"),
            //             "dateTime": moment().hour(17).minutes(30).toDate(),
            //             "mode": 0
            //         }
            //     ],
            //     createdAt: moment().subtract(2, 'days').toDate(),
            // }
        ]
        let r = await db.main.Attendance.deleteMany({
            "employeeId": employeeId,
        })
        console.log(`Deleted ${r.deletedCount} "attendance" ...`)

        let promises = lodash.map(attendances, (o) => {
            let attendance = new db.main.Attendance(o);

            console.log(`Inserting "attendance" ...`)
            return attendance.save()
        })
        await Promise.all(promises)
        console.log(`Inserted ${promises.length} .`)

    } catch (err) {
        console.log(err)
    } finally {
        db.main.close();
    }
})()


