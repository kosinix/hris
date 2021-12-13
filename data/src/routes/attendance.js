//// Core modules

//// External modules
const kalendaryo = require('kalendaryo');
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const momentRange = require('moment-range')
const momentExt = momentRange.extendMoment(moment)

//// Modules
const db = require('../db');
const dtrHelper = require('../dtr-helper');
const middlewares = require('../middlewares');
const payrollCalc = require('../payroll-calc');
const workScheduler = require('../work-scheduler');


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

        let query = {
            createdAt: {
                $gte: mFirstDay.toDate(),
                $lte: mLastDay.toDate(),
            }
        }
        // Mosqueda
        if (res.user.roles.includes('campusdirectormosqueda')) {
            let employmentIds = await db.main.Employment.find({
                campus: 'mosqueda'
            }).lean()

            employmentIds = employmentIds.map((e) => e._id)

            query['employmentId'] = {
                $in: employmentIds
            }
        }
        // Baterna
        if (res.user.roles.includes('campusdirectorbaterna')) {
            let employmentIds = await db.main.Employment.find({
                campus: 'baterna'
            }).lean()

            employmentIds = employmentIds.map((e) => e._id)

            query['employmentId'] = {
                $in: employmentIds
            }
        }

        let aggr = []
        aggr.push({ $match: query })
        aggr.push({
            $lookup: {
                from: "employees",
                localField: "employeeId",
                foreignField: "_id",
                as: "employees"
            }
        })
        aggr.push({
            $addFields: {
                "employee": {
                    $arrayElemAt: ["$employees", 0]
                }
            }
        })
        // Turn array employees into field employee
        // Add field employee
        aggr.push({
            $project: {
                employees: 0,
            }
        })

        attendances = await db.main.Attendance.aggregate(aggr)

        // Group by object with keys "YYYY-MM-DD" holding an array
        attendances = lodash.groupBy(attendances, (attendance) => {
            return moment(attendance.createdAt).format('YYYY-MM-DD')
        })

        matrix = matrix.map((row, i) => {
            row = row.map((cell) => {
                let mCellDate = moment(cell, 'YYYY-MM-DD', true)
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

        let query = {
            createdAt: {
                $gte: mCalendar.startOf('day').toDate(),
                $lte: mCalendar.endOf('day').toDate(),
            }
        }

        // Filter employees per campus depending on role
        let employeesForThisCampuses = []
        if (res.user.roles.includes('president')) {
            employeesForThisCampuses = lodash.union(employeesForThisCampuses, ['main', 'mosqueda', 'baterna'])
        }
        if (res.user.roles.includes('campusdirectormosqueda')) {
            employeesForThisCampuses = lodash.union(employeesForThisCampuses, ['mosqueda'])
        }
        if (res.user.roles.includes('campusdirectorbaterna')) {
            employeesForThisCampuses = lodash.union(employeesForThisCampuses, ['baterna'])
        }

        if (employeesForThisCampuses.length > 0) {
            let employments = await db.main.Employment.find({
                campus: {
                    $in: employeesForThisCampuses
                }
            }).lean()

            let _employmentIds = employments.map((e) => e._id)

            query['employmentId'] = {
                $in: _employmentIds
            }
        }

        let aggr = []
        aggr.push({ $match: query })
        aggr.push({
            $lookup: {
                from: "employees",
                localField: "employeeId",
                foreignField: "_id",
                as: "employees"
            }
        })
        aggr.push({
            $lookup: {
                from: "employments",
                localField: "employmentId",
                foreignField: "_id",
                as: "employments"
            }
        })

        aggr.push({
            $addFields: {
                "employee": {
                    $arrayElemAt: ["$employees", 0]
                },
                "employment": {
                    $arrayElemAt: ["$employments", 0]
                }
            }
        })
        // Turn array employees into field employee
        // Add field employee
        aggr.push({
            $project: {
                employees: 0,
                employments: 0,
            }
        })

        //console.log(aggr)
        attendances = await db.main.Attendance.aggregate(aggr)
        //return res.send(attendances)
        res.render('attendance/daily.html', {
            flash: flash.get(req, 'attendance'),
            mCalendar: mCalendar,
            attendances: attendances,
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
        let showWeekDays = lodash.get(req, 'query.showWeekDays', 'Mon|Tue|Wed|Thu|Fri')
        let showTotalAs = lodash.get(req, 'query.undertime') == 1 ? 'undertime' : 'time'

        let startMoment = moment(start).startOf('day')
        let endMoment = moment(end).endOf('day')

        if (!startMoment.isValid()) {
            throw new Error(`Invalid start date.`)
        }
        if (!endMoment.isValid()) {
            throw new Error(`Invalid end date.`)
        }

        if (endMoment.isBefore(startMoment)) {
            throw new Error(`Invalid end date. Must not be less than the start date.`)
        }

        let momentNow = moment()


        let options = {
            showTotalAs: showTotalAs,
            showWeekDays: showWeekDays,
        }
        if (!options.showWeekDays.length) {
            options.showWeekDays = showWeekDays.split('|')
        }
        let { days } = await dtrHelper.getDtrByDateRange(db, employee._id, employment._id, startMoment, endMoment, options)

        // console.log(options)
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
            momentNow: momentNow,
            months: months,
            days: days,
            selectedMonth: 'nu',
            showTotalAs: showTotalAs,
            showWeekDays: showWeekDays,
            timeRecordSummary: timeRecordSummary,
            startMoment: startMoment,
            endMoment: endMoment,
            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => o !== 'normal'),
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
        let workSchedules = await db.main.WorkSchedule.find().lean()

        attendance = lodash.merge({
            createdAt: '',
            employeeId: '',
            employmentId: '',
            logs: [],
            type: 'normal',
            workScheduleId: '',
        }, attendance)

        res.render('attendance/edit.html', {
            flash: flash.get(req, 'attendance'),
            attendanceTypes: CONFIG.attendance.types,
            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => o !== 'normal'),
            employee: employee,
            employment: employment,
            attendance: attendance,
            workSchedules: workSchedules,
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
        // return res.send(body)
        let patch = {}
        lodash.set(patch, 'type', lodash.get(body, 'type'))
        lodash.set(patch, 'workScheduleId', lodash.get(body, 'workScheduleId'))
        lodash.set(patch, 'log0', lodash.get(body, 'log0'))
        lodash.set(patch, 'log1', lodash.get(body, 'log1'))
        lodash.set(patch, 'log2', lodash.get(body, 'log2'))
        lodash.set(patch, 'log3', lodash.get(body, 'log3'))
        lodash.set(patch, 'comment', lodash.get(body, 'comment'))

        if (patch.type === '') {
            return res.redirect(`/attendance/employee/${employee._id}/employment/${employment._id}/attendance/${attendance._id}/edit`)
        }

        let { changeLogs, att } = await dtrHelper.editAttendance(db, attendance._id, patch, res.user)

        // return res.send(att)
        if (changeLogs.length) {
            flash.ok(req, 'attendance', `${changeLogs.join(' ')}`)
        } else {

        }
        res.redirect(`/attendance/employee/${employee._id}/employment/${employment._id}/attendance/${attendance._id}/edit`)
        // res.redirect(`/attendance/employee/${employee._id}/employment/${employment._id}?start=2021-11-02&end=2021-11-02`)
    } catch (err) {
        next(err);
    }
});

router.get('/attendance/employee/:employeeId/employment/:employmentId/attendance/create', middlewares.guardRoute(['create_attendance']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment.toObject()
        let workSchedules = await db.main.WorkSchedule.find().lean()

        res.render('attendance/create.html', {
            flash: flash.get(req, 'attendance'),
            attendanceTypes: CONFIG.attendance.types,
            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => o !== 'normal'),
            employee: employee,
            employment: employment,
            workSchedules: workSchedules,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/attendance/employee/:employeeId/employment/:employmentId/attendance/create', middlewares.guardRoute(['create_attendance']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
    try {
        let user = res.user.toObject()
        let employee = res.employee.toObject()
        let employment = res.employment.toObject()

        let body = req.body

        // return res.send(body)
        let patch = {}
        lodash.set(patch, 'type', lodash.get(body, 'type'))
        lodash.set(patch, 'workScheduleId', lodash.get(body, 'workScheduleId'))
        lodash.set(patch, 'log0', lodash.get(body, 'log0'))
        lodash.set(patch, 'log1', lodash.get(body, 'log1'))
        lodash.set(patch, 'log2', lodash.get(body, 'log2'))
        lodash.set(patch, 'log3', lodash.get(body, 'log3'))
        lodash.set(patch, 'comment', lodash.get(body, 'comment'))
        lodash.set(patch, 'date', lodash.get(body, 'date'))




        let whiteList = CONFIG.attendance.types.map(o => o.value)
        if (!whiteList.includes(patch.type)) {
            throw new Error(`Invalid attendance type "${patch.type}".`)
        }

        let conflict = await db.main.Attendance.findOne({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment(patch.date).startOf('day').toDate(),
                $lt: moment(patch.date).endOf('day').toDate(),
            }
        }).lean()

        if (conflict) {
            throw new Error(`Already have attendance on this date. Please edit it instead.`)

        }

        let attendance = {
            employeeId: employee._id,
            employmentId: employment._id,
            type: patch.type,
            workScheduleId: patch.workScheduleId,
            createdAt: moment(patch.date).toDate(),
            logs: [],
            changes: [],
            comments: [],
        }

        attendance.changes.push({
            summary: `${user.username} inserted a new attendance.`,
            objectId: user._id,
            createdAt: moment().toDate()
        })

        if (patch.type === 'normal') {
            for (x = 0; x < 4; x++) {
                let logPatch = lodash.get(patch, `log${x}`)

                if (logPatch) {

                    let time = logPatch.split(':')
                    let hours = parseInt(time[0])
                    let minutes = parseInt(time[1])
                    let mDate = moment(attendance.createdAt).hour(hours).minute(minutes)


                    let mode = 1 // 1 = "time-in" which is always the first log mode
                    let lastLog = attendance.logs[attendance.logs.length - 1]
                    if (lastLog) {
                        mode = lastLog.mode === 1 ? 0 : 1 // Flip 1 or 0
                    }

                    attendance.logs.push({
                        scannerId: null,
                        dateTime: mDate.toDate(),
                        mode: mode
                    })

                    let newTime = mDate.format('hh:mm A')

                    let message = `${user.username} added time log #${x + 1} set to ${newTime}.`
                    attendance.changes.push({
                        summary: message,
                        objectId: user._id,
                        createdAt: moment().toDate()
                    })
                }
            }
        }

        if (patch.comment) {
            attendance.comments.push({
                summary: patch.comment,
                objectId: user._id,
                createdAt: moment().toDate()
            })

            let message = `${user.username} added a new comment.`
            attendance.changes.push({
                summary: message,
                objectId: user._id,
                createdAt: moment().toDate()
            })

        }

        attendance = await db.main.Attendance.create(attendance)

        console.log(attendance)

        flash.ok(req, 'attendance', `Inserted new attendance.`)
        res.redirect(`/attendance/employee/${employee._id}/employment/${employment._id}/attendance/${attendance._id}/edit`)
    } catch (err) {
        next(err);
    }
});

// Work Schedule
router.get('/attendance/schedule/all', middlewares.guardRoute(['read_all_schedule', 'read_schedule']), async (req, res, next) => {
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
router.get('/attendance/schedule/create', middlewares.guardRoute(['create_schedule']), async (req, res, next) => {
    try {

        let employeeLists = await db.main.EmployeeList.find({}, { _id: 1, name: 1 })
        res.render('attendance/schedule-create.html', {
            flash: flash.get(req, 'schedule'),
            employeeLists: employeeLists,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/attendance/schedule/create', middlewares.guardRoute(['create_schedule']), async (req, res, next) => {
    try {

        let body = lodash.get(req, 'body')

        let name = lodash.get(body, 'name')
        let visibility = lodash.get(body, 'visibility', '')
        let memberIds = lodash.get(body, 'memberIds')

        // return res.send(body)



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

        let members = []
        if (visibility === 'members') {
            if (!memberIds) {
                let err = new Error('No members selected.')
                err.type = 'flash'
                throw err
            } else {
                memberIds = memberIds.split(',').map(id => new db.mongoose.Types.ObjectId(id))
                for (let x = 0; x < memberIds.length; x++) {
                    let memberId = memberIds[x]
                    let objectId = null
                    let name = ''
                    let type = ''

                    let employment = await db.main.Employment.findById(memberId)
                    if (employment) {
                        objectId = employment._id
                        type = 'employment'
                        let employee = await db.main.Employee.findById(employment.employeeId)
                        if (employee) {
                            name = `${employee.firstName} ${employee.lastName} - ${employment.position}`
                        }
                    } else {
                        let employeeList = await db.main.EmployeeList.findById(memberId)
                        if (employeeList) {
                            objectId = employeeList._id
                            name = `${employeeList.name} - ${employeeList.tags.join(',')}`
                            type = 'list'
                        }
                    }
                    if (objectId && name && type) {
                        members.push({
                            objectId: objectId,
                            name: name,
                            type: type,
                        })
                    }

                }
            }
        }

        let patch = {
            name: name,
            visibility: visibility,
            members: members,
            timeSegments: timeSegments
        }
        // return res.send(patch)
        await db.main.WorkSchedule.create(patch)
        flash.ok(req, 'schedule', `Work schedule created.`)
        return res.redirect('/attendance/schedule/all')
    } catch (err) {
        if (err.type === 'flash') {
            flash.error(req, 'schedule', `Error: ${err.message}`)
            return res.redirect('/attendance/schedule/create')
        }
        next(err);
    }
});

router.get('/attendance/schedule/:scheduleId', middlewares.guardRoute(['update_schedule']), middlewares.getSchedule, async (req, res, next) => {
    try {
        let schedule = res.schedule.toObject()

        schedule.timeSegments = schedule.timeSegments.map((t) => {
            t.start = moment().startOf('day').minutes(t.start).format('hh:mm A')
            t.end = moment().startOf('day').minutes(t.end).format('hh:mm A')
            return t
        })

        let employeeLists = await db.main.EmployeeList.find({
            tags: {
                $in: ['Employment']
            }
        })

        res.render('attendance/schedule-read.html', {
            flash: flash.get(req, 'schedule'),
            schedule: schedule,
            employeeLists: employeeLists
        });
    } catch (err) {
        next(err);
    }
});
router.post('/attendance/schedule/:scheduleId/members', middlewares.guardRoute(['update_schedule']), middlewares.getSchedule, async (req, res, next) => {
    try {
        let listIds = lodash.get(req, 'body.listIds', [])

        let employeeListeds = await db.main.EmployeeList.find({
            _id: {
                $in: listIds
            }
        },
            {
                members: true
            }).lean()
        let members = []
        employeeListeds.forEach((o) => {
            o.members.forEach((m) => {
                members.push(m)
            })
        })

        members.sort((a, b) => {
            if (a.lastName < b.lastName) {
                return -1;
            }
            if (a.lastName > b.lastName) {
                return 1;
            }
            return 0;
        })

        let employmentIds = members.map((m) => m.employmentId)

        let r = await db.main.Employment.updateMany({
            _id: {
                $in: employmentIds
            }
        }, {
            workScheduleId: res.schedule._id
        })
        // return res.send(r) 

        res.schedule.members = members
        await res.schedule.save()

        flash.ok(req, 'schedule', 'Work scheduled applied to ' + members.length + ' employee(s).')
        res.redirect(`/attendance/schedule/${res.schedule._id}`)

    } catch (err) {
        next(err);
    }
});
router.get('/attendance/schedule/:scheduleId/members/:memberId/delete', middlewares.guardRoute(['delete_schedule']), middlewares.getSchedule, async (req, res, next) => {
    try {
        let memberId = lodash.get(req, 'params.memberId')

        let member = ''
        res.schedule.members = res.schedule.toObject().members.filter((m) => {
            if (m._id.toString() === memberId) {
                member = m.lastName + ', ' + m.firstName
            }
            return m._id.toString() !== memberId
        })

        await res.schedule.save()

        flash.ok(req, 'schedule', `Removed ${member} from list.`)
        res.redirect(`/attendance/schedule/${res.schedule._id}`)

    } catch (err) {
        next(err);
    }
});

// Attendance Review
router.get('/attendance/review/all', middlewares.guardRoute(['read_all_attendance', 'update_attendance']), async (req, res, next) => {
    try {

        let start = lodash.get(req, 'query.start', moment().format('YYYY-MM-DD'))
        let end = lodash.get(req, 'query.end', moment().format('YYYY-MM-DD'))

        let startMoment = moment(start).startOf('day')
        let endMoment = moment(end).endOf('day')

        if (!startMoment.isValid()) {
            throw new Error(`Invalid start date.`)
        }
        if (!endMoment.isValid()) {
            throw new Error(`Invalid end date.`)
        }

        if (endMoment.isBefore(startMoment)) {
            throw new Error(`Invalid end date. Must not be less than the start date.`)
        }

        let aggr = [
            {
                $match: {
                    status: 'pending'
                }
            },
            {
                $lookup: {
                    localField: 'attendanceId',
                    foreignField: '_id',
                    from: 'attendances',
                    as: 'attendances'
                }
            },
            {
                $addFields: {
                    "attendance": {
                        $arrayElemAt: ["$attendances", 0]
                    }
                }
            },
            {
                $project: {
                    attendances: 0,
                }
            },
            {
                $lookup: {
                    localField: 'workScheduleId',
                    foreignField: '_id',
                    from: 'workschedules',
                    as: 'workSchedules'
                }
            },
            {
                $addFields: {
                    "workSchedule": {
                        $arrayElemAt: ["$workSchedules", 0]
                    }
                }
            },
            {
                $project: {
                    workSchedules: 0,
                }
            },
            {
                $lookup: {
                    localField: 'employeeId',
                    foreignField: '_id',
                    from: 'employees',
                    as: 'employees'
                }
            },
            {
                $addFields: {
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
            {
                $lookup: {
                    localField: 'employmentId',
                    foreignField: '_id',
                    from: 'employments',
                    as: 'employments'
                }
            },
            {
                $addFields: {
                    "employment": {
                        $arrayElemAt: ["$employments", 0]
                    }
                }
            },
            {
                $project: {
                    employments: 0,
                }
            }
        ]
        let attendanceReviews = await db.main.AttendanceReview.aggregate(aggr)
        let attendanceReview = attendanceReviews[0]

        let workSchedules = await db.main.WorkSchedule.find()
        let workSchedule1 = workSchedules.find(o => {
            return lodash.invoke(o, '_id.toString') === lodash.invoke(attendanceReview, 'employment.workScheduleId.toString')
        })
        let workSchedule2 = workSchedules.find(o => {
            return lodash.invoke(o, '_id.toString') === lodash.invoke(attendanceReview, 'workScheduleId.toString')
        })

        let data = {
            flash: flash.get(req, 'attendance'),
            attendanceReviews: attendanceReviews,
            attendanceReview: attendanceReview,
            workSchedule1: workSchedule1,
            workSchedule2: workSchedule2,
        }
        // return res.send(data)
        res.render('attendance/review.html', data);
    } catch (err) {
        next(err);
    }
});
router.post('/attendance/review/:reviewId', middlewares.guardRoute(['update_attendance']), async (req, res, next) => {
    try {
        let user = res.user
        let reviewId = lodash.get(req, 'params.reviewId')
        let attendanceReview = await db.main.AttendanceReview.findById(reviewId).lean()
        let attendance = null
        if (attendanceReview) {
            attendance = await db.main.Attendance.findById(attendanceReview.attendanceId).lean()
        }
        if (attendance) {

        }

        let action = lodash.get(req, 'body.action')
        if (action == 'reject') {
            await db.main.AttendanceReview.updateOne({ _id: attendanceReview._id }, { status: 'rejected' })
            attendance.changes.push({
                summary: `${user.username} rejected review #${attendanceReview._id}.`,
                objectId: user._id,
                createdAt: moment().toDate()
            })
            await db.main.Attendance.updateOne({ _id: attendance._id }, { changes: attendance.changes })
        } else if (action == 'approve') {
            let patch = {}
            lodash.set(patch, 'type', lodash.get(attendanceReview, 'type'))
            lodash.set(patch, 'workScheduleId', lodash.get(attendanceReview, 'workScheduleId'))

            let log0 = lodash.get(attendanceReview, 'logs[0].dateTime')
            let log1 = lodash.get(attendanceReview, 'logs[1].dateTime')
            let log2 = lodash.get(attendanceReview, 'logs[2].dateTime')
            let log3 = lodash.get(attendanceReview, 'logs[3].dateTime')

            if (patch.type === '') {
                return res.redirect(`/attendance/review/all`)
            }

            if (log0) {
                lodash.set(patch, 'log0', moment(log0).format('HH:mm'))
            }
            if (log1) {
                lodash.set(patch, 'log1', moment(log1).format('HH:mm'))
            }
            if (log2) {
                lodash.set(patch, 'log2', moment(log2).format('HH:mm'))
            }
            if (log3) {
                lodash.set(patch, 'log3', moment(log3).format('HH:mm'))
            }

            let { changeLogs, att } = await dtrHelper.editAttendance(db, attendance._id, patch, res.user)
            console.log(changeLogs)

            await db.main.AttendanceReview.updateOne({ _id: attendanceReview._id }, { status: 'approved' })

            attendance.changes.push({
                summary: `${user.username} approved review #${attendanceReview._id}.`,
                objectId: user._id,
                createdAt: moment().toDate()
            })
            await db.main.Attendance.updateOne({ _id: attendance._id }, { changes: attendance.changes })

        }
        let data = {
            attendanceReview: attendanceReview,
            attendance: attendance,
        }

        flash.ok(req, 'attendance', 'Done.')
        return res.redirect('/attendance/review/all')
    } catch (err) {
        next(err);
    }
});

module.exports = router;