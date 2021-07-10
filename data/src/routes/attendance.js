//// Core modules

//// External modules
const kalendaryo = require('kalendaryo');
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const payrollCalc = require('../payroll-calc');


// Router
let router = express.Router()

router.use('/attendance', middlewares.requireAuthUser)

router.get('/attendance/all', middlewares.guardRoute(['read_all_attendance', 'read_attendance']), async (req, res, next) => {
    try {
        throw new Error('Page under development.')
    } catch (err) {
        next(err);
    }
});

router.get('/attendance/employee/employment/:employeeId/:employmentId', middlewares.guardRoute(['read_all_attendance', 'read_attendance']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
    try {
        let employee = res.employee
        let employment = res.employment

        let year = lodash.get(req, 'query.year', moment().format('YYYY'))
        let month = lodash.get(req, 'query.month', moment().format('MM'))
        let momentNow = moment(`${year}-${month}-01`)

        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            employmentId: employment._id,
        })
        attendances = lodash.mapKeys(attendances, (a) => {
            return moment(a.createdAt).format('YYYY-MM-DD')
        })
        let days = new Array(momentNow.daysInMonth())
        days = days.fill(1).map((v, i) => {
            let attendance = attendances[`${year}-${month}-${String(v + i).padStart(2, '0')}`] || null
            let dtr = payrollCalc.calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints, CONFIG.workTime.gracePeriods)

            return {
                date: `${year}-${month}-${String(v + i).padStart(2, '0')}`,
                year: year,
                month: month,
                day: v + i,
                dtr: dtr,
                attendance: attendance
            }
        })

        // console.log(kalendaryo.getMatrix(momentNow, 0))
        let months = Array.from(Array(12).keys()).map((e, i) => {
            return moment.utc().month(i).startOf('month')
        }); // 1-count
        // return res.send(days)
        res.render('attendance/employment.html', {
            flash: flash.get(req, 'attendance'),
            employee: employee,
            employment: employment,
            attendances: attendances,
            momentNow: momentNow,
            months: months,
            days: days,
            selectedMonth: month,
            matrix: kalendaryo.getMatrix(momentNow, 0)
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;