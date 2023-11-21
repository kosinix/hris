//// Core modules
const path = require('path')

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const momentRange = require('moment-range')
const momentExt = momentRange.extendMoment(moment)
const qr = require('qr-image')
const sharp = require('sharp')

//// Modules
const address = require('../address');
const countries = require('../countries');
const dtrHelper = require('../dtr-helper');
const excelGen = require('../excel-gen');
const middlewares = require('../middlewares');
const passwordMan = require('../password-man');
const paginator = require('../paginator');
const suffixes = require('../suffixes');
const { AppError } = require('../errors');
const uploader = require('../uploader');
const workScheduler = require('../work-scheduler');

// Router
let router = express.Router()

router.use('/e/dtr', middlewares.requireAuthUser)

router.get(['/e/dtr/:employmentId', '/e/dtr/print/:employmentId'], middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, middlewares.getDtrQueries, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let employmentId = employment._id

        let {
            periodMonthYear,
            periodSlice,
            periodWeekDays,
            showTotalAs,
            showWeekDays,
            startMoment,
            endMoment,
            countTimeBy,
        } = res


        let showDays = 0
        if (periodWeekDays === 'Mon-Fri') {
            showDays = 1
        } else if (periodWeekDays === 'Sat-Sun') {
            showDays = 4
        }
        let options = {
            padded: true,
            showTotalAs: showTotalAs,
            showWeekDays: showWeekDays,
            periodWeekDays: periodWeekDays,
            showDays: showDays,
        }

        let days = await dtrHelper.getDtrDays(req.app.locals.db, employment._id, startMoment, endMoment, options)
        let stats = dtrHelper.getDtrStats(days)

        let periodMonthYearMoment = moment(periodMonthYear)
        const range1 = momentExt.range(periodMonthYearMoment.clone().subtract(6, 'months'), periodMonthYearMoment.clone().add(6, 'months'))
        let months = Array.from(range1.by('months')).reverse()

        let periodMonthYearList = months.map((_moment) => {
            let date = _moment.startOf('month')

            return {
                value: date.format('YYYY-MM-DD'),
                text: date.format('MMM YYYY'),
            }
        })

        let workSchedules = await workScheduler.getEmploymentWorkSchedule(req.app.locals.db, employmentId)

        let workSchedule = await req.app.locals.db.main.WorkSchedule.findById(employment.workScheduleId)

        let workScheduleWeekDays = dtrHelper.workScheduleDisplay(workSchedule, [
            'mon',
            'tue',
            'wed',
            'thu',
            'fri',
        ])

        let workScheduleWeekEnd = dtrHelper.workScheduleDisplay(workSchedule, [
            'sat',
            'sun',
        ])

        let workScheduleWeek = dtrHelper.workScheduleDisplay(workSchedule, [
            'mon',
            'tue',
            'wed',
            'thu',
            'fri',
            'sat',
            'sun',
        ])

        let salary = employment?.salary ?? 0
        // let dailyRate = dtrHelper.getDailyRate(salary, employment.salaryType) // Unified computation for daily
        let hourlyRate = dtrHelper.getHourlyRate(salary, employment.salaryType) // Unified computation for hourly

        // Get IGP employmentId
        let listIGP = await req.app.locals.db.main.EmployeeList.findOne({
            name: /With Sliding Time/ig
        }).lean()
        listIGP = lodash.get(listIGP, 'members', []).map(o => o.employmentId.toString())
        
        let data = {
            title: `DTR - ${employee.firstName} ${employee.lastName} ${employee.suffix}`,

            flash: flash.get(req, 'employee'),

            employee: employee,
            employment: employment,
            hourlyRate: hourlyRate,

            // Data that might change
            days: days,
            stats: stats,

            showTotalAs: showTotalAs,
            workSchedules: workSchedules,
            periodMonthYearList: periodMonthYearList,
            periodMonthYear: periodMonthYearMoment.format('YYYY-MM-DD'),
            periodWeekDays: periodWeekDays,
            periodSlice: periodSlice,
            inCharge: employment.inCharge,
            countTimeBy: countTimeBy,

            showDays: showDays,

            startDate: startMoment.format('YYYY-MM-DD'),
            endDate: endMoment.format('YYYY-MM-DD'),

            workSchedule: workSchedule,
            shared: false,

            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => !['normal'].includes(o)),
            workScheduleWeekDays: workScheduleWeekDays,
            workScheduleWeekEnd: workScheduleWeekEnd,
            workScheduleWeek: workScheduleWeek,

            listIGP: listIGP
        }

        // return res.send(req.path)
        if (req.xhr) {
            return res.json(data)
        }


        // console.log(stats)
        // return res.send(days)

        if (/^\/e\/dtr\/print/.test(req.path)) {
            return res.render('e/dtr/print8.html', data)
        }
        res.render('e/dtr/dtr8.html', data)
    } catch (err) {
        next(err);
    }
});

// Overtime
router.get(['/e/dtr/:employmentId/overtime', '/e/dtr/:employmentId/overtime-print'], middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, middlewares.getDtrQueries, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let employmentId = employment._id
        let scheduleName = req.query?.scheduleName ?? 'Overtime Weekdays'
        let overrideWorkSched = await req.app.locals.db.main.WorkSchedule.findOne({
            name: scheduleName
        }).lean()
        if (!overrideWorkSched) {
            throw new Error('Could not find overtime schedule.')
        }
        if (employment.employmentType !== 'cos') {
            throw new Error('Not allowed.')
        }

        let {
            periodMonthYear,
        } = res

        let start = lodash.get(req, 'query.start', moment().startOf('month').format('YYYY-MM-DD'))
        let end = lodash.get(req, 'query.end', moment().format('YYYY-MM-DD'))
        let showTotalAs = lodash.get(req, 'query.undertime') == 1 ? 'undertime' : 'time'
        let showDays = parseInt(lodash.get(req, 'query.showDays', 0))

        let startMoment = moment(periodMonthYear).startOf('month').startOf('day')
        let endMoment = startMoment.clone().endOf('month').endOf('day')

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

        // Normal days
        let options = {
            showTotalAs: showTotalAs,
            showDays: showDays, // 0 - all, 1 - workdays (Mon-Fri, excl. holidays), 2 - weekends, 3 - holidays, 4 - weekends + holidays
        }

        let days = await dtrHelper.getDtrDays(req.app.locals.db, employment._id, startMoment, endMoment, options)
        let stats = dtrHelper.getDtrStats(days)
        // return res.send(days)

        // OT Days
        options = {
            showTotalAs: showTotalAs,
            showDays: showDays, // 0 - all, 1 - workdays (Mon-Fri, excl. holidays), 2 - weekends, 3 - holidays, 4 - weekends + holidays
            overrideWorkSched: overrideWorkSched
        }
        let days2 = await dtrHelper.getDtrDays(req.app.locals.db, employment._id, startMoment, endMoment, options)
        let stats2 = dtrHelper.getDtrStats(days2)

        let salary = employment?.salary ?? 0
        // let dailyRate = dtrHelper.getDailyRate(salary, employment.salaryType) // Unified computation for daily
        let hourlyRate = dtrHelper.getHourlyRate(salary, employment.salaryType) // Unified computation for hourly


        days2 = days2.map(day => {

            day.hourlyRate = hourlyRate
            day.rate = hourlyRate * 1
            if (day.isWorkday) {
                day.rate = hourlyRate * 1.25
            } else if (day.isRestday) {
                day.rate = hourlyRate * 1.5
            }
            day.rate = parseFloat((day.rate).toFixed(2))
            let numOfHours = dtrHelper.roundOff(day?.time?.asHours ?? 0, 10)
            lodash.set(day, 'numOfHours', numOfHours)
            lodash.set(day, 'time.OTPay', day.rate * numOfHours)

            return day
        })
        // return res.send(stats)

        if (req?.query?.includes) {
            let includes = req.query.includes.split('_')
            console.log('includes', includes)
            days = days.filter(day => {
                return includes.includes(day.date)
            })
            days2 = days2.filter(day => {
                return includes.includes(day.date)
            })
        }
        // console.log(kalendaryo.getMatrix(momentNow, 0))
        let months = Array.from(Array(12).keys()).map((e, i) => {
            return moment.utc().month(i).startOf('month')
        }); // 1-count
        // return res.send(days2)

        showTotalAs = 'time'
        if (req?.query?.undertime == 1) {
            showTotalAs = 'undertime'
        }


        let data = {
            flash: flash.get(req, 'attendance'),
            employee: employee,
            employment: employment,
            momentNow: momentNow,
            months: months,
            days: days,
            days2: days2,
            stats: stats,
            stats2: stats2,
            selectedMonth: 'nu',
            showTotalAs: showTotalAs,
            showDays: showDays,
            startMoment: startMoment,
            endMoment: endMoment,
            hourlyRate: hourlyRate,
            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => o !== 'normal'),
        }
        if (req.originalUrl.indexOf('overtime-print') > -1) {
            res.locals.title = 'Extended Services Annex A'
            return res.render('attendance/overtime-print.html', data);
        }
        res.render('e/dtr/overtime.html', data);
    } catch (err) {
        next(err);
    }
});
router.post('/e/dtr/:employmentId/overtime', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, middlewares.getDtrQueries, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let employmentId = employment._id
        const attendances = req.body?.attendances ?? []

        res.redirect(`/e/dtr/${employment._id}/overtime-print?start=${req.body.start}&end=${req.body.end}&showDays=${req.body.showDays}&includes=${attendances.join('_')}`)
    } catch (err) {
        next(err);
    }
});

// Schedule
router.get(['/e/dtr/:employmentId/schedule', '/e/dtr/:employmentId/schedule-print'], middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, middlewares.getDtrQueries, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let employmentId = employment._id
        let scheduleName = req.query?.scheduleName ?? 'Overtime Weekdays'
        let overrideWorkSched = await req.app.locals.db.main.WorkSchedule.findOne({
            name: scheduleName
        }).lean()
        if (!overrideWorkSched) {
            throw new Error('Could not find overtime schedule.')
        }
        if (employment.employmentType !== 'cos') {
            throw new Error('Not allowed.')
        }

        let {
            periodMonthYear,
        } = res

        let start = lodash.get(req, 'query.start', moment().startOf('month').format('YYYY-MM-DD'))
        let end = lodash.get(req, 'query.end', moment().format('YYYY-MM-DD'))
        let showTotalAs = lodash.get(req, 'query.undertime') == 1 ? 'undertime' : 'time'
        let showDays = parseInt(lodash.get(req, 'query.showDays', 0))

        let startMoment = moment(periodMonthYear).startOf('month').startOf('day')
        let endMoment = startMoment.clone().endOf('month').endOf('day')

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

        // Normal days
        let options = {
            showTotalAs: showTotalAs,
            showDays: showDays, // 0 - all, 1 - workdays (Mon-Fri, excl. holidays), 2 - weekends, 3 - holidays, 4 - weekends + holidays
        }

        let days = await dtrHelper.getDtrDays(req.app.locals.db, employment._id, startMoment, endMoment, options)
        let stats = dtrHelper.getDtrStats(days)
        // return res.send(days)

        if (req?.query?.includes) {
            let includes = req.query.includes.split('_')
            console.log('includes', includes)
            days = days.filter(day => {
                return includes.includes(day.date)
            })

        }
        // console.log(kalendaryo.getMatrix(momentNow, 0))
        let months = Array.from(Array(12).keys()).map((e, i) => {
            return moment.utc().month(i).startOf('month')
        }); // 1-count
        // return res.send(days2)

        showTotalAs = 'time'
        if (req?.query?.undertime == 1) {
            showTotalAs = 'undertime'
        }

        let data = {
            flash: flash.get(req, 'attendance'),
            employee: employee,
            employment: employment,
            momentNow: momentNow,
            months: months,
            days: days,
            stats: stats,
            selectedMonth: 'nu',
            showTotalAs: showTotalAs,
            showDays: showDays,
            startMoment: startMoment,
            endMoment: endMoment,
            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => o !== 'normal'),
        }
        // return res.send(days)
        if (req.originalUrl.indexOf('overtime-print') > -1) {
            res.locals.title = 'Extended Services Annex A'
            return res.render('e/dtr/overtime-print.html', data);
        }
        res.render('e/dtr/schedule.html', data);
    } catch (err) {
        next(err);
    }
});
router.post('/e/dtr/:employmentId/schedule', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, middlewares.getDtrQueries, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let employmentId = employment._id
        const attendances = req.body?.attendances ?? []

        // return res.send(req.body.submit)
        let schedule = await req.app.locals.db.main.WorkSchedule.findOne({
            name: /IGP Sliding/ig
        }).lean()
        if (!schedule) {
            throw new Error('Sliding schedule not found.')
        }

        let attendanceIds = attendances.map((a) => {
            return req.app.locals.db.mongoose.Types.ObjectId(a)
        })

        let results = {}
        if (req.body.submit === 'change') {
            results = await req.app.locals.db.main.Attendance.update(
                {
                    _id: {
                        $in: attendanceIds
                    },
                    employmentId: employmentId, // Limit to this employee only
                    workScheduleId: {
                        $ne: employmentId
                    }
                },
                {
                    $set: {
                        workScheduleId: schedule._id
                    },
                },
                {
                    multi: true
                }
            )
            if (results.n > 0) {
                flash.ok(req, 'employee', `Changed ${results.n} attendance(s) to Sliding Time.`)
            }

        } else {
            results = await req.app.locals.db.main.Attendance.update(
                {
                    _id: {
                        $in: attendanceIds
                    },
                    employmentId: employmentId, // Limit to this employee only
                    workScheduleId: {
                        $ne: employment.workScheduleId
                    }
                },
                {
                    $set: {
                        workScheduleId: employment.workScheduleId
                    },
                },
                {
                    multi: true
                }
            )
            if (results.n > 0) {
                flash.ok(req, 'employee', `Changed ${results.n} attendance(s) to Normal Sched.`)
            }
        }
        res.redirect(`/e/dtr/${employment._id}`)
    } catch (err) {
        next(err);
    }
});

// Delete
router.get('/e/dtr/attendance/:attendanceId/delete', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeAttendance, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let attendance = res.attendance.toObject()
        let employment = await req.app.locals.db.main.Employment.findById(lodash.get(attendance, 'employmentId'))
        let workSchedules = await req.app.locals.db.main.WorkSchedule.find().lean()
        let workSchedule = {}
        let workScheduleTimeSegments = await req.app.locals.db.main.WorkSchedule.getWorkScheduleTimeSegments(req.app.locals.db, lodash.get(attendance, 'workScheduleId', employment.workScheduleId), attendance.createdAt)

        // Normalize schema
        attendance = dtrHelper.normalizeAttendance(attendance, employee, workScheduleTimeSegments)

        // Schedule segments
        let timeSegments = dtrHelper.buildTimeSegments(workScheduleTimeSegments)
        let logSegments = dtrHelper.buildLogSegments(attendance.logs)
        let options = {
            ignoreZero: true,
            noSpill: true
        }
        if (employment.employmentType === 'part-time' || attendance.type !== 'normal') {
            options.noSpill = false
        }
        let timeWorked = dtrHelper.countWork(timeSegments, logSegments, options)
        let readableSchedule = dtrHelper.readableSchedule(workScheduleTimeSegments)

        // return res.send(dtrHelper.logSegmentsDtrFormat(logSegments))
        res.render('e/dtr/delete.html', {
            flash: flash.get(req, 'employee'),
            attendanceTypes: CONFIG.attendance.types,
            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => o !== 'normal'),
            employee: employee,
            employment: employment,
            attendance: attendance,
            workSchedules: workSchedules,
            workSchedule: workSchedule,
            timeSegments: timeSegments,
            logSegments: logSegments,
            logSegmentsDtr: dtrHelper.logSegmentsDtrFormat(logSegments),
            timeWorked: timeWorked,
            readableSchedule: readableSchedule,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/e/dtr/attendance/:attendanceId/delete', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeAttendance, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = await req.app.locals.db.main.Employment.findById(lodash.get(res.attendance, 'employmentId'))
        await res.attendance.remove()

        flash.ok(req, 'employee', `Attendance deleted.`)
        res.redirect(`/e/dtr/${employment._id}`)
    } catch (err) {
        next(err);
    }
});
module.exports = router;