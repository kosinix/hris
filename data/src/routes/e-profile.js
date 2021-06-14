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

router.use('/e-profile', middlewares.requireAuthUser)

router.get('/e-profile/all', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

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

router.get('/e-profile/dtr', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        // Today attendance
        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            createdAt: {
                $gte: moment().startOf('month').toDate(),
                $lt: moment().endOf('month').toDate(),
            }
        })
        attendances = lodash.mapKeys(attendances, (a) => {
            return moment(a.createdAt).format('YYYY-MM-DD')
        })

        let momentNow = moment()
        let days = new Array(momentNow.daysInMonth())
        let year = momentNow.format('YYYY')
        let month = momentNow.format('MM')
        days = days.fill(1).map((v, i) => {
            return {
                date: `${year}-${month}-${String(v+i).padStart(2,'0')}`,
                year: year,
                month: month,
                day: v + i,
                attendance: attendances[`${year}-${month}-${String(v+i).padStart(2,'0')}`] || null
            }
        })
        res.render('e-profile/dtr.html', {
            momentNow: momentNow,
            days: days,
            attendances: attendances,
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/dtr-qr', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let qrCodeSvg = qr.imageSync(employee.uid, { size: 10, type: 'svg' })

        res.render('e-profile/dtr-qr.html', {
            momentNow: moment(),
            qrCodeSvg: qrCodeSvg
        });
    } catch (err) {
        next(err);
    }
});

router.post('/attendance/dtr', middlewares.guardRoute(['create_scanner']), async (req, res, next) => {
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

        // let entity = res.entity
        let body = req.body
        if (body.inAM && !attendance) {

            let attendance = new db.main.Attendance({
                employeeId: employee._id,
                inAM: new Date(),
                inAM2: {
                    // scannerId: ,
                    dateTime: new Date(),
                    confirmed: false
                }
            })
            await attendance.save()
            return res.redirect('/attendance/dtr/confirm')
        }
        if (body.outAM && attendance && attendance.inAM) {

            attendance.outAM = new Date()
            await attendance.save()

        }
        if (body.inPM && attendance && attendance.outAM) {

            attendance.inPM = new Date()
            await attendance.save()

        }
        if (body.outPM && attendance && attendance.inPM) {

            attendance.outPM = new Date()
            await attendance.save()

        }


        return res.redirect('/attendance/dtr')

        // let patch = {}

        // let password = passwordMan.randomString(8)
        // let salt = passwordMan.randomString(16)
        // let passwordHash = passwordMan.hashPassword(password, salt)

        // lodash.set(patch, 'entityId', lodash.get(entity, '_id'))
        // lodash.set(patch, 'name', lodash.get(body, 'name'))
        // lodash.set(patch, 'type', lodash.get(body, 'type'))
        // lodash.set(patch, 'passwordHash', passwordHash)
        // lodash.set(patch, 'salt', salt)

        // let scanner = new db.main.Scanner(patch)
        // await scanner.save()

        // flash.ok(req, 'entity', `Added ${scanner.name}. ID is "${scanner.uid}" and password is "${password}". You will only see your password once so please save it in a secure place.`)
        console.log(body)
        res.redirect(`/attendance/dtr`)
    } catch (err) {
        next(err);
    }
});

router.get('/attendance/dtr/confirm', middlewares.guardRoute(['create_scanner']), async (req, res, next) => {
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
        if (attendance) {
            console.log(moment(attendance.inAM).format('dddd - MMM DD, YYYY hh:mm:ss A'))
        }

        let qrCodeSvg = qr.imageSync(employee.uid, { size: 6, type: 'svg' })

        res.render('attendance/dtr-confirm.html', {
            moment: moment,
            attendance: attendance,
            qrCodeSvg: qrCodeSvg
        });
    } catch (err) {
        next(err);
    }
});
router.post('/attendance/dtr/confirm', middlewares.guardRoute(['create_scanner']), async (req, res, next) => {
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

        // let entity = res.entity
        let body = req.body
        if (body.inAM && !attendance) {

            let attendance = new db.main.Attendance({
                employeeId: employee._id,
                inAM: new Date(),
                inAM2: {
                    // scannerId: ,
                    dateTime: new Date(),
                    confirmed: false
                }
            })
            await attendance.save()
            return res.redirect('/attendance/dtr/confirm')
        }
        if (body.outAM && attendance && attendance.inAM) {

            attendance.outAM = new Date()
            await attendance.save()

        }
        if (body.inPM && attendance && attendance.outAM) {

            attendance.inPM = new Date()
            await attendance.save()

        }
        if (body.outPM && attendance && attendance.inPM) {

            attendance.outPM = new Date()
            await attendance.save()

        }


        return res.redirect('/attendance/dtr')

        // let patch = {}

        // let password = passwordMan.randomString(8)
        // let salt = passwordMan.randomString(16)
        // let passwordHash = passwordMan.hashPassword(password, salt)

        // lodash.set(patch, 'entityId', lodash.get(entity, '_id'))
        // lodash.set(patch, 'name', lodash.get(body, 'name'))
        // lodash.set(patch, 'type', lodash.get(body, 'type'))
        // lodash.set(patch, 'passwordHash', passwordHash)
        // lodash.set(patch, 'salt', salt)

        // let scanner = new db.main.Scanner(patch)
        // await scanner.save()

        // flash.ok(req, 'entity', `Added ${scanner.name}. ID is "${scanner.uid}" and password is "${password}". You will only see your password once so please save it in a secure place.`)
        console.log(body)
        res.redirect(`/attendance/dtr`)
    } catch (err) {
        next(err);
    }
});

module.exports = router;