//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const passwordMan = require('../password-man');


// Router
let router = express.Router()

router.use('/attendance', middlewares.requireAuthUser )

router.get('/attendance/all', middlewares.guardRoute(['read_all_scanner', 'read_scanner']), async (req, res, next) => {
    try {
        let employee = {
            _id: '60b22ee0e846b00efc16941a',
            uid: '371170237238',
        }
        let payroll = {
            startDate: '2021-06-01',
            endDate: '2021-06-30',
        }
        //
        // let date = new Date('2021-06-01 08:00:00')
        let date = moment('06-01-2021 08:00 AM', 'MM-DD-YYYY hh:mm A')
        let attendance = new db.main.Attendance({
            employeeId: employee._id,
            createdAt: date.clone().toDate(),

            inAM: {
                dateTime: date.clone().toDate(),
                confirmed: true,
            },
            outAM: date.add(4, 'hours').toDate(),
            inPM: date.add(1, 'hours').toDate(),
            outPM: date.add(4, 'hours').toDate(),
        })
        await attendance.save()

        date = moment('06-02-2021 08:00 AM', 'MM-DD-YYYY hh:mm A')
        attendance = new db.main.Attendance({
            employeeId: employee._id,
            createdAt: date.clone().toDate(),

            inAM: date.clone().toDate(),
            outAM: date.add(4, 'hours').toDate(),
            inPM: date.add(1, 'hours').toDate(),
            outPM: date.add(4, 'hours').toDate(),
        })
        await attendance.save()
        //

        // All attendances
        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            createdAt: {
                $gte: moment(payroll.startDate).startOf('day').toDate(),
                $lt: moment(payroll.endDate).endOf('day').toDate(),
            }
        })

        res.send(attendances)
    } catch (err) {
        next(err);
    }
});

router.get('/attendance/dtr', middlewares.guardRoute(['create_scanner']), async (req, res, next) => {
    try {
        let employee = {
            _id: '60b22ee0e846b00efc16941a',
            uid: '371170237238',
        }

        // Today attendance
        let attendance = await db.main.Attendance.findOne({
            employeeId: employee._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        })

        console.log(attendance)
        if(attendance){
            console.log(moment(attendance.inAM).format('dddd - MMM DD, YYYY hh:mm:ss A'))
        }

        let qrCodeSvg = qr.imageSync(employee.uid, { size: 6, type: 'svg' })

        res.render('attendance/create.html', {
            moment: moment,
            attendance: attendance,
            qrCodeSvg: qrCodeSvg
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;