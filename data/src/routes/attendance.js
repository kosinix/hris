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
        let mCalendar = moment()
        // let mCalendar = moment('2021-06-01')
        let mNow = moment()
        let mFirstDay = mCalendar.clone().startOf('month')
        let mLastDay = mCalendar.clone().endOf('month')
        let matrix = kalendaryo.getMatrix(mCalendar, 0)
        let attendances = kalendaryo.getDays(mCalendar, 0)

        attendances = await db.main.Attendance.find({
            createdAt: {
                $gte: mFirstDay.toDate(),
                $lte: mLastDay.toDate(),
            }
        }).lean()

        for (let x = 0; x < attendances.length; x++) {
            attendances[x].employee = await db.main.Employee.findById(attendances[x].employeeId)
        }

        attendances = lodash.groupBy(attendances, (attendance) => {
            return moment(attendance.createdAt).format('YYYY-MM-DD')
        })

        // return res.send(attendances)
        matrix = matrix.map((row, i) => {
            row = row.map((cell) => {
                let mCellDate = moment(cell)
                let className = 'current'
                if (mCellDate.isBefore(mFirstDay)) {
                    cell = ''
                } else if (mCellDate.isAfter(mLastDay)) {
                    cell = ''

                } else if (mCellDate.isSame(mNow, 'day')) {
                    className = 'bg-current text-light'
                }
                if (i === 0 && ['Sun', 'Sat'].includes(cell)) {
                    className = 'text-danger'
                }
                if (['Sun', 'Sat'].includes(mCellDate.format('ddd'))) {
                    className = 'text-danger'
                }

                return {
                    value: cell,
                    attendances: attendances[cell],
                    classes: className,
                }
            })
            return row
        })

        // return res.send(matrix)
        res.render('attendance/all.html', {
            flash: flash.get(req, 'attendance'),

            // attendances: attendances,

            mCalendar: mCalendar,
            matrix: matrix
        });
    } catch (err) {
        next(err);
    }
});

router.get('/attendance/employee/:employeeId/employment/:employmentId', middlewares.guardRoute(['read_all_attendance', 'read_attendance']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment

        let start = lodash.get(req, 'query.start', moment().format('YYYY-MM-DD'))
        let end = lodash.get(req, 'query.end', moment().format('YYYY-MM-DD'))
        let undertimeView = lodash.get(req, 'query.undertime') == 1 ? true : false

        let startMoment = moment.utc(start)
        let endMoment = moment.utc(end)
        let momentNow = moment()

        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: startMoment.toDate(),
                $lte: endMoment.toDate(),
            }
        })

        let days = dtrHelper.getDtrTable(startMoment, endMoment, attendances, true)
        let totalMinutes = 0
        let totalMinutesUnderTime = 0
        days.forEach((day) => {
            totalMinutes += lodash.get(day, 'dtr.totalMinutes', 0)
            totalMinutesUnderTime += lodash.get(day, 'dtr.underTimeTotalMinutes', 0)
        })


        let timeRecordSummary = dtrHelper.getTimeBreakdown(totalMinutes, totalMinutesUnderTime, 8)

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
            selectedMonth: 'nu',
            undertimeView: undertimeView,
            timeRecordSummary: timeRecordSummary,
            startMoment: startMoment,
            endMoment: endMoment,
            // matrix: kalendaryo.getMatrix(momentNow, 0)
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;