//// Core modules

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const momentRange = require('moment-range')
const momentExt = momentRange.extendMoment(moment)
const qr = require('qr-image')

//// Modules
const dtrHelper = require('../dtr-helper');
const excelGen = require('../excel-gen');
const middlewares = require('../middlewares');
const nunjucksEnv = require('../nunjucks-env');
const paginator = require('../paginator');
const suffixes = require('../suffixes');
const s3 = require('../aws-s3');
const { AppError } = require('../errors');
const uploader = require('../uploader');
const workScheduler = require('../work-scheduler');

// Router
let router = express.Router()

router.get('/shared/dtr/print/:secureKey', middlewares.decodeSharedResource, async (req, res, next) => {
    try {
        let payload = res.payload
        let employeeId = payload.employeeId
        let employmentId = payload.employmentId

        // employee
        let employee = await req.app.locals.db.main.Employee.findOne({
            _id: employeeId
        })
        if (!employee) {
            throw new Error('Employee not found.')
        }
        employee.employments = await req.app.locals.db.main.Employment.find({
            employeeId: employee._id
        }).lean()

        //employment
        let employment = employee.employments.find((e) => {
            return e._id.toString() === employmentId
        })
        if (!employment) {
            throw new Error('Employment not found.')
        }

        ////////

        let momentNow = moment()

        let periodMonthYear = lodash.get(req, 'query.periodMonthYear', moment().startOf('month').format('YYYY-MM-DD'))
        let periodSlice = lodash.get(req, 'query.periodSlice')
        let periodWeekDays = lodash.get(req, 'query.periodWeekDays', 'Mon-Fri')
        let showTotalAs = lodash.get(req, 'query.showTotalAs', 'time')
        let countTimeBy = lodash.get(req, 'query.countTimeBy', 'weekdays')

        // Validation and defaults
        let periodMonthYearMoment = moment(periodMonthYear)
        if (!periodMonthYearMoment.isValid()) {
            throw new Error(`Invalid period date.`)
        }
        if (!['15th', '30th', 'all'].includes(periodSlice)) {
            if (momentNow.date() <= 15) {
                periodSlice = '15th'
            } else {
                periodSlice = '30th'
            }
            if (employment.employmentType === 'permanent') {
                periodSlice = 'all'
            }
        }
        if (!['Mon-Fri', 'Sat-Sun', 'All'].includes(periodWeekDays)) {
            periodWeekDays = 'Mon-Fri'
        }
        if (!['time', 'undertime'].includes(showTotalAs)) {
            showTotalAs = 'time'
        }
        if (!['weekdays', 'weekends', 'all', 'none'].includes(countTimeBy)) {
            countTimeBy = 'weekdays'
        }

        let startMoment = periodMonthYearMoment.clone().startOf('month')
        let endMoment = periodMonthYearMoment.clone().endOf('month')

        if (periodSlice === '15th') {
            startMoment = startMoment.startOf('day')
            endMoment = endMoment.date(15).endOf('day')
        } else if (periodSlice === '30th') {
            startMoment = startMoment.date(16).startOf('day')
            endMoment = endMoment.endOf('month').endOf('day')
        }

        let showWeekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        if (periodWeekDays === 'Sat-Sun') {
            showWeekDays = ['Sat', 'Sun']
        }
        if (periodWeekDays === 'All') {
            showWeekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        }


        let options = {
            padded: true,
            showTotalAs: showTotalAs,
            showWeekDays: showWeekDays,
        }

        let { days, stats } = await dtrHelper.getDtrByDateRange(req.app.locals.db, employee._id, employment._id, startMoment, endMoment, options)

        const range1 = momentExt.range(periodMonthYearMoment.clone().subtract(6, 'months'), periodMonthYearMoment.clone().add(6, 'months'))
        let months = Array.from(range1.by('months')).reverse()

        let periodMonthYearList = months.map((_moment) => {
            let date = _moment.startOf('month')

            return {
                value: date.format('YYYY-MM-DD'),
                text: date.format('MMM YYYY'),
            }
        })

        // Work Sched
        let lists = await req.app.locals.db.main.EmployeeList.find({
            'members': {
                $elemMatch: {
                    employmentId: employmentId
                }
            }
        }).lean()
        let listIds = lists.map(o => o._id)
        let workSchedules = await req.app.locals.db.main.WorkSchedule.find({
            $or: [
                {
                    visibility: ''
                },
                {
                    visibility: {
                        $exists: false
                    }
                },
                {
                    'members': {
                        $elemMatch: {
                            objectId: employmentId,
                            type: 'employment'
                        }
                    }
                },
                {
                    'members': {
                        $elemMatch: {
                            objectId: {
                                $in: listIds
                            },
                            type: 'list'
                        }
                    }
                }
            ]
        }).lean()

        workSchedules = workSchedules.map((o) => {
            let times = []
            o.timeSegments = o.timeSegments.map((t) => {
                t.start = moment().startOf('day').minutes(t.start).format('hh:mm A')
                t.end = moment().startOf('day').minutes(t.end).format('hh:mm A')
                times.push(`${t.start} to ${t.end}`)
                return t
            })
            o.times = times.join(", \n")
            return o
        })

        let workSchedule = workSchedules.find(o => {
            return lodash.invoke(o, '_id.toString') === lodash.invoke(employment, 'workScheduleId.toString')
        })

        let data = {
            title: `DTR - ${employee.firstName} ${employee.lastName} ${employee.suffix}`,

            flash: flash.get(req, 'attendance'),

            employee: employee,
            employment: employment,

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

            startDate: startMoment.format('YYYY-MM-DD'),
            endDate: endMoment.format('YYYY-MM-DD'),

            workSchedule: workSchedule,
            shared: true,

            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => o !== 'normal'),

        }

        return res.render('e-profile/dtr-print.html', data)
    } catch (err) {
        next(err);
    }
});

router.get('/shared/authority-to-travel/print/:secureKey', middlewares.decodeSharedResource, async (req, res, next) => {
    try {

        let payload = res.payload
        let employeeId = payload.employeeId
        let employmentId = payload.employmentId

        // Employee
        let employee = await req.app.locals.db.main.Employee.findById(employeeId).lean()
        if (!employee) {
            throw new Error('Employee not found.')
        }

        // Employment
        let employment = await req.app.locals.db.main.Employment.findById(employmentId).lean()
        if (!employment) {
            throw new Error('Employment not found.')
        }

        let at = await req.app.locals.db.main.AuthorityToTravel.findById(payload.atId)
        if (!at) {
            throw new Error('Authority To Travel not found.')
        }

        let words = at.data.natureOfBusiness.replace(/\s\s+/g, ' ').split(' ')
        if (words.length > 18) {
            at.data.natureOfBusiness1 = words.splice(0, 18).join(' ')
            at.data.natureOfBusiness2 = words.splice(0, 18).join(' ')

        } else {
            at.data.natureOfBusiness1 = words.join(' ')
            at.data.natureOfBusiness2 = ''

        }

        let data = {
            title: `Authority to Travel - ${employee.firstName} ${employee.lastName} - ${at.controlNumber}`,
            employee: employee,
            at: at,
            shared: true,
            momentNow: moment(),
        }
        res.render('hros/authority-to-travel/authority-to-travel.html', data);

    } catch (err) {
        next(err);
    }
});

router.get('/shared/certificate-of-appearance/print/:secureKey', middlewares.decodeSharedResource, async (req, res, next) => {
    try {

        let payload = res.payload
        let employeeId = payload.employeeId

        // Employee
        let employee = await req.app.locals.db.main.Employee.findById(employeeId).lean()
        if (!employee) {
            throw new Error('Employee not found.')
        }


        let data = {
            title: `Certificate of Appearance - ${employee.firstName} ${employee.lastName}`,
            employee: employee,
            shared: true,
            momentNow: moment(),
        }
        res.render('hros/certificate-of-appearance/certificate-of-appearance.html', data);

    } catch (err) {
        next(err);
    }
});

module.exports = router;