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
const S3_CLIENT = require('../aws-s3-client')  // V3 SDK
const { AppError } = require('../errors');
const uploader = require('../uploader');
const workScheduler = require('../work-scheduler');

const CORRECTION_PER_MONTH = CONFIG?.attendance?.correctionPerMonth ?? 3

// Router
let router = express.Router()

router.use('/e-profile', middlewares.requireAuthUser)

router.get('/e-profile/home', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let carouselItems = []
        employee.employments.forEach((e) => {
            let qrData = {
                type: 2,
                employeeId: employee._id,
                employmentId: e._id
            }
            qrData = Buffer.from(JSON.stringify(qrData)).toString('base64')
            // console.log(qrData)

            qrData = qr.imageSync(qrData, { size: 5, type: 'png' }).toString('base64')
            carouselItems.push({
                type: 'qr',
                data: qrData,
                employment: e,
                title: `${e.position}` || 'Employment',
            })
        })



        res.render('e-profile/home.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
            carouselItems: carouselItems,
        });

    } catch (err) {
        next(err);
    }
});


router.post('/e-profile/accept', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        employee.acceptedDataPrivacy = true
        await employee.save()

        res.send('ok')
    } catch (err) {
        next(err);
    }
});

router.get(['/e-profile/dtr/:employmentId', '/e-profile/dtr/print/:employmentId'], middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, middlewares.getDtrQueries, async (req, res, next) => {
    try {

        if (/^\/e-profile\/dtr\/print/.test(req.path)) {
            return res.redirect(`/e/dtr/print/${req.params.employmentId}`)
        }
        return res.redirect(`/e/dtr/${req.params.employmentId}`)

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
            return res.render('e-profile/dtr-print7.html', data)
        }
        res.render('e-profile/dtr7.html', data)
    } catch (err) {
        next(err);
    }
});

// Apply for correction
router.get('/e-profile/attendance/:attendanceId/apply', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        // Get employee
        if (!res.employee) {
            throw new Error('Employee needed.')
        }
        let employee = res.employee.toObject()

        // Get attendance
        let attendanceId = lodash.get(req, 'params.attendanceId')
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            _id: attendanceId,
            employeeId: employee._id,
        }).lean()
        if (!attendance) {
            throw new Error('Attendance not found.')
        }

        if (moment(attendance.createdAt).startOf('day').isBefore(moment().startOf('day').subtract(3, 'days'))) {
            // throw new Error('Cannot apply for correction after 3 days. ')
        }

        // Employment
        let employment = await req.app.locals.db.main.Employment.findOne({
            _id: attendance.employmentId,
            employeeId: employee._id,
        }).lean()
        if (!employment) {
            throw new Error('Employment not found.')
        }


        // Get pending
        let attendanceReview = await req.app.locals.db.main.AttendanceReview.findOne({
            attendanceId: attendanceId,
            status: 'pending'
        }).lean()

        if (attendanceReview) {
            throw new Error('Attendance correction application for this date is still under review.')
        }

        // Get pending
        let attendanceReviews = await req.app.locals.db.main.AttendanceReview.find({
            employmentId: attendance.employmentId,
            employeeId: employee._id,
            'logs.0.dateTime': {
                $gte: moment(attendance.createdAt).startOf('month').toDate(),
                $lt: moment(attendance.createdAt).endOf('month').toDate(),
            }
        }).lean()
        if (attendanceReviews.length >= CORRECTION_PER_MONTH) {
            throw new Error(`Attendance correction application exceeded the ${CORRECTION_PER_MONTH} limit per month. You currently have ${attendanceReviews.length}.`)
        }

        // Get rejected
        let attendanceDenied = await req.app.locals.db.main.AttendanceReview.findOne({
            attendanceId: attendanceId,
            status: 'rejected'
        }).sort({ _id: -1 }).lean()



        // Get related logsheet images
        let momentDate = moment(attendance.createdAt)
        if (momentDate.clone().startOf('day').isSame(moment().startOf('day'))) {
            throw new Error('Please apply for correction tomorrow. Your attendance today is still ongoing. ')
        }
        let aggr = [
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
                    attendance: {
                        logs: 0,
                        changes: 0
                    },
                }
            },
            {
                $match: {
                    'attendance.createdAt': {
                        $gte: momentDate.clone().startOf('day').toDate(),
                        $lt: momentDate.clone().endOf('day').toDate(),
                    },
                    status: 'approved',
                    attachments: {
                        $exists: true,
                        $ne: []
                    },
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
                $match: {
                    "employments": {
                        $elemMatch: {
                            "employmentType": employment.employmentType, // COS or whatevs
                        }
                    }
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
            },
            {
                $limit: 10
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
        ]
        let logSheets = await req.app.locals.db.main.AttendanceReview.aggregate(aggr)
        // return res.send(logSheets)

        // let now = moment()
        // let created = moment(attendance.createdAt).add(8, 'hours')
        // if(now.isSameOrBefore(created)){
        //     throw new Error('Cannot correct today\'s attendance. Please wait for tomorrow to apply for correction.')
        // }
        let workSchedule = await req.app.locals.db.main.WorkSchedule.findById(
            lodash.get(attendance, 'workScheduleId')
        )

        attendance.shifts = lodash.get(workSchedule, 'timeSegments')

        let workSchedules = await req.app.locals.db.main.WorkSchedule.find({
            $or: [
                {
                    members: {
                        $elemMatch: {
                            objectId: employment._id,
                            type: "employment"
                        }
                    }
                },
                {
                    members: {
                        $eq: []
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


        let attendanceType = lodash.get(attendance, 'type')

        // For use by vuejs in frontend
        let ui = {
            editable: false,
            attendanceType: attendanceType,
            log0: '',
            log1: '',
            log2: '',
            log3: '',
        }

        if (attendanceType === 'normal') {
            let maxLogNumber = 4
            for (let l = 0; l < maxLogNumber; l++) {
                let log = lodash.get(attendance, `logs[${l}]`)
                if (log) {
                    lodash.set(ui, `log${l}`, moment(log.dateTime).format('HH:mm'))
                } else {
                    lodash.set(ui, `log${l}`, '')
                    ui.editable = true
                }
            }
        }

        attendance.ui = ui


        // return res.send(attendance)
        res.render('e-profile/attendance/apply.html', {
            flash: flash.get(req, 'employee'),
            attendance: attendance,
            employee: employee,
            employment: employment,
            workSchedules: workSchedules,
            attendanceTypes: CONFIG.attendance.types,
            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => !['normal', 'wfh', 'pass'].includes(o)),
            correctionReasons: CONFIG.attendance.correctionReasons,
            attendanceDenied: attendanceDenied,
            logSheets: logSheets,
            attendanceReviews: attendanceReviews,
            CORRECTION_PER_MONTH: CORRECTION_PER_MONTH,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/attendance/:attendanceId/apply', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.dataUrlToReqFiles(['photo']), middlewares.handleUpload({ allowedMimes: ["image/jpeg", "image/png"] }), async (req, res, next) => {
    try {
        // Get employee
        if (!res.employee) {
            throw new Error('Employee needed.')
        }
        let employee = res.employee

        // Get attendance
        let attendanceId = lodash.get(req, 'params.attendanceId')
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            _id: attendanceId,
            employeeId: employee._id,
        }).lean()
        if (!attendance) {
            throw new Error('Attendance not found.')
        }

        // Employment
        let employment = await req.app.locals.db.main.Employment.findOne({
            _id: attendance.employmentId,
            employeeId: employee._id,
        }).lean()
        if (!employment) {
            throw new Error('Employment not found.')
        }
        let employmentId = employment._id

        // Get pending
        let attendanceReviews = await req.app.locals.db.main.AttendanceReview.find({
            employmentId: attendance.employmentId,
            employeeId: employee._id,
            'logs.0.dateTime': {
                $gte: moment(attendance.createdAt).startOf('month').toDate(),
                $lt: moment(attendance.createdAt).endOf('month').toDate(),
            }
        }).lean()
        if (attendanceReviews.length >= CORRECTION_PER_MONTH) {
            throw new Error(`Attendance correction application exceeded the ${CORRECTION_PER_MONTH} limit per month. You currently have ${attendanceReviews.length}.`)
        }

        // Get pending
        let attendanceReview = await req.app.locals.db.main.AttendanceReview.findOne({
            attendanceId: attendanceId,
            status: 'pending'
        }).lean()

        if (attendanceReview) {
            throw new Error('Attendance correction application for this date is still under review.')
        }

        let saveList = lodash.get(req, 'saveList')
        let attachments = lodash.get(saveList, 'photo') // Use base64 uploaded image
        let body = lodash.get(req, 'body')
        let photo2 = lodash.get(body, 'photo2') // Use existing already uploaded

        if (photo2) {
            photo2 = path.basename(photo2)

            let pos = photo2.indexOf('-') // Get position of -. If absent, returns -1
            if (pos > -1) {
                pos += 1 // Add 1 to start after -
            }
            photo2 = photo2.substring(pos) // Cut part after -. If no -, return whole string

            attachments = []
            attachments.push(photo2)
        }


        // ORIG
        let orig = JSON.parse(JSON.stringify(attendance))
        delete orig._id
        delete orig.createdAt

        // PATCH
        let patch = JSON.parse(JSON.stringify(attendance))
        delete patch._id
        delete patch.createdAt

        patch.attendanceId = attendance._id.toString()
        patch.attachments = attachments
        patch.type = body.type
        patch.correctionReason = body.correctionReason + ' ' + lodash.get(body, 'otherReason', '')
        patch.logsheetNumber = body.logsheetNumber
        patch.workScheduleId = body.workScheduleId
        patch.status = 'pending'

        let getMode = (x) => {
            let mode = 1
            if (x === 0) {
                mode = 1
            } else if (x === 1) {
                mode = 0
            } else if (x === 2) {
                mode = 1
            } else if (x === 3) {
                mode = 0
            }
            return mode
        }

        if (moment(attendance.createdAt).clone().startOf('day').isSame(moment().startOf('day'))) {
            throw new Error('Please apply for correction tomorrow. Your attendance today is still ongoing. ')
        }

        // Merge 4 logs
        for (let x = 0; x < 4; x++) {
            let origLog = lodash.get(orig, `logs[${x}]`)
            let patchLog = lodash.get(body, `log${x}`)
            let newLog = origLog
            let momentLog = moment(patchLog, 'HH:mm', true) // Turn to moment or null if fails
            if (momentLog.isValid()) {

                let dateTime = moment(attendance.createdAt).hours(momentLog.hours()).minutes(momentLog.minutes()).toDate()
                let mode = getMode(x)
                if (origLog) {
                    newLog.dateTime = dateTime
                    newLog.mode = mode
                } else { // undefined
                    newLog = {
                        _id: req.app.locals.db.mongoose.Types.ObjectId(),
                        scannerId: null,
                        dateTime: dateTime,
                        mode: mode,
                        type: 'online',

                    }
                }

            }

            patch.logs[x] = newLog
        }
        // Remove undefined
        patch.logs = patch.logs.filter(o => o !== undefined)
        patch = JSON.parse(JSON.stringify(patch))

        // return res.send(patch)
        let merged = lodash.merge(orig, patch)
        let review = await req.app.locals.db.main.AttendanceReview.create(merged)

        // return res.send({
        //     orig: JSON.parse(JSON.stringify(attendance)),
        //     patch: patch,
        //     merged: merged,
        //     review: review,
        // })

        flash.ok(req, 'employee', 'Application submitted.')
        res.redirect(`/e-profile/dtr/${employmentId}`)
    } catch (err) {
        next(err);
    }
});

// Direct apply for correction on selected dates
router.get('/e-profile/dtr/:employmentId/attendance/:date', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        // Date
        let date = lodash.get(req, 'params.date')
        if (!date) {
            throw new Error('Missing date.')
        }
        let mDate = moment(date)

        const isForCorrection = ['2023-02-02', '2023-02-03', '2023-04-21', '2023-04-22', '2023-06-01', '2023-06-02', '2023-12-26', '2024-04-22', '2024-04-25', '2024-04-26'].includes(mDate.clone().startOf('day').format('YYYY-MM-DD')) ? true : false
        if (!isForCorrection) {
            throw new Error('Not allowed.')
        }

        // Get employee
        if (!res.employee) {
            throw new Error('Employee needed.')
        }
        let employee = res.employee.toObject()

        // Employment
        let employmentId = lodash.get(req, 'params.employmentId')
        let employment = await req.app.locals.db.main.Employment.findOne({
            _id: employmentId,
            employeeId: employee._id,
        }).lean()
        if (!employment) {
            throw new Error('Employment not found.')
        }

        // Get attendance
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            employmentId: employmentId,
            createdAt: {
                $gte: mDate.clone().startOf('day').toDate(),
                $lte: mDate.clone().endOf('day').toDate(),
            }
        }).lean()
        if (!attendance) {

            attendance = await req.app.locals.db.main.Attendance.create({
                type: 'normal',
                employmentId: employmentId,
                employeeId: employee._id,
                workScheduleId: employment.workScheduleId,
                createdAt: mDate.clone().startOf('day').toDate()
            })
            attendance = JSON.parse(JSON.stringify(attendance))
        }
        const attendanceId = attendance._id

        // Get pending
        let attendanceReview = await req.app.locals.db.main.AttendanceReview.findOne({
            attendanceId: attendanceId,
            status: 'pending'
        }).lean()

        if (attendanceReview) {
            throw new Error('Attendance correction application for this date is still under review.')
        }

        // Get rejected
        let attendanceDenied = await req.app.locals.db.main.AttendanceReview.findOne({
            attendanceId: attendanceId,
            status: 'rejected'
        }).sort({ _id: -1 }).lean()


        // Get related logsheet images
        let momentDate = moment(attendance.createdAt)
        if (momentDate.clone().startOf('day').isSame(moment().startOf('day'))) {
            throw new Error('Please apply for correction tomorrow. Your attendance today is still ongoing. ')
        }
        let aggr = [
            {
                $match: {
                    createdAt: {
                        $gte: momentDate.clone().startOf('day').toDate(),
                        $lt: momentDate.clone().endOf('day').toDate(),
                    },
                    status: 'approved',
                    attachments: {
                        $exists: true,
                        $ne: []
                    },
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
                $match: {
                    "employments": {
                        $elemMatch: {
                            "employmentType": employment.employmentType, // COS or whatevs
                        }
                    }
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
            },
            {
                $limit: 10
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
        ]
        let logSheets = await req.app.locals.db.main.AttendanceReview.aggregate(aggr)

        let workSchedule = await req.app.locals.db.main.WorkSchedule.findById(
            lodash.get(attendance, 'workScheduleId')
        )

        attendance.shifts = lodash.get(workSchedule, 'timeSegments')

        let workSchedules = await req.app.locals.db.main.WorkSchedule.find().lean()
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
        let workScheduleTimeSegments = dtrHelper.getWorkScheduleTimeSegments(workSchedule, attendance.createdAt)
        attendance = dtrHelper.normalizeAttendance(attendance, employee, workScheduleTimeSegments)

        let attendanceType = lodash.get(attendance, 'type')

        // For use by vuejs in frontend
        let ui = {
            editable: false,
            attendanceType: attendanceType,
            log0: '',
            log1: '',
            log2: '',
            log3: '',
        }

        if (attendanceType === 'normal') {
            let maxLogNumber = 4
            for (let l = 0; l < maxLogNumber; l++) {
                let log = lodash.get(attendance, `logs[${l}]`)
                if (log) {
                    lodash.set(ui, `log${l}`, moment(log.dateTime).format('HH:mm'))
                } else {
                    lodash.set(ui, `log${l}`, '')
                    ui.editable = true
                }
            }
        }

        attendance.ui = ui


        // return res.send(attendance)
        res.render('e-profile/attendance/apply2.html', {
            flash: flash.get(req, 'employee'),
            attendance: attendance,
            employee: employee,
            employment: employment,
            workSchedules: workSchedules,
            attendanceTypes: CONFIG.attendance.types,
            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => !['normal', 'wfh', 'pass'].includes(o)),
            correctionReasons: CONFIG.attendance.correctionReasons,
            attendanceDenied: attendanceDenied,
            logSheets: logSheets,
            date: mDate.format('YYYY-MM-DD'),
        });
    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/dtr/:employmentId/attendance/:date', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.dataUrlToReqFiles(['photo']), middlewares.handleUpload({ allowedMimes: ["image/jpeg", "image/png"] }), async (req, res, next) => {
    try {
        // Date
        let date = lodash.get(req, 'params.date')
        if (!date) {
            throw new Error('Missing date.')
        }
        let mDate = moment(date)
        const isForCorrection = ['2023-02-02', '2023-02-03', '2023-04-21', '2023-04-22', '2023-12-26', '2024-04-22', '2024-04-25', '2024-04-26'].includes(mDate.clone().startOf('day').format('YYYY-MM-DD')) ? true : false
        if (!isForCorrection) {
            throw new Error('Not allowed.')
        }

        // Get employee
        if (!res.employee) {
            throw new Error('Employee needed.')
        }
        let employee = res.employee

        // Employment
        let employmentId = lodash.get(req, 'params.employmentId')
        let employment = await req.app.locals.db.main.Employment.findOne({
            _id: employmentId,
            employeeId: employee._id,
        }).lean()
        if (!employment) {
            throw new Error('Employment not found.')
        }

        // Get attendance
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            employmentId: employment._id,
            employeeId: employee._id,
            createdAt: {
                $gte: mDate.clone().startOf('day').toDate(),
                $lte: mDate.clone().endOf('day').toDate(),
            }
        }).lean()
        if (!attendance) {
            throw new Error('No attendance')
        }
        let attendanceId = attendance._id

        // Get pending
        let attendanceReview = await req.app.locals.db.main.AttendanceReview.findOne({
            attendanceId: attendanceId,
            status: 'pending'
        }).lean()

        if (attendanceReview) {
            throw new Error('Attendance correction application for this date is still under review.')
        }

        let saveList = lodash.get(req, 'saveList')
        let attachments = lodash.get(saveList, 'photo') // Use base64 uploaded image
        let body = lodash.get(req, 'body')
        let photo2 = lodash.get(body, 'photo2') // Use existing already uploaded

        if (photo2) {
            photo2 = path.basename(photo2)

            let pos = photo2.indexOf('-') // Get position of -. If absent, returns -1
            if (pos > -1) {
                pos += 1 // Add 1 to start after -
            }
            photo2 = photo2.substring(pos) // Cut part after -. If no -, return whole string

            attachments = []
            attachments.push(photo2)
        }


        // ORIG
        let orig = JSON.parse(JSON.stringify(attendance))
        delete orig._id
        delete orig.createdAt

        // PATCH
        let patch = JSON.parse(JSON.stringify(attendance))
        delete patch._id
        delete patch.createdAt

        patch.attendanceId = attendance._id.toString()
        patch.attachments = attachments
        patch.type = body.type
        patch.correctionReason = body.correctionReason
        patch.correctionReason = body.correctionReason + ' ' + lodash.get(body, 'otherReason', '')
        patch.logsheetNumber = body.logsheetNumber
        patch.workScheduleId = body.workScheduleId
        patch.status = 'pending'

        let getMode = (x) => {
            let mode = 1
            if (x === 0) {
                mode = 1
            } else if (x === 1) {
                mode = 0
            } else if (x === 2) {
                mode = 1
            } else if (x === 3) {
                mode = 0
            }
            return mode
        }

        if (moment(attendance.createdAt).clone().startOf('day').isSame(moment().startOf('day'))) {
            throw new Error('Please apply for correction tomorrow. Your attendance today is still ongoing. ')
        }

        // Merge 4 logs
        for (let x = 0; x < 4; x++) {
            let origLog = lodash.get(orig, `logs[${x}]`)
            let patchLog = lodash.get(body, `log${x}`)
            let newLog = origLog
            let momentLog = moment(patchLog, 'HH:mm', true) // Turn to moment or null if fails
            if (momentLog.isValid()) {

                let dateTime = moment(attendance.createdAt).hours(momentLog.hours()).minutes(momentLog.minutes()).toDate()
                let mode = getMode(x)
                if (origLog) {
                    newLog.dateTime = dateTime
                    newLog.mode = mode
                } else { // undefined
                    newLog = {
                        _id: req.app.locals.db.mongoose.Types.ObjectId(),
                        scannerId: null,
                        dateTime: dateTime,
                        mode: mode,
                        type: 'online',

                    }
                }

            }

            patch.logs[x] = newLog
        }
        // Remove undefined
        patch.logs = patch.logs.filter(o => o !== undefined)
        patch = JSON.parse(JSON.stringify(patch))

        // return res.send(patch)
        let merged = lodash.merge(orig, patch)
        let review = await req.app.locals.db.main.AttendanceReview.create(merged)

        // return res.send({
        //     orig: JSON.parse(JSON.stringify(attendance)),
        //     patch: patch,
        //     merged: merged,
        //     review: review,
        // })

        flash.ok(req, 'employee', 'Application submitted.')
        res.redirect(`/e-profile/dtr/${employmentId}`)
    } catch (err) {
        next(err);
    }
});

// Set attendance to wfh or travel or leave
router.get('/e-profile/dtr/:employmentId/attendance-set', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {

        let attendanceNewType = lodash.get(req, 'query.type')
        if (!attendanceNewType) {
            throw new Error('Missing type.')
        }

        const allowed = ['leave', 'travel', 'wfh']
        if (!allowed.includes(attendanceNewType)) {
            throw new Error(`Invalid type. Must be ${allowed.join(", ")}`)
        }

        let attendanceDate = lodash.get(req, 'query.date')
        if (!attendanceDate) {
            throw new Error('Missing date.')
        }

        const isPastOrNow = moment(attendanceDate).isBefore(moment().endOf('day'))
        if (!isPastOrNow) {
            throw new Error('Not allowed.')
        }
        let user = res.user.toObject()

        // Employee
        if (!res.employee) {
            throw new Error('Employee needed.')
        }
        let employee = res.employee.toObject()

        // Employment
        let employment = res.employment
        if (!employment.active) {
            throw new Error('Cannot modify DTR as employment is no longer active.')
        }

        if (attendanceNewType === 'leave' && employment.employmentType !== 'permanent') {
            throw new Error('Invalid type and employment.')
        }



        let source = {
            id: user._id,
            type: 'userAccount',
        }
        let message = ''
        if (attendanceNewType === 'wfh') {
            message = `Attendance set to WFH. Please secure your accomplishment report and other supporting documents.`

        } else if (attendanceNewType === 'leave') {
            message = `Attendance set to Leave. Please secure your supporting documents.`

        } else if (attendanceNewType === 'travel') {
            message = `Attendance set to Travel. Please secure your appearance and other supporting documents.`

        }
        await dtrHelper.logTravelAndWfh(req.app.locals.db, attendanceDate, employee, employment, source, attendanceNewType)
        flash.ok(req, 'employee', `${message}`)
        return res.redirect(`/e-profile/dtr/${employment._id}`)
    } catch (err) {
        next(err);
    }
});

router.patch('/e-profile/dtr/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let employmentId = employment._id
        let momentNow = moment()

        let periodMonthYear = lodash.get(req, 'query.periodMonthYear', moment().startOf('month').format('YYYY-MM-DD'))
        let periodMonthYearMoment = moment(periodMonthYear)
        let periodSlice = lodash.get(req, 'query.periodSlice')
        let periodWeekDays = lodash.get(req, 'query.periodWeekDays', 'Mon-Fri')
        let showTotalAs = lodash.get(req, 'query.showTotalAs', 'time')

        // Validation
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
        if (!['Mon-Fri', 'Sat-Sun'].includes(periodWeekDays)) {
            periodWeekDays = 'Mon-Fri'
        }
        if (!['time', 'undertime'].includes(showTotalAs)) {
            showTotalAs = 'time'
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

        let workScheduleId = lodash.get(req, 'body.workScheduleId')
        let inCharge = lodash.get(req, 'body.inCharge')

        let patch = {}

        if (workScheduleId) {
            patch.workScheduleId = workScheduleId

            // Today attendance
            let attendances = await req.app.locals.db.main.Attendance.find({
                employeeId: employee._id,
                employmentId: employmentId,
                createdAt: {
                    $gte: startMoment.clone().startOf('day').toDate(),
                    $lte: endMoment.clone().endOf('day').toDate(),
                }
            }).lean()

            attendances = attendances.filter((attendance) => {
                return showWeekDays.includes(moment(attendance.createdAt).format('ddd'))
            })

            let attendanceIds = attendances.map((attendance) => {
                return attendance._id.toString()
            })

            let rA = await req.app.locals.db.main.Attendance.updateMany({
                _id: {
                    $in: attendanceIds
                }
            }, {
                workScheduleId: workScheduleId
            })

            // console.log('updatedAttendances', rA, attendanceIds)
        }
        if (inCharge) {
            patch.inCharge = inCharge
        }

        let rE = await req.app.locals.db.main.Employment.updateOne({
            _id: employment._id
        }, patch)

        // console.log('updated employment', rE)

        res.send('ok')
    } catch (err) {
        next(new AppError(err.message));
    }
});
router.post('/e-profile/dtr/:employmentId/logs', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment

        // return res.send(req.body)
        let body = req.body

        let mode = body.mode
        let lat = body.lat
        let lon = body.lon
        let webcamPhoto = body.webcamPhoto



        // Today attendance
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        }).lean()
        if (attendance) {
            let lastLog = attendance.logs[attendance.logs.length - 1]
            if (lastLog.mode === mode) {
                let message = `You are already logged-in. Please refresh your HRIS account and try again.`
                if (mode == 0) {
                    message = `You are already logged out. Please refresh your HRIS account and try again.`
                }
                throw new Error(message)
            }
        }

        // Photo
        let saveList = null
        if (webcamPhoto) {
            let file = uploader.toReqFile(webcamPhoto)
            let files = {
                photos: [file]
            }
            let localFiles = await uploader.handleExpressUploadLocalAsync(files, CONFIG.app.dirs.upload)
            let imageVariants = await uploader.resizeImagesAsync(localFiles, null, CONFIG.app.dirs.upload); // Resize uploaded images

            let uploadList = uploader.generateUploadList(imageVariants, localFiles)
            saveList = uploader.generateSaveList(imageVariants, localFiles)
            await uploader.uploadToS3Async(uploadList)
            await uploader.deleteUploadsAsync(localFiles, imageVariants)
            req.localFiles = localFiles
            req.imageVariants = imageVariants
            req.saveList = saveList

            // console.log(uploadList, saveList)
        }

        // Log
        let source = {
            id: res.user._id,
            type: 'userAccount', // Online user account
            lat: lat,
            lon: lon,
            photo: lodash.get(saveList, 'photos[0]', ''),
        }
        attendance = await dtrHelper.logNormal(req.app.locals.db, moment(), employee, employment, source, 15) // 15mins timeout

        // For monitoring page
        let payload = {
            attendances: [],
            employmentId: employment._id,
            employee: {
                firstName: employee.firstName,
                middleName: employee.middleName,
                lastName: employee.lastName,
                gender: employee.gender,
                birthDate: employee.birthDate,
                profilePhoto: employee.profilePhoto,
                speechSynthesisName: employee.speechSynthesisName,
            },
            log: lodash.get(attendance, `logs[${attendance.logs.length - 1}]`),
            logs: {
                log0: lodash.get(attendance, 'logs[0]'),
                log1: lodash.get(attendance, 'logs[1]'),
                log2: lodash.get(attendance, 'logs[2]'),
                log3: lodash.get(attendance, 'logs[3]')
            }
        }
        let room = moment().format('YYYY-MM-DD')
        req.app.locals.io.of("/monitoring").to(room).emit('added', payload)
        // End for monitoring page

        flash.ok(req, 'employee', 'Attendance saved.')
        res.send(attendance)
    } catch (err) {
        next(new AppError(err.message));
    }
});
router.get('/e-profile/dtr/:employmentId/log-point', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment

        // Today attendance
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        }).lean()

        // Checkpoints
        // 0 - no log
        // 1 - morning in
        // 2 - morning out
        // 3 - afternoon in
        // 4 - afternoon out
        // 5 - extended in
        // 6 - extended out
        let checkPoint = lodash.get(attendance, 'logs.length', 0)

        res.send({
            checkPoint: checkPoint
        })
    } catch (err) {
        next(new AppError(err.message));
    }
});

router.get('/e-profile/dtr/:employmentId/on1ine', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {

        let getRandomArbitrary = (min, max) => {
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        let timeOut = getRandomArbitrary(10, 60) * 1000
        // console.log(timeOut)
        await new Promise(resolve => setTimeout(resolve, timeOut)) // Rate limit 
        let employment = res.employment

        let t = getRandomArbitrary(0, 3)

        if (t === 0) {
            flash.error(req, 'employee', `Request timed-out. Please check your internet connection and try again.`)
            res.redirect(`/e-profile/home`)
        } else if (t === 1) {
            flash.error(req, 'employee', `Request timed-out. Please check your internet connection and try again.`)
            res.redirect(`/e-profile/dtr/${employment._id}`)
        } else if (t === 2) {
            flash.error(req, 'employee', `Request timed-out. Please check your internet connection and try again.`)
            res.redirect(`/e-profile/dtr/${employment._id}`)
        } else {
            res.redirect(`/logout`)
        }
    } catch (err) {
        next(new AppError(err.message));
    }
});

router.get('/e-profile/dtr/:employmentId/online', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let user = res.user.toObject()
        let employee = res.employee.toObject()
        let employment = res.employment
        if (!employment.active) {
            throw new Error('Cannot modify DTR as employment is no longer active.')
        }
        if (!lodash.get(user, 'settings.ol', true)) {
            return res.redirect(`/e-profile/dtr/${employment._id}/on1ine`)
        }

        // Add check point
        // Today attendance
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        }).lean()

        // Checkpoints
        // 0 - no log
        // 1 - morning in
        // 2 - morning out
        // 3 - afternoon in
        // 4 - afternoon out
        // 5 - extended in
        // 6 - extended out
        let checkPoint = lodash.get(attendance, 'logs.length', 0)

        if (checkPoint <= 0) {
            throw new Error('You need to log your Morning In first.')
        } else if (checkPoint > 2) {
            throw new Error('Service available for lunch breaks only.')
        }

        let maps = await res.app.locals.db.main.Map.find().lean()
        maps = maps.map(m => {
            return {
                name: m.name,
                // Mongo DB is reverse lat lon than OSM
                coordinates: m.geo.coordinates[0].map(o => {
                    return [
                        o[1],
                        o[0]
                    ]
                })
            }
        })

        maps = lodash.keyBy(maps, (m) => {
            return m.name.toLowerCase().replace(' campus', '')
        })

        res.render('e-profile/map-1.html', {
            employee: employee,
            employment: employment,
            maps: maps,
        })
    } catch (err) {
        next(new AppError(err.message));
    }
});

router.post('/e-profile/dtr/:employmentId/location', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let body = req.body


        let found = await req.app.locals.db.main.Map.findOne({
            geo: {
                $geoIntersects: {
                    $geometry: {
                        "type": "Point",
                        "coordinates": body.coordinates
                    }
                }
            }
        }).lean()

        // console.log('found', found)
        if (!found) {
            return res.status(404).send('')
        }
        res.send(found.name)
    } catch (err) {
        next(new AppError(err.message));
    }
});


router.get('/e-profile/dtr/share/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, middlewares.getDtrQueries, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentId = res.employmentId
        let employment = res.employment
        let month = lodash.get(req, 'query.month', moment().format('MMM'))
        let year = lodash.get(req, 'query.year', moment().format('YYYY'))

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


        let periodMonthYearMoment = moment(periodMonthYear)

        let prevShares = await req.app.locals.db.main.Share.deleteMany({
            createdBy: res.user._id,
        })

        // console.log(prevShares)
        // let forDeletion = await req.app.locals.db.main.Share.remove({
        //     createdBy: res.user._id,
        //     expiredAt: {
        //         $gte: moment().add(1, 'minute').toISOString(),
        //     }
        // }).lean()
        // console.log(forDeletion)
        // return res.send('forDeletion')

        //TODO: Do not allow different DTR view from one shared

        let secureKey = await passwordMan.randomStringAsync(12)
        let url = `${CONFIG.app.url}/shared/dtr/print/${secureKey}?periodMonthYear=${periodMonthYearMoment.format('YYYY-MM-DD')}&periodSlice=${periodSlice}&periodWeekDays=${periodWeekDays}&showTotalAs=${showTotalAs}&countTimeBy=${countTimeBy}`
        let hash = passwordMan.hashSha256(url)
        url = url + '&hash=' + hash
        let share = await req.app.locals.db.main.Share.create({
            secureKey: secureKey,
            expiredAt: moment().add(1, 'hour').toDate(),
            createdBy: res.user._id,
            payload: {
                url: url,
                employeeId: employee._id,
                employmentId: employmentId,
                month: month,
                year: year,
            }
        })
        // return res.send(share)

        res.render('e-profile/dtr-share.html', {
            prevShares: prevShares,
            share: share,
            employmentId: employmentId,
            employment: employment,
        });
    } catch (err) {
        next(err);
    }
});


router.get('/e-profile/wfh/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let momentNow = moment()

        res.render('e-profile/wfh.html', {
            momentNow: momentNow,
            employee: employee,
            employment: employment,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/wfh/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let momentNow = moment()

        // Today attendance
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        })
        if (attendance) {
            throw new Error('Already have attendance for today.')
        } else {
            attendance = new req.app.locals.db.main.Attendance({
                employeeId: employee._id,
                employmentId: employment._id,
                onTravel: false,
                wfh: true,
                logs: [
                ]
            })
        }
        await attendance.save()

        return res.redirect(`/e-profile/dtr/${employment._id}`)
        res.render('e-profile/wfh.html', {
            momentNow: momentNow,
            employee: employee,
            employment: employment,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/travel/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let momentNow = moment()

        // Today attendance
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        })
        if (attendance) {
            throw new Error('Already have attendance for today.')
        } else {
            attendance = new req.app.locals.db.main.Attendance({
                employeeId: employee._id,
                employmentId: employment._id,
                onTravel: true,
                wfh: false,
                type: 'travel',
                logs: [
                ]
            })
        }
        await attendance.save()

        return res.redirect(`/e-profile/dtr/${employment._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/payroll', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        throw new Error('Page under development.')
    } catch (err) {
        next(err);
    }
});

router.use('/e', middlewares.requireAuthUser)
router.get('/e/document/all', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let e201Types = await req.app.locals.db.main.Option.findOne({
            key: 'e201Types'
        })
        if (!e201Types) {
            throw new Error('Missing e201Types from options.')
        }
        e201Types = e201Types?.value // to array

        let docTypes = employee.documents.map(d => d.docType)
        docTypes = docTypes.filter(d => e201Types.includes(d))
        docTypes = [...new Set(docTypes)] // Remove dupes

        // employee.documents = employee.documents.filter(d => d.docType !== 'Payslip')
        let data = {
            flash: flash.get(req, 'employee'),
            e201Types: e201Types,
            docTypes: docTypes,
            employee: employee,
            momentNow: moment(),
            title: 'Documents'
        }
        res.render('e-profile/document/all.html', data);
    } catch (err) {
        next(err);
    }
});
// Folder view
router.get('/e/document/view-folder', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let docType = req.query?.docType
        let e201Types = await req.app.locals.db.main.Option.findOne({
            key: 'e201Types'
        })
        if (!e201Types) {
            throw new Error('Missing e201Types from options.')
        }
        e201Types = e201Types?.value

        if (e201Types.includes(docType)) {
            employee.documents = employee.documents.filter(d => d.docType === req.query?.docType)
        } else { // Others
            employee.documents = employee.documents.filter(d => !e201Types.includes(d.docType))
        }

        employee.documents.sort((a, b) => {
            try {
                let A = moment(b.date)
                let B = moment(a.date)
                if (A.isValid() && B.isValid()) {
                    if (A.isBefore(B)) {
                        return -1;
                    }
                    if (A.isAfter(B)) {
                        return 1;
                    }
                }
                // Must be equal
                return 0;
            } catch (err) {
                // Must be equal
                return 0;
            }
        });

        res.render('e/document/view-folder.html', {
            flash: flash.get(req, 'employee'),
            docType: docType,
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/e/document/payslips', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        employee.documents = employee.documents.filter(d => d.docType === 'Payslip')
        employee.documents.sort((a, b) => {
            try {
                let A = moment(b.date)
                let B = moment(a.date)
                if (A.isValid() && B.isValid()) {
                    if (A.isBefore(B)) {
                        return -1;
                    }
                    if (A.isAfter(B)) {
                        return 1;
                    }
                }
                // Must be equal
                return 0;
            } catch (err) {
                // Must be equal
                return 0;
            }
        });

        let data = {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
            title: 'Documents'
        }
        res.render('e/document/payslips.html', data);
    } catch (err) {
        next(err);
    }
});
router.get('/e/document/create', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let e201Types = await req.app.locals.db.main.Option.findOne({
            key: 'e201Types'
        })
        if (!e201Types) {
            throw new Error('Missing e201Types from options.')
        }
        let data = {
            flash: flash.get(req, 'employee'),
            employee: employee,
            docType: req.query?.docType,
            momentNow: moment(),
            title: 'Add 201 File',
            e201Types: e201Types?.value
        }
        res.render('e-profile/document/create.html', data);
    } catch (err) {
        next(err);
    }
});
router.post('/e/document/create', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, fileUpload(), middlewares.handleUpload({ allowedMimes: ["image/jpeg", "image/png", "application/pdf", 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'] }), async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let name = lodash.get(req, 'body.name')
        let docType = lodash.get(req, 'body.docType')
        let date = lodash.get(req, 'body.date')
        let patch = {
            documents: lodash.get(employee, 'documents', [])
        }
        patch.documents.push({
            name: name,
            key: lodash.get(req, 'saveList.document[0]'),
            mimeType: '',
            docType: docType,
            date: moment(date).toDate(),
        })
        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: patch
        })

        flash.ok(req, 'employee', `Uploaded document "${name}".`)
        if (docType === 'Payslip') {
            return res.redirect(`/e/document/payslips`)
        }
        res.redirect(`/e/document/all`);
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/pds', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        return res.redirect(`/e/pds/personal-info`)
        res.render('e-profile/pds.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
        });

    } catch (err) {
        next(err);
    }
});
router.get('/e-profile/pds.xlsx', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let workbook = await excelGen.templatePds(employee)
        let buffer = await workbook.xlsx.writeBuffer();
        res.set('Content-Disposition', `attachment; filename="${employee.lastName}-PDS.xlsx"`)
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.send(buffer)
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/pds1', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        return res.redirect(`/e/pds/personal-info`)


        res.render('e-profile/pds1.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/pds1', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = res.employee.toObject()
        let body = lodash.get(req, 'body')
        // return res.send(body)

        // lodash.set(patch, 'lastName', lodash.get(body, 'lastName'))
        // lodash.set(patch, 'firstName', lodash.get(body, 'firstName'))
        // lodash.set(patch, 'middleName', lodash.get(body, 'middleName'))
        // lodash.set(patch, 'suffix', lodash.get(body, 'suffix'))
        // lodash.set(patch, 'birthDate', lodash.get(body, 'birthDate'))
        // lodash.set(patch, 'gender', lodash.get(body, 'gender'))
        lodash.set(patch, 'civilStatus', lodash.get(body, 'civilStatus'))
        lodash.set(patch, 'mobileNumber', lodash.get(body, 'mobileNumber'))
        lodash.set(patch, 'phoneNumber', lodash.get(body, 'phoneNumber'))
        lodash.set(patch, 'email', lodash.get(body, 'email'))

        patch.history = employee.history
        if (patch.gender !== employee.gender) {
            patch.history.push({
                comment: `Changed gender from ${employee.gender} to ${patch.gender}.`,
                createdAt: moment().toDate()
            })
        }

        // TODO: Should generate new id every save??
        lodash.set(patch, 'addresses.0._id', req.app.locals.db.mongoose.Types.ObjectId())
        lodash.set(patch, 'addresses.0.unit', lodash.get(body, 'unit0'))
        lodash.set(patch, 'addresses.0.street', lodash.get(body, 'street0'))
        lodash.set(patch, 'addresses.0.village', lodash.get(body, 'village0'))
        lodash.set(patch, 'addresses.0.psgc', lodash.get(body, 'psgc0'))
        lodash.set(patch, 'addresses.0.zipCode', lodash.get(body, 'zipCode0'))
        lodash.set(patch, 'addressPermanent', lodash.get(patch, 'addresses.0._id'))
        let address0 = await req.app.locals.db.main.Address.findOne({
            code: lodash.get(body, 'psgc0', '')
        })
        if (address0) {
            let full = address.build(
                lodash.get(patch, 'addresses.0.unit'),
                lodash.get(patch, 'addresses.0.street'),
                lodash.get(patch, 'addresses.0.village'),
                lodash.get(address0, 'full'),
            )

            lodash.set(patch, 'address', full)
            lodash.set(patch, 'addresses.0.full', lodash.get(address0, 'full'))
            lodash.set(patch, 'addresses.0.brgy', address0.name)
            lodash.set(patch, 'addresses.0.cityMun', address0.cityMunName)
            lodash.set(patch, 'addresses.0.province', address0.provName)
        }

        // TODO: Should generate new id every save??
        lodash.set(patch, 'addresses.1._id', req.app.locals.db.mongoose.Types.ObjectId())
        lodash.set(patch, 'addresses.1.unit', lodash.get(body, 'unit1'))
        lodash.set(patch, 'addresses.1.street', lodash.get(body, 'street1'))
        lodash.set(patch, 'addresses.1.village', lodash.get(body, 'village1'))
        lodash.set(patch, 'addresses.1.psgc', lodash.get(body, 'psgc1'))
        lodash.set(patch, 'addresses.1.zipCode', lodash.get(body, 'zipCode1'))
        lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.1._id'))
        let address1 = await req.app.locals.db.main.Address.findOne({
            code: lodash.get(body, 'psgc1', '')
        })
        if (address1) {
            let full = address.build(
                lodash.get(patch, 'addresses.1.unit'),
                lodash.get(patch, 'addresses.1.street'),
                lodash.get(patch, 'addresses.1.village'),
                lodash.get(address1, 'full'),
            )
            lodash.set(patch, 'address', full)
            lodash.set(patch, 'addresses.1.full', lodash.get(address1, 'full'))
            lodash.set(patch, 'addresses.1.brgy', address1.name)
            lodash.set(patch, 'addresses.1.cityMun', address1.cityMunName)
            lodash.set(patch, 'addresses.1.province', address1.provName)
        }

        lodash.set(patch, 'personal.birthPlace', lodash.get(body, 'birthPlace'))
        lodash.set(patch, 'personal.height', lodash.get(body, 'height'))
        lodash.set(patch, 'personal.weight', lodash.get(body, 'weight'))
        lodash.set(patch, 'personal.bloodType', lodash.get(body, 'bloodType'))
        lodash.set(patch, 'personal.gsis', lodash.get(body, 'gsis'))
        lodash.set(patch, 'personal.sss', lodash.get(body, 'sss'))
        lodash.set(patch, 'personal.philHealth', lodash.get(body, 'philHealth'))
        lodash.set(patch, 'personal.tin', lodash.get(body, 'tin'))
        lodash.set(patch, 'personal.pagibig', lodash.get(body, 'pagibig'))
        lodash.set(patch, 'personal.agencyEmployeeNumber', lodash.get(body, 'agencyEmployeeNumber'))
        lodash.set(patch, 'personal.citizenship', lodash.get(body, 'citizenship', []))
        lodash.set(patch, 'personal.citizenshipCountry', lodash.get(body, 'citizenshipCountry', ''))
        lodash.set(patch, 'personal.citizenshipSource', lodash.get(body, 'citizenshipSource', []))

        lodash.set(patch, 'personal.spouse.lastName', lodash.get(body, 'spouse.lastName'))
        lodash.set(patch, 'personal.spouse.firstName', lodash.get(body, 'spouse.firstName'))
        lodash.set(patch, 'personal.spouse.middleName', lodash.get(body, 'spouse.middleName'))
        lodash.set(patch, 'personal.spouse.suffix', lodash.get(body, 'spouse.suffix'))
        lodash.set(patch, 'personal.spouse.birthDate', lodash.get(body, 'spouse.birthDate'))
        lodash.set(patch, 'personal.spouse.occupation', lodash.get(body, 'spouse.occupation'))
        lodash.set(patch, 'personal.spouse.employerOrBusinessName', lodash.get(body, 'spouse.employerOrBusinessName'))
        lodash.set(patch, 'personal.spouse.businessAddress', lodash.get(body, 'spouse.businessAddress'))
        lodash.set(patch, 'personal.spouse.phone', lodash.get(body, 'spouse.phone'))

        lodash.set(patch, 'personal.children', lodash.get(body, 'children', []))
        lodash.set(patch, 'personal.schools', lodash.get(body, 'schools', []))

        lodash.set(patch, 'personal.father.lastName', lodash.get(body, 'father.lastName'))
        lodash.set(patch, 'personal.father.firstName', lodash.get(body, 'father.firstName'))
        lodash.set(patch, 'personal.father.middleName', lodash.get(body, 'father.middleName'))
        lodash.set(patch, 'personal.father.suffix', lodash.get(body, 'father.suffix'))
        lodash.set(patch, 'personal.father.birthDate', lodash.get(body, 'father.birthDate'))
        lodash.set(patch, 'personal.mother.lastName', lodash.get(body, 'mother.lastName'))
        lodash.set(patch, 'personal.mother.firstName', lodash.get(body, 'mother.firstName'))
        lodash.set(patch, 'personal.mother.middleName', lodash.get(body, 'mother.middleName'))
        lodash.set(patch, 'personal.mother.birthDate', lodash.get(body, 'mother.birthDate'))

        // return res.send(patch)
        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

        flash.ok(req, 'employee', `PDS updated.`)
        if (lodash.get(body, 'actionType') === 'saveNext') {
            return res.redirect(`/e-profile/pds2`)
        }
        res.redirect(`/e-profile/pds1`)
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/pds2', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        return res.redirect(`/e/pds/personal-info`)

        res.render('e-profile/pds2.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/pds2', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = res.employee.toObject()
        let body = lodash.get(req, 'body')
        // return res.send(body)

        lodash.set(patch, 'personal.eligibilities', lodash.get(body, 'eligibilities', []))
        lodash.set(patch, 'personal.workExperiences', lodash.get(body, 'workExperiences', []))

        patch.personal.eligibilities = patch.personal.eligibilities.sort((a, b) => {
            let aFrom = moment(a.examDate).unix()
            let bFrom = moment(b.examDate).unix()
            if (aFrom < bFrom) {
                return 1;
            }
            if (aFrom > bFrom) {
                return -1;
            }
            return 0;
        })

        patch.personal.workExperiences = patch.personal.workExperiences.sort((a, b) => {
            let aFrom = moment(a.fromDate).unix()
            let bFrom = moment(b.fromDate).unix()
            if (aFrom < bFrom) {
                return 1;
            }
            if (aFrom > bFrom) {
                return -1;
            }
            return 0;
        })

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

        flash.ok(req, 'employee', `PDS updated.`)

        if (lodash.get(body, 'actionType') === 'saveNext') {
            return res.redirect(`/e-profile/pds3`)
        }
        res.redirect(`/e-profile/pds2`)
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/pds3', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        return res.redirect(`/e/pds/personal-info`)

        res.render('e-profile/pds3.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/pds3', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = res.employee.toObject()
        let body = lodash.get(req, 'body')
        // return res.send(body)

        lodash.set(patch, 'personal.voluntaryWorks', lodash.get(body, 'voluntaryWorks', []))
        lodash.set(patch, 'personal.trainings', lodash.get(body, 'trainings', []))
        lodash.set(patch, 'personal.extraCurriculars', lodash.get(body, 'extraCurriculars', []))

        patch.personal.voluntaryWorks = patch.personal.voluntaryWorks.sort((a, b) => {
            let aFrom = moment(a.fromDate).unix()
            let bFrom = moment(b.fromDate).unix()
            if (aFrom < bFrom) {
                return 1;
            }
            if (aFrom > bFrom) {
                return -1;
            }
            return 0;
        })

        patch.personal.trainings = patch.personal.trainings.sort((a, b) => {
            let aFrom = moment(a.fromDate).unix()
            let bFrom = moment(b.fromDate).unix()
            if (aFrom < bFrom) {
                return 1;
            }
            if (aFrom > bFrom) {
                return -1;
            }
            return 0;
        })

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

        flash.ok(req, 'employee', `PDS updated.`)

        if (lodash.get(body, 'actionType') === 'saveNext') {
            return res.redirect(`/e-profile/pds4`)
        }
        res.redirect(`/e-profile/pds3`)
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/pds4', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        return res.redirect(`/e/pds/personal-info`)

        res.render('e-profile/pds4.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/pds4', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = res.employee.toObject()
        let body = lodash.get(req, 'body')
        // return res.send(body)

        lodash.set(patch, 'personal.relatedThirdDegree', lodash.get(body, 'relatedThirdDegree'))
        lodash.set(patch, 'personal.relatedFourthDegree', lodash.get(body, 'relatedFourthDegree'))
        lodash.set(patch, 'personal.relatedFourthDegreeDetails', lodash.get(body, 'relatedFourthDegreeDetails'))
        lodash.set(patch, 'personal.guiltyAdmin', lodash.get(body, 'guiltyAdmin'))
        lodash.set(patch, 'personal.guiltyAdminDetails', lodash.get(body, 'guiltyAdminDetails'))
        lodash.set(patch, 'personal.criminalCharge', lodash.get(body, 'criminalCharge'))
        lodash.set(patch, 'personal.criminalChargeDetails', lodash.get(body, 'criminalChargeDetails'))
        lodash.set(patch, 'personal.criminalChargeDate', lodash.get(body, 'criminalChargeDate'))
        lodash.set(patch, 'personal.convicted', lodash.get(body, 'convicted'))
        lodash.set(patch, 'personal.convictedDetails', lodash.get(body, 'convictedDetails'))
        lodash.set(patch, 'personal.problematicHistory', lodash.get(body, 'problematicHistory'))
        lodash.set(patch, 'personal.problematicHistoryDetails', lodash.get(body, 'problematicHistoryDetails'))
        lodash.set(patch, 'personal.electionCandidate', lodash.get(body, 'electionCandidate'))
        lodash.set(patch, 'personal.electionCandidateDetails', lodash.get(body, 'electionCandidateDetails'))
        lodash.set(patch, 'personal.electionResigned', lodash.get(body, 'electionResigned'))
        lodash.set(patch, 'personal.electionResignedDetails', lodash.get(body, 'electionResignedDetails'))
        lodash.set(patch, 'personal.dualCitizen', lodash.get(body, 'dualCitizen'))
        lodash.set(patch, 'personal.dualCitizenDetails', lodash.get(body, 'dualCitizenDetails'))
        lodash.set(patch, 'personal.indigenousGroup', lodash.get(body, 'indigenousGroup'))
        lodash.set(patch, 'personal.indigenousGroupDetails', lodash.get(body, 'indigenousGroupDetails'))
        lodash.set(patch, 'personal.pwd', lodash.get(body, 'pwd'))
        lodash.set(patch, 'personal.pwdDetails', lodash.get(body, 'pwdDetails'))
        lodash.set(patch, 'personal.soloParent', lodash.get(body, 'soloParent'))
        lodash.set(patch, 'personal.soloParentDetails', lodash.get(body, 'soloParentDetails'))
        lodash.set(patch, 'personal.references', lodash.get(body, 'references', []))
        lodash.set(patch, 'personal.governmentId', lodash.get(body, 'governmentId'))
        lodash.set(patch, 'personal.governmentIdNumber', lodash.get(body, 'governmentIdNumber'))
        lodash.set(patch, 'personal.governmentIdDatePlace', lodash.get(body, 'governmentIdDatePlace'))
        lodash.set(patch, 'personal.datePdsFilled', lodash.get(body, 'datePdsFilled'))
        lodash.set(patch, 'personal.personAdministeringOath', lodash.get(body, 'personAdministeringOath'))

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

        flash.ok(req, 'employee', `PDS updated.`)

        res.redirect(`/e-profile/pds4`)
    } catch (err) {
        next(err);
    }
});

// Attendance
router.get('/e-profile/attendance/:attendanceId/analyze', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeAttendance, async (req, res, next) => {
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
        res.render('e-profile/attendance/analysis.html', {
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

module.exports = router;