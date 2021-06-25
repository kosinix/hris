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
const payrollCalc = require('../payroll-calc');


// Router
let router = express.Router()

router.use('/e-profile', middlewares.requireAuthUser)

router.get('/e-profile/home', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let qrCodes = []
        employee.employments.forEach((e)=>{
            let qrData = {
                type: 2,
                employeeId: employee._id,
                employmentId: e._id
            }
            qrData = Buffer.from(JSON.stringify(qrData)).toString('base64')
            console.log(qrData)

            qrData = qr.imageSync(qrData, { size: 5, type: 'png' }).toString('base64')
            qrCodes.push({
                data: qrData,
                employment: e,
                title: e.position || 'Employment',
            })
        })
        
        res.render('e-profile/home.html', {
            employee: employee,
            momentNow: moment(),
            qrCodes: qrCodes,
        });
        
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/dtr', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        console.log(employee.employments)
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
            let attendance = attendances[`${year}-${month}-${String(v+i).padStart(2,'0')}`] || null
            let dtr = payrollCalc.calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints, CONFIG.workTime.gracePeriods)
            
            return {
                date: `${year}-${month}-${String(v+i).padStart(2,'0')}`,
                year: year,
                month: month,
                day: v + i,
                dtr: dtr,
                attendance: attendance
            }
        })
        let qrCodeSvg = qr.imageSync(employee.uid, { size: 10, type: 'png' })

        res.render('e-profile/dtr.html', {
            momentNow: momentNow,
            days: days,
            attendances: attendances,
            employee: employee,
            qrCodeSvg: qrCodeSvg.toString('base64'),
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

router.get('/e-profile/dtr/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentId = req.params.employmentId

        // Today attendance
        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            employmentId: employmentId,
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
            let attendance = attendances[`${year}-${month}-${String(v+i).padStart(2,'0')}`] || null
            let dtr = payrollCalc.calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints, CONFIG.workTime.gracePeriods)
            
            return {
                date: `${year}-${month}-${String(v+i).padStart(2,'0')}`,
                year: year,
                month: month,
                day: v + i,
                dtr: dtr,
                attendance: attendance
            }
        })
        let qrCodeSvg = qr.imageSync(employee.uid, { size: 10, type: 'png' })

        res.render('e-profile/dtr.html', {
            momentNow: momentNow,
            days: days,
            attendances: attendances,
            employee: employee,
            qrCodeSvg: qrCodeSvg.toString('base64'),
        });
    } catch (err) {
        next(err);
    }
});
module.exports = router;