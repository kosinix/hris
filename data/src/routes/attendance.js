//// Core modules

//// External modules
const kalendaryo = require('kalendaryo');
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const db = require('../db');
const dtrHelper = require('../dtr-helper');
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
        let employee = res.employee.toObject()
        let employment = res.employment

        let month = lodash.get(req, 'query.month', moment().format('MMM'))
        let year = lodash.get(req, 'query.year', moment().format('YYYY'))
        let momentNow = moment().year(year).month(month)

        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: momentNow.clone().startOf('month').toDate(),
                $lt: momentNow.clone().endOf('month').toDate(),
            }
        })

        let undertimeView = lodash.get(req, 'query.undertime') == 1 ? true : false
        
        let days = dtrHelper.getDtrMonthlyView(month, year, attendances, true)

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
            undertimeView: undertimeView,
            matrix: kalendaryo.getMatrix(momentNow, 0)
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;