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
const s3 = require('../aws-s3');
const { AppError } = require('../errors');
const uploader = require('../uploader');
const workScheduler = require('../work-scheduler');

// Router
let router = express.Router()

router.use('/e/dtr', middlewares.requireAuthUser)

router.get('/e/dtr/:employmentId/daily', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, middlewares.getDtrQueries, async (req, res, next) => {
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
            showDays = 2
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
        }

        // return res.send(req.path)
        if (req.xhr) {
            return res.json(data)
        }


        // console.log(stats)
        // return res.send(days)

      
        res.render('e/dtr/dtr8.html', data)
    } catch (err) {
        next(err);
    }
});
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
            showDays = 2
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
        }

        // return res.send(req.path)
        if (req.xhr) {
            return res.json(data)
        }


        // console.log(stats)
        // return res.send(days)

        if (/^\/e-profile\/dtr\/print/.test(req.path)) {
            return res.render('e/dtr/print8.html', data)
        }
        res.render('e/dtr/dtr8.html', data)
    } catch (err) {
        next(err);
    }
});

module.exports = router;