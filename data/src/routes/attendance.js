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

router.get('/attendance/monthly', middlewares.guardRoute(['read_all_attendance', 'read_attendance']), async (req, res, next) => {
    try {
        let date = lodash.get(req, 'query.date', moment().format('YYYY-MM-DD'))
        let mCalendar = moment(date)
        let mNow = moment()
        let mFirstDay = mCalendar.clone().startOf('month')
        let mLastDay = mCalendar.clone().endOf('month')
        let matrix = kalendaryo.getMatrix(mCalendar, 0)
        let attendances = kalendaryo.getDays(mCalendar, 0)

        attendances = await db.main.Attendance.aggregate([
            {
                $match:
                {
                    createdAt: {
                        $gte: mFirstDay.toDate(),
                        $lte: mLastDay.toDate(),
                    }
                }
            },
            {
                $lookup:
                {
                    from: "employees",
                    localField: "employeeId",
                    foreignField: "_id",
                    as: "employees"
                }
            },
            // Turn array employees into field employee
            // Add field employee
            {
                "$addFields": {
                    "employee": {
                        $arrayElemAt: ["$employees", 0]
                    }
                }
            },
            {
                $project: {
                    employees: 0,
                }
            },
        ])

        // Group by object with keys "YYYY-MM-DD" holding an array
        attendances = lodash.groupBy(attendances, (attendance) => {
            return moment(attendance.createdAt).format('YYYY-MM-DD')
        })

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

        let months = Array.from(Array(12).keys()).map((e, i) => {
            return mCalendar.clone().month(i).startOf('month')
        }); // 1-count

        let years = []
        for (let y = parseInt(moment().format('YYYY')); y > 1999; y--) {
            years.push(y)
        }

        res.render('attendance/monthly.html', {
            flash: flash.get(req, 'attendance'),
            months: months,
            mCalendar: mCalendar,
            matrix: matrix,
            years: years
        });
    } catch (err) {
        next(err);
    }
});

router.get('/attendance/daily', middlewares.guardRoute(['read_all_attendance', 'read_attendance']), async (req, res, next) => {
    try {
        let date = lodash.get(req, 'query.date', moment().format('YYYY-MM-DD'))
        let mCalendar = moment(date)
        let mNow = moment()

        attendances = await db.main.Attendance.aggregate([
            {
                $match:
                {
                    createdAt: {
                        $gte: mCalendar.startOf('day').toDate(),
                        $lte: mCalendar.endOf('day').toDate(),
                    }
                }
            },
            {
                $lookup:
                {
                    from: "employees",
                    localField: "employeeId",
                    foreignField: "_id",
                    as: "employees"
                }
            },
            // Turn array employees into field employee
            // Add field employee
            {
                "$addFields": {
                    "employee": {
                        $arrayElemAt: ["$employees", 0]
                    }
                }
            },
            {
                $project: {
                    employees: 0,
                }
            },
        ])

        res.render('attendance/daily.html', {
            flash: flash.get(req, 'attendance'),
            mCalendar: mCalendar,
            attendances: attendances
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

        let startMoment = moment(start).startOf('day')
        let endMoment = moment(end).endOf('day')
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
router.get('/attendance/employee/:employeeId/employment/:employmentId/attendance/:attendanceId/edit', middlewares.guardRoute(['update_attendance']), middlewares.getEmployee, middlewares.getEmployment, middlewares.getAttendance, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment.toObject()
        let attendance = res.attendance.toObject()

        res.render('attendance/edit.html', {
            flash: flash.get(req, 'attendance'),
            employee: employee,
            employment: employment,
            attendance: attendance,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/attendance/employee/:employeeId/employment/:employmentId/attendance/:attendanceId/edit', middlewares.guardRoute(['update_attendance']), middlewares.getEmployee, middlewares.getEmployment, middlewares.getAttendance, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment.toObject()
        let attendance = res.attendance.toObject()

        let body = req.body
        let patch = {}
        lodash.set(patch, 'attendanceType', lodash.get(body, 'attendanceType'))
        lodash.set(patch, 'log0', lodash.get(body, 'log0'))
        lodash.set(patch, 'log1', lodash.get(body, 'log1'))
        lodash.set(patch, 'log2', lodash.get(body, 'log2'))
        lodash.set(patch, 'log3', lodash.get(body, 'log3'))


        if (patch.attendanceType === 'wfh') {
            attendance.wfh = true
            attendance.onTravel = false
        } else if (patch.attendanceType === 'travel') {
            attendance.onTravel = true
            attendance.wfh = false
        } else {
            attendance.wfh = false
            attendance.onTravel = false
        }

        attendance.logs = attendance.logs.map((log, i) => {
            let time = patch[`log${i}`].split(':')
            let mDate = moment(attendance.createdAt).hour(parseInt(time[0])).minute(parseInt(time[1]))
            log.dateTime = mDate.toDate()
            return log
        })

        await db.main.Attendance.updateOne({ _id: attendance._id }, attendance)
        flash.ok(req, 'attendance', `Attendance changed.`)
        res.redirect(`/attendance/employee/${employee._id}/employment/${employment._id}?start=${moment(attendance.createdAt).format('YYYY-MM-DD')}&end=${moment(attendance.createdAt).format('YYYY-MM-DD')}`)
    } catch (err) {
        next(err);
    }
});

router.get('/attendance/schedule/all', middlewares.guardRoute(['read_all_attendance', 'read_attendance']), async (req, res, next) => {
    try {
        let schedules = await db.main.WorkSchedule.find().lean()
        schedules = schedules.map((o) => {
            o.timeSegments = o.timeSegments.map((t) => {
                t.start = moment().startOf('day').minutes(t.start).format('hh:mm A')
                t.end = moment().startOf('day').minutes(t.end).format('hh:mm A')
                return t
            })
            return o
        })

        res.render('attendance/schedule.html', {
            flash: flash.get(req, 'schedule'),
            schedules: schedules,
        });
    } catch (err) {
        next(err);
    }
});
router.get('/attendance/schedule/create', middlewares.guardRoute(['read_all_attendance', 'read_attendance']), async (req, res, next) => {
    try {

        res.render('attendance/schedule-create.html', {
            flash: flash.get(req, 'schedule'),
        });
    } catch (err) {
        next(err);
    }
});
router.post('/attendance/schedule/create', middlewares.guardRoute(['read_all_attendance', 'read_attendance']), async (req, res, next) => {
    try {

        let name = lodash.get(req, 'body.name')
        let timeSegments = lodash.get(req, 'body.timeSegments', [])
        if (timeSegments.length <= 0) {
            let err = new Error('No time segments.')
            err.type = 'flash'
            throw err
        }

        let errors = []
        timeSegments.forEach((timeSegment, i) => {
            let momentStart = moment.utc(timeSegment.start, 'HH:mm')
            let momentEnd = moment.utc(timeSegment.end, 'HH:mm')
            if (!momentStart.isValid()) {
                errors.push(`Start time for segment #${i + 1} is invalid.`)
            }
            if (!momentEnd.isValid()) {
                errors.push(`End time for segment #${i + 1} is invalid.`)
            }
        })
        if (errors.length > 0) {
            let err = new Error(`${errors.join(' ')}`)
            err.type = 'flash'
            throw err
        }
        timeSegments = timeSegments.map((timeSegment, i) => {
            timeSegment.start = moment.utc(timeSegment.start, 'HH:mm').hours() * 60 + moment.utc(timeSegment.start, 'HH:mm').minutes()
            timeSegment.end = moment.utc(timeSegment.end, 'HH:mm').hours() * 60 + moment.utc(timeSegment.end, 'HH:mm').minutes()
            timeSegment.grace = (lodash.toNumber(lodash.get(timeSegment, 'grace', 0)))
            timeSegment.maxHours = (timeSegment.end - timeSegment.start) / 60
            timeSegment.flexible = false
            return timeSegment
        })
        let patch = {
            name: name,
            timeSegments: timeSegments
        }
        let workSchedule = await db.main.WorkSchedule.create(patch)
        return res.send(workSchedule)
        res.render('attendance/schedule-create.html', {
            flash: flash.get(req, 'schedule'),
        });
    } catch (err) {
        if (err.type === 'flash') {
            flash.error(req, 'schedule', `Error: ${err.message}`)
            return res.redirect('/attendance/schedule/create')
        }
        next(err);
    }
});
module.exports = router;