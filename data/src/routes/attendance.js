//// Core modules

//// External modules
const kalendaryo = require('kalendaryo')
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const momentRange = require('moment-range')
const momentExt = momentRange.extendMoment(moment)

//// Modules
const dtrHelper = require('../dtr-helper')
const excelGen = require('../excel-gen')
const middlewares = require('../middlewares')
const s3 = require('../aws-s3');
const workScheduler = require('../work-scheduler')


// Router
let router = express.Router()

router.use('/attendance', middlewares.requireAuthUser)

router.get('/attendance/monthly', middlewares.guardRoute(['read_all_attendance']), async (req, res, next) => {
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
            let employmentIds = await req.app.locals.db.main.Employment.find({
                campus: 'mosqueda'
            }).lean()

            employmentIds = employmentIds.map((e) => e._id)

            query['employmentId'] = {
                $in: employmentIds
            }
        }
        // Baterna
        if (res.user.roles.includes('campusdirectorbaterna')) {
            let employmentIds = await req.app.locals.db.main.Employment.find({
                campus: 'baterna'
            }).lean()

            employmentIds = employmentIds.map((e) => e._id)

            query['employmentId'] = {
                $in: employmentIds
            }
        }

        let aggr = []
        aggr.push({ $match: query })

        attendances = await req.app.locals.db.main.Attendance.aggregate(aggr)

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

router.get(['/attendance/daily', `/attendance/daily.xlsx`], middlewares.guardRoute(['read_all_attendance', 'read_attendance']), async (req, res, next) => {
    try {
        let date = lodash.get(req, 'query.date', moment().format('YYYY-MM-DD'))
        let attendanceTypes = lodash.get(req, 'query.byAttendanceType', ['normal', 'wfh', 'leave', 'pass', 'travel'])
        if (!Array.isArray(attendanceTypes)) {
            attendanceTypes = [attendanceTypes]
        }
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
            let employments = await req.app.locals.db.main.Employment.find({
                campus: {
                    $in: employeesForThisCampuses
                }
            }).lean()

            let _employmentIds = employments.map((e) => e._id)

            query['employmentId'] = {
                $in: _employmentIds
            }
        }

        if (attendanceTypes.length > 0) {
            query['type'] = {
                $in: attendanceTypes
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
        attendances = await req.app.locals.db.main.Attendance.aggregate(aggr)
        //return res.send(attendances)

        if (req.originalUrl.includes('.xlsx')) {
            let workbook = await excelGen.templateAttendanceDaily(mCalendar, attendances)

            let buffer = await workbook.xlsx.writeBuffer();
            res.set('Content-Disposition', `attachment; filename="attendance.xlsx"`)
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            return res.send(buffer)
        }

        res.render('attendance/daily.html', {
            flash: flash.get(req, 'attendance'),
            mCalendar: mCalendar,
            attendances: attendances,
            attendanceTypes: attendanceTypes,
            attendanceTypesList: [
                {
                    key: 'normal',
                    value: 'Normal'
                },
                {
                    key: 'wfh',
                    value: 'Work From Home'
                },
                {
                    key: 'travel',
                    value: 'On Travel'
                },
                {
                    key: 'leave',
                    value: 'On Leave'
                },
                {
                    key: 'pass',
                    value: 'Pass Slip'
                }
            ],
        });
    } catch (err) {
        next(err);
    }
});

router.get('/attendance/monitoring', middlewares.guardRoute(['read_all_attendance', 'read_attendance']), async (req, res, next) => {
    try {
        let date = lodash.get(req, 'query.date', moment().format('YYYY-MM-DD'))
        let attendanceTypes = lodash.get(req, 'query.byAttendanceType', ['normal', 'wfh', 'leave', 'pass', 'travel'])
        if (!Array.isArray(attendanceTypes)) {
            attendanceTypes = [attendanceTypes]
        }
        let momentDate = moment(date)

        let query = {
            createdAt: {
                $gte: momentDate.startOf('day').toDate(),
                $lte: momentDate.endOf('day').toDate(),
            }
        }

        // Filter employees per campus depending on role
        // let employeesForThisCampuses = []
        // if (res.user.roles.includes('president')) {
        //     employeesForThisCampuses = lodash.union(employeesForThisCampuses, ['main', 'mosqueda', 'baterna'])
        // }
        // if (res.user.roles.includes('campusdirectormosqueda')) {
        //     employeesForThisCampuses = lodash.union(employeesForThisCampuses, ['mosqueda'])
        // }
        // if (res.user.roles.includes('campusdirectorbaterna')) {
        //     employeesForThisCampuses = lodash.union(employeesForThisCampuses, ['baterna'])
        // }

        // if (employeesForThisCampuses.length > 0) {
        //     let employments = await req.app.locals.db.main.Employment.find({
        //         campus: {
        //             $in: employeesForThisCampuses
        //         }
        //     }).lean()

        //     let _employmentIds = employments.map((e) => e._id)

        //     query['employmentId'] = {
        //         $in: _employmentIds
        //     }
        // }

        if (attendanceTypes.length > 0) {
            query['type'] = 'normal'
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
                _id: 1,
                type: 1,
                employeeId: 1,
                employmentId: 1,
                workScheduleId: 1,
                createdAt: 1,
                updatedAt: 1,
                logs: 1,
                employee: {
                    firstName: 1,
                    middleName: 1,
                    lastName: 1,
                    suffix: 1,
                    gender: 1,
                    profilePhoto: 1,
                },
                employment: {
                    active: 1,
                    employeeId: 1,
                    campus: 1,
                    group: 1,
                    position: 1,
                    department: 1,
                },
            }
        })

        aggr.push({
            $project: {
                employees: 0,
                employments: 0,
            }
        })

        aggr.push({
            $unwind: { path: "$logs" }
        })

        aggr.push({
            $addFields: {
                "logMade": "$logs.dateTime",
                "log": "$logs",
            }
        })

        aggr.push({
            $sort: {
                "logMade": 1
            }
        })

        aggr.push({
            $project: {
                logs: 0,
            }
        })

        //console.log(aggr)
        attendances = await req.app.locals.db.main.Attendance.aggregate(aggr)
        // return res.send(attendances)

        res.render('attendance/monitoring.html', {
            flash: flash.get(req, 'attendance'),
            momentDate: momentDate,
            attendances: attendances,
            attendanceTypes: attendanceTypes,
            aws: {
                bucketName: CONFIG.aws.bucket1.name,
                bucketPrefix: CONFIG.aws.bucket1.prefix,
            },
            s3Prefix: `/${CONFIG.aws.bucket1.name}/${CONFIG.aws.bucket1.prefix}`,
            serverUrl: CONFIG.app.url,
            attendanceTypesList: [
                {
                    key: 'normal',
                    value: 'Normal'
                },
                {
                    key: 'wfh',
                    value: 'Work From Home'
                },
                {
                    key: 'travel',
                    value: 'On Travel'
                },
                {
                    key: 'leave',
                    value: 'On Leave'
                },
                {
                    key: 'pass',
                    value: 'Pass Slip'
                }
            ],
        });
    } catch (err) {
        next(err);
    }
});

// Flag raising
router.get(['/attendance/flag/all', '/attendance/flag.xlsx'], middlewares.guardRoute(['read_all_attendance', 'read_attendance']), async (req, res, next) => {
    try {

        let date = lodash.get(req, 'query.date', lodash.get(req, 'session.attendanceFlag.date', moment().format('YYYY-MM-DD')))
        lodash.set(req, 'session.attendanceFlag.date', date)

        let mCalendar = moment(date)

        let query = {
            createdAt: {
                $gte: mCalendar.clone().startOf('day').toDate(),
                $lte: mCalendar.clone().endOf('day').toDate(),
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
                },
            }
        })
        // Turn array employees into field employee
        // Add field employee
        aggr.push({
            $project: {
                employees: 0
            }
        })

        // Hide not needed for lighter payload
        aggr.push({
            $project: {
                employee: {
                    addresses: 0,
                    personal: 0,
                    employments: 0,
                    mobileNumber: 0,
                    phoneNumber: 0,
                    documents: 0,
                    createdAt: 0,
                    updatedAt: 0,
                    uuid: 0,
                    uid: 0,
                    group: 0,
                    __v: 0,
                    profilePhoto: 0,
                    acceptedDataPrivacy: 0,
                    birthDate: 0,
                    civilStatus: 0,
                    addressPermanent: 0,
                    addressPresent: 0,
                    email: 0,
                    history: 0,
                    speechSynthesisName: 0,
                    address: 0
                }
            }
        })

        aggr.push({
            $sort: { createdAt: 1 }
        })

        //console.log(aggr)
        let attendances = await req.app.locals.db.main.AttendanceFlag.aggregate(aggr)
        attendances = attendances.map((attendance, i) => {
            if (!attendance.source.photo) {
                attendance.source.photo = lodash.get(attendance, 'extra.photo', '')
            }
            attendance.logTime = moment(attendance.dateTime).format('hh:mm A')
            attendance = lodash.pickBy(attendance, function (a, key) {
                return ['_id', 'logTime', 'source', 'employee'].includes(key)
            });
            return attendance
        })
        // return res.send(attendances)

        if (req.originalUrl.includes('.xlsx')) {
            let workbook = await excelGen.templateAttendanceFlag(mCalendar, attendances)

            let buffer = await workbook.xlsx.writeBuffer();
            res.set('Content-Disposition', `attachment; filename="attendance-flag-${mCalendar.format('YYYY-MM-DD')}.xlsx"`)
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            return res.send(buffer)
        }


        res.render('attendance/flag-raising/all.html', {
            flash: flash.get(req, 'attendance'),
            mCalendar: mCalendar,
            attendances: attendances,
            s3Prefix: `/${CONFIG.aws.bucket1.name}/${CONFIG.aws.bucket1.prefix}`,
            serverUrl: CONFIG.app.url,
            next: mCalendar.clone().startOf('isoWeek').add(1, 'week').day("monday").format('YYYY-MM-DD'),
            prev: mCalendar.clone().startOf('isoWeek').subtract(1, 'week').day("monday").format('YYYY-MM-DD'),
        });
    } catch (err) {
        next(err);
    }
});

router.get('/attendance/flag/create', middlewares.guardRoute(['create_attendance']), async (req, res, next) => {
    try {
        res.render('attendance/flag-raising/create.html', {
            flash: flash.get(req, 'attendance'),
            time: moment().format('HH:mm'),
            campus: 'Salvador'
        });
    } catch (err) {
        next(err);
    }
});
router.post('/attendance/flag/create', middlewares.guardRoute(['create_attendance']), async (req, res, next) => {
    try {
        // return res.send(req.body)
        let body = req.body

        let employee = await req.app.locals.db.main.Employee.findById(body.employeeId)
        let time = body.time
        let campus = body.campus
        if (!employee) {
            throw new Error('Employee not found.')
        }

        let momentDate = moment(time, 'HH:mm')

        let attendance = await req.app.locals.db.main.AttendanceFlag.findOne({
            employeeId: employee._id,
            createdAt: {
                $gte: momentDate.clone().startOf('day').toDate(),
                $lt: momentDate.clone().endOf('day').toDate(),
            }
        }).lean()
        if (attendance) {
            throw new Error('Employee has already logged.')
        }

        // Log
        attendance = await req.app.locals.db.main.AttendanceFlag.create({
            employeeId: employee._id,
            dateTime: momentDate.toDate(),
            type: 'normal',
            source: {
                id: res.user._id,
                type: 'adminAccount',
                campus: campus,
            }
        })

        // 
        let query = {
            createdAt: {
                $gte: momentDate.clone().startOf('day').toDate(),
                $lte: momentDate.clone().endOf('day').toDate(),
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
                },
            }
        })
        // Turn array employees into field employee
        // Add field employee
        aggr.push({
            $project: {
                employees: 0,
            }
        })

        // Hide not needed for lighter payload
        aggr.push({
            $project: {
                employee: {
                    addresses: 0,
                    personal: 0,
                    employments: 0,
                    mobileNumber: 0,
                    phoneNumber: 0,
                    documents: 0,
                    createdAt: 0,
                    updatedAt: 0,
                    uuid: 0,
                    uid: 0,
                    group: 0,
                    __v: 0,
                    profilePhoto: 0,
                    acceptedDataPrivacy: 0,
                    birthDate: 0,
                    civilStatus: 0,
                    addressPermanent: 0,
                    addressPresent: 0,
                    email: 0,
                    history: 0,
                    speechSynthesisName: 0,
                    address: 0
                }
            }
        })

        aggr.push({
            $sort: { createdAt: 1 }
        })

        //console.log(aggr)
        let attendances = await req.app.locals.db.main.AttendanceFlag.aggregate(aggr)
        attendances = attendances.map(attendance => {
            if (!attendance.source.photo) {
                attendance.source.photo = lodash.get(attendance, 'extra.photo', '')
            }
            attendance.logTime = moment(attendance.dateTime).format('hh:mm A')

            attendance = lodash.pickBy(attendance, function (a, key) {
                return ['_id', 'employeeId', 'logTime', 'source', 'employee'].includes(key)
            });
            return attendance
        })

        //return res.send(attendances)
        attendance = attendances.pop()
        let user = await req.app.locals.db.main.User.findById(attendance.employee.userId)
        attendance.userId = user._id

        let room = momentDate.format('YYYY-MM-DD')
        req.app.locals.io.of("/flag-raising").to(room).emit('added', attendance)

        flash.ok(req, 'attendance', 'Flag raising attendance saved.')
        res.redirect('/attendance/flag/all')
    } catch (err) {
        next(err);
    }
});
router.get('/attendance/flag/:attendanceFlagId/delete', middlewares.guardRoute(['read_attendance', 'update_attendance']), async (req, res, next) => {
    try {
        let attendanceFlagId = lodash.get(req, 'params.attendanceFlagId')
        let attendance = await req.app.locals.db.main.AttendanceFlag.findById(attendanceFlagId)
        if (!attendance) {
            throw new Error('Attendance not found.')
        }
        let employee = await req.app.locals.db.main.Employee.findById(attendance.employeeId)
        if (!employee) {
            throw new Error('Employee not found.')
        }
        let user = await req.app.locals.db.main.User.findById(employee.userId)
        if (!user) {
            throw new Error('User not found.')
        }

        // Delete files on AWS S3
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'
        let photo = lodash.get(attendance, 'extra.photo', lodash.get(attendance, 'source.photo'))
        if (photo) {
            await s3.deleteObjects({
                Bucket: bucketName,
                Delete: {
                    Objects: [
                        { Key: `${bucketKeyPrefix}${photo}` },
                        { Key: `${bucketKeyPrefix}tiny-${photo}` },
                        { Key: `${bucketKeyPrefix}small-${photo}` },
                        { Key: `${bucketKeyPrefix}medium-${photo}` },
                        { Key: `${bucketKeyPrefix}large-${photo}` },
                    ]
                }
            }).promise()
        }


        let deleted = await attendance.remove()

        let room = moment(deleted.createdAt).format('YYYY-MM-DD')
        req.app.locals.io.of("/flag-raising").to(room).emit('deleted', {
            _id: deleted._id,
            employeeId: employee._id,
            userId: user._id,
        })

        flash.ok(req, 'attendance', `Attendance deleted.`)
        res.redirect('/attendance/flag/all')
    } catch (err) {
        next(err);
    }
});

// V1
router.get('/attendance/employee/:employeeId/employment/:employmentId', middlewares.guardRoute(['read_attendance']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
    try {
        let employee = res.employee
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
        let { days } = await dtrHelper.getDtrByDateRange(req.app.locals.db, employee._id, employment._id, startMoment, endMoment, options)

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

        // compat link
        let periodMonthYear = startMoment.clone().startOf('month').format('YYYY-MM-DD')
        let periodSlice = 'all'
        let mQuincena = startMoment.clone().startOf('month').days(15)
        if (startMoment.isBefore(mQuincena) && endMoment.isAfter(mQuincena)) {
            periodSlice = 'all'
        } else if (startMoment.isSameOrBefore(mQuincena) && endMoment.isSameOrBefore(mQuincena)) {
            periodSlice = '15th'
        } else if (startMoment.isAfter(mQuincena)) {
            periodSlice = '30th'
        }
        let periodWeekDays = 'All'
        if (showWeekDays === 'Mon|Tue|Wed|Thu|Fri|Sat|Sun') {
            periodWeekDays = 'All'
        } else if (showWeekDays === 'Mon|Tue|Wed|Thu|Fri') {
            periodWeekDays = 'Mon-Fri'
        } else if (showWeekDays === 'Sat|Sun') {
            periodWeekDays = 'Sat-Sun'
        }
        // showTotalAs = 'time'
        let countTimeBy = 'all'
        let compatibilityUrl = [
            `periodMonthYear=${periodMonthYear}`,
            `periodSlice=${periodSlice}`,
            `periodWeekDays=${periodWeekDays}`,
            `showTotalAs=${showTotalAs}`,
            `countTimeBy=${countTimeBy}`,
        ]
        compatibilityUrl = compatibilityUrl.join('&')

        let data = {
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
            compatibilityUrl: compatibilityUrl,
        }
        //return res.send(days)
        res.render('attendance/employment.html', data);
    } catch (err) {
        next(err);
    }
});
// V1 Print
router.get('/attendance/employee/:employeeId/employment/:employmentId/print', middlewares.guardRoute(['read_attendance']), middlewares.getEmployee, middlewares.getEmployment, middlewares.getDtrQueries, async (req, res, next) => {
    try {
        let employee = res.employee
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


        let options = {
            padded: true,
            showTotalAs: showTotalAs,
            showWeekDays: showWeekDays,
        }

        let { days, stats } = await dtrHelper.getDtrByDateRange(req.app.locals.db, employee._id, employment._id, startMoment, endMoment, options)

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

        let workSchedule = workSchedules.find(o => {
            return lodash.invoke(o, '_id.toString') === lodash.invoke(employment, 'workScheduleId.toString')
        })

        let data = {
            title: `DTR - ${employee.firstName} ${employee.lastName} ${employee.suffix}`,

            flash: flash.get(req, 'employee'),

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

        // return res.send(days)
        return res.render('e-profile/dtr-print.html', data)
    } catch (err) {
        next(err);
    }
});

router.get('/attendance/employee/:employeeId/employment/:employmentId/attendance/:attendanceId/edit', middlewares.guardRoute(['update_attendance']), middlewares.getEmployee, middlewares.getEmployment, middlewares.getAttendance, async (req, res, next) => {
    try {
        let employee = res.employee
        let employment = res.employment.toObject()
        let attendance = res.attendance.toObject()
        let workSchedules = await req.app.locals.db.main.WorkSchedule.find().lean()

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
        let employee = res.employee
        let employment = res.employment.toObject()
        let attendance = res.attendance.toObject()

        let body = req.body


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

        let { changeLogs, att } = await dtrHelper.editAttendance(req.app.locals.db, attendance._id, patch, res.user)

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

// V2
router.get('/attendance/employment/:employmentId', middlewares.guardRoute(['read_attendance']), middlewares.getEmployment, async (req, res, next) => {
    try {
        let employment = res.employment.toObject()
        let employee = await req.app.locals.db.main.Employee.findById(employment.employeeId).lean()

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
        let { days } = await dtrHelper.getDtrByDateRange2(req.app.locals.db, employee._id, employment._id, startMoment, endMoment, options)

        // console.log(options)
        let totalMinutes = 0
        let totalMinutesUnderTime = 0
        days.forEach((day) => {
            totalMinutes += lodash.get(day, 'dtr.totalMinutes', 0)
            totalMinutesUnderTime += lodash.get(day, 'dtr.underTimeTotalMinutes', 0)
        })

        // return res.send(days)

        let timeRecordSummary = dtrHelper.getTimeBreakdown(totalMinutes, totalMinutesUnderTime, 8)

        // console.log(kalendaryo.getMatrix(momentNow, 0))
        let months = Array.from(Array(12).keys()).map((e, i) => {
            return moment.utc().month(i).startOf('month')
        }); // 1-count
        // return res.send(days)

        // compat link
        let periodMonthYear = startMoment.clone().startOf('month').format('YYYY-MM-DD')
        let periodSlice = 'all'
        let mQuincena = startMoment.clone().startOf('month').days(15)
        if (startMoment.isBefore(mQuincena) && endMoment.isAfter(mQuincena)) {
            periodSlice = 'all'
        } else if (startMoment.isSameOrBefore(mQuincena) && endMoment.isSameOrBefore(mQuincena)) {
            periodSlice = '15th'
        } else if (startMoment.isAfter(mQuincena)) {
            periodSlice = '30th'
        }
        let periodWeekDays = 'All'
        if (showWeekDays === 'Mon|Tue|Wed|Thu|Fri|Sat|Sun') {
            periodWeekDays = 'All'
        } else if (showWeekDays === 'Mon|Tue|Wed|Thu|Fri') {
            periodWeekDays = 'Mon-Fri'
        } else if (showWeekDays === 'Sat|Sun') {
            periodWeekDays = 'Sat-Sun'
        }
        showTotalAs = 'time'
        let countTimeBy = 'all'
        let compatibilityUrl = [
            `periodMonthYear=${periodMonthYear}`,
            `periodSlice=${periodSlice}`,
            `periodWeekDays=${periodWeekDays}`,
            `showTotalAs=${showTotalAs}`,
            `countTimeBy=${countTimeBy}`,
        ]
        compatibilityUrl = compatibilityUrl.join('&')


        let data = {
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
            compatibilityUrl: compatibilityUrl,
        }
        // return res.send(days)
        res.render('attendance/employment2.html', data);
    } catch (err) {
        next(err);
    }
});
router.get('/attendance/employment/:employmentId/print', middlewares.guardRoute(['read_attendance']), middlewares.getEmployment, middlewares.getDtrQueries, async (req, res, next) => {
    try {
        let employment = res.employment
        let employmentId = employment._id
        let employee = await req.app.locals.db.main.Employee.findById(employment.employeeId).lean()

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


        let options = {
            padded: true,
            showTotalAs: showTotalAs,
            showWeekDays: showWeekDays,
        }

        let { days, stats } = await dtrHelper.getDtrByDateRange2(req.app.locals.db, employee._id, employment._id, startMoment, endMoment, options)

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

        let data = {
            title: `DTR - ${employee.firstName} ${employee.lastName} ${employee.suffix}`,

            flash: flash.get(req, 'employee'),

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
            workScheduleWeekDays: workScheduleWeekDays,
            workScheduleWeekEnd: workScheduleWeekEnd,
            workScheduleWeek: workScheduleWeek,
        }

        // return res.send(days)
        return res.render('e-profile/dtr-print2.html', data)
    } catch (err) {
        next(err);
    }
});

router.get('/attendance/:attendanceId/edit', middlewares.guardRoute(['update_attendance']), middlewares.getAttendance, async (req, res, next) => {
    try {
        let attendance = res.attendance.toObject()
        let employee = await req.app.locals.db.main.Employee.findById(attendance.employeeId)
        let employment = await req.app.locals.db.main.Employment.findById(attendance.employmentId)
        let workSchedules = await req.app.locals.db.main.WorkSchedule.find().lean()
        let workSchedule = {}
        if (attendance.workScheduleId) {
            workSchedule = await req.app.locals.db.main.WorkSchedule.findById(attendance.workScheduleId).lean()
        } else {
            workSchedule = await req.app.locals.db.main.WorkSchedule.findById(employment.workScheduleId).lean()
        }

        let workScheduleTimeSegments = dtrHelper.getWorkScheduleTimeSegments(workSchedule, attendance.createdAt)

        // return res.send(workScheduleTimeSegments)

        // Normalize schema
        attendance = dtrHelper.normalizeAttendance(attendance, employee, workScheduleTimeSegments)

        // Schedule segments
        let timeSegments = dtrHelper.buildTimeSegments(workScheduleTimeSegments)

        let logSegments = []
        try {
            logSegments = dtrHelper.buildLogSegments(attendance.logs)
        } catch (errr) {
            console.log(errr)
        }
        let options = {
            ignoreZero: true,
            noSpill: true
        }
        if (employment.employmentType === 'part-time' || attendance.type !== 'normal') {
            options.noSpill = false
        }
        let timeWorked = dtrHelper.countWork(timeSegments, logSegments, options)

        let readableSchedule = workScheduleTimeSegments.map(o => {
            let brs = lodash.get(o, 'breaks', []).map(o => {
                return `${dtrHelper.mToTime(o.start, 'hh:mmA')} - ${dtrHelper.mToTime(o.end, 'hh:mmA')}`
            }).join(', ')
            if (brs) {
                brs = ` (Breaks: ${brs})`
            }
            return `${dtrHelper.mToTime(o.start, 'hh:mmA')} - ${dtrHelper.mToTime(o.end, 'hh:mmA')}${brs}`
        }).join(', ')

        let data = {
            flash: flash.get(req, 'attendance'),
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
        }


        // return res.send(CONFIG.attendance.types.map(o => o.value).filter(o => o !== 'normal')) // logs
        // return res.send(dtrHelper.logSegmentsDtrFormat(logSegments)) // logs
        // return res.send(logSegments) // logs
        // return res.send(workScheduleTimeSegments)
        // return res.send(timeWorked)
        // return res.send(attendance)
        // return res.send(data)
        res.render('attendance/edit2.html', data);
    } catch (err) {
        next(err);
    }
});
router.post('/attendance/:attendanceId/edit', middlewares.guardRoute(['update_attendance']), middlewares.getAttendance, async (req, res, next) => {
    try {
        let user = res.user.toObject()
        let attendance = res.attendance.toObject()
        let employee = await req.app.locals.db.main.Employee.findById(attendance.employeeId).lean()
        if (!employee) throw new Error('Employee not found.')
        let employment = await req.app.locals.db.main.Employment.findById(attendance.employmentId).lean()
        if (!employment) throw new Error('Employment not found.')
        if (!lodash.get(employment, 'workScheduleId')) throw new Error('No work schedule for this employment.')
        if (!lodash.get(attendance, 'workScheduleId')) {
            attendance.workScheduleId = employment.workScheduleId
        }
        let workSchedule = await req.app.locals.db.main.WorkSchedule.findById(attendance.workScheduleId).lean()
        if (!workSchedule) throw new Error('WorkSchedule not found.')

        let workScheduleTimeSegments = dtrHelper.getWorkScheduleTimeSegments(workSchedule, attendance.createdAt)

        // original attendance normalized
        let attendance1 = await dtrHelper.normalizeAttendance(attendance, employee, workScheduleTimeSegments)
        let body = req.body

        // return res.send(attendance1)
        // return res.send(body)

        let patch = {}
        lodash.set(patch, 'type', lodash.get(body, 'type'))
        lodash.set(patch, 'workScheduleId', lodash.get(body, 'workScheduleId'))
        lodash.set(patch, 'log0Type', lodash.get(body, 'logSegmentsDtr.am.type'))
        lodash.set(patch, 'log0', lodash.get(body, 'logSegmentsDtr.am.start'))
        lodash.set(patch, 'log1', lodash.get(body, 'logSegmentsDtr.am.end'))
        lodash.set(patch, 'log2Type', lodash.get(body, 'logSegmentsDtr.pm.type'))
        lodash.set(patch, 'log2', lodash.get(body, 'logSegmentsDtr.pm.start'))
        lodash.set(patch, 'log3', lodash.get(body, 'logSegmentsDtr.pm.end'))
        lodash.set(patch, 'comment', lodash.get(body, 'comment'))

        if (patch.type === '') {
            return res.redirect(`/attendance/${attendance._id}/edit`)
        }

        // return res.send(patch)

        let changes = []
        let noChanges = []

        let { changeLogs, att } = await dtrHelper.editAttendance2(req.app.locals.db, attendance1, patch, res.user)

        // return res.send(att)
        if (changeLogs.length) {
            flash.ok(req, 'attendance', `${changeLogs.join(' ')}`)
        }
        res.redirect(`/attendance/${attendance._id}/edit`)
    } catch (err) {
        next(err);
    }
});

// Copy
router.get('/attendance/:attendanceId/copy', middlewares.guardRoute(['update_attendance']), middlewares.getAttendance, async (req, res, next) => {
    try {
        let attendance = res.attendance.toObject()

        let payload = attendance
        payload._id = null
        delete payload._id
        payload.employmentId = req.query.employmentId
        payload.workScheduleId = req.query.workScheduleId
        payload.changes = []
        payload.comments = []

        let newAttendance = await req.app.locals.db.main.Attendance.create(payload)
        res.send(newAttendance)
    } catch (err) {
        next(err);
    }
});

// Delete
router.get('/attendance/:attendanceId/delete', middlewares.guardRoute(['delete_attendance']), middlewares.getAttendance, async (req, res, next) => {
    try {
        let attendance = res.attendance.toObject()
        let employee = await req.app.locals.db.main.Employee.findById(attendance.employeeId)
        let employment = await req.app.locals.db.main.Employment.findById(attendance.employmentId)
        let workSchedules = await req.app.locals.db.main.WorkSchedule.find().lean()
        let workSchedule = {}
        if (attendance.workScheduleId) {
            workSchedule = await req.app.locals.db.main.WorkSchedule.findById(attendance.workScheduleId).lean()
        } else {
            workSchedule = await req.app.locals.db.main.WorkSchedule.findById(employment.workScheduleId).lean()
        }
        let data = {
            attendance: attendance,
            employee: employee,
            employment: employment,
            workSchedules: workSchedules,
            workSchedule: workSchedule,
        }
        res.render('attendance/delete2.html', data);
    } catch (err) {
        next(err);
    }
});
router.post('/attendance/:attendanceId/delete', middlewares.guardRoute(['delete_attendance']), middlewares.antiCsrfCheck, middlewares.getAttendance, async (req, res, next) => {
    try {
        let attendance = res.attendance
        let employment = await req.app.locals.db.main.Employment.findById(attendance.employmentId)
        let removed = await attendance.remove()
        flash.ok(req, 'attendance', `Deleted attendance: ${moment(removed.createdAt).format('MMM DD, YYYY')}`)
        res.redirect(`/attendance/employment/${employment._id}`);
    } catch (err) {
        next(err);
    }
});
// end V2

router.get('/attendance/employee/:employeeId/employment/:employmentId/attendance/create', middlewares.guardRoute(['create_attendance']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
    try {
        let employee = res.employee
        let employment = res.employment.toObject()
        let workSchedules = await req.app.locals.db.main.WorkSchedule.find().lean()

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
        let employee = res.employee
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

        let conflict = await req.app.locals.db.main.Attendance.findOne({
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

        attendance = await req.app.locals.db.main.Attendance.create(attendance)

        // console.log(attendance)

        flash.ok(req, 'attendance', `Inserted new attendance.`)
        res.redirect(`/attendance/employee/${employee._id}/employment/${employment._id}/attendance/${attendance._id}/edit`)
    } catch (err) {
        next(err);
    }
});

// Work Schedule
router.get('/attendance/schedule/all', middlewares.guardRoute(['read_all_schedule', 'read_schedule']), async (req, res, next) => {
    try {
        let schedules = await req.app.locals.db.main.WorkSchedule.find().lean()
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

        let employeeLists = await req.app.locals.db.main.EmployeeList.find({}, { _id: 1, name: 1 })
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
                memberIds = memberIds.split(',').map(id => new req.app.locals.db.mongoose.Types.ObjectId(id))
                for (let x = 0; x < memberIds.length; x++) {
                    let memberId = memberIds[x]
                    let objectId = null
                    let name = ''
                    let type = ''

                    let employment = await req.app.locals.db.main.Employment.findById(memberId)
                    if (employment) {
                        objectId = employment._id
                        type = 'employment'
                        let employee = await req.app.locals.db.main.Employee.findById(employment.employeeId)
                        if (employee) {
                            name = `${employee.firstName} ${employee.lastName} - ${employment.position}`
                        }
                    } else {
                        let employeeList = await req.app.locals.db.main.EmployeeList.findById(memberId)
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
        await req.app.locals.db.main.WorkSchedule.create(patch)
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

        let employeeLists = await req.app.locals.db.main.EmployeeList.find({
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

        let employeeListeds = await req.app.locals.db.main.EmployeeList.find({
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

        let r = await req.app.locals.db.main.Employment.updateMany({
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
        let attendanceReviews = await req.app.locals.db.main.AttendanceReview.aggregate(aggr)
        let attendanceReview = attendanceReviews[0]

        let workSchedules = await req.app.locals.db.main.WorkSchedule.find()
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
router.get('/attendance/review/:reviewId', middlewares.guardRoute(['update_attendance']), async (req, res, next) => {
    try {
        let user = res.user
        let reviewId = lodash.get(req, 'params.reviewId')
        let attendanceReview = await req.app.locals.db.main.AttendanceReview.findById(reviewId).lean()
        if (!attendanceReview) {
            throw new Error('Not found.')
        }
        let attendance = null
        let employee = null
        let employment = null
        if (attendanceReview) {
            attendance = await req.app.locals.db.main.Attendance.findById(attendanceReview.attendanceId).lean()
            employee = await req.app.locals.db.main.Employee.findById(attendanceReview.employeeId).lean()
            employment = await req.app.locals.db.main.Employment.findById(attendanceReview.employmentId).lean()
        }
        if (!attendance) {
            throw new Error('Attendance not found.')
        }
        if (!employee) {
            throw new Error('Employee not found.')
        }
        if (!employment) {
            throw new Error('Employment not found.')
        }

        let workSchedules = await req.app.locals.db.main.WorkSchedule.find()
        let workSchedule1 = workSchedules.find(o => {
            return lodash.invoke(o, '_id.toString') === lodash.invoke(attendance, 'workScheduleId.toString')
        })
        let workSchedule2 = workSchedules.find(o => {
            return lodash.invoke(o, '_id.toString') === lodash.invoke(attendanceReview, 'workScheduleId.toString')
        })

        let fileType = 'image'
        if (lodash.get(attendanceReview, 'attachments[0]', '').includes('pdf')) {
            fileType = 'pdf'
        }

        let data = {
            flash: flash.get(req, 'attendance'),
            attendanceReview: attendanceReview,
            employee: employee,
            employment: employment,
            attendance: attendance,
            workSchedule1: workSchedule1,
            workSchedule2: workSchedule2,
            fileType: fileType,
        }


        // return res.send(data)
        res.render('attendance/review-read.html', data);
    } catch (err) {
        next(err);
    }
});
router.post('/attendance/review/:reviewId', middlewares.guardRoute(['update_attendance']), async (req, res, next) => {
    try {
        let user = res.user
        let reviewId = lodash.get(req, 'params.reviewId')
        let attendanceReview = await req.app.locals.db.main.AttendanceReview.findById(reviewId).lean()
        let attendance = null
        if (attendanceReview) {
            attendance = await req.app.locals.db.main.Attendance.findById(attendanceReview.attendanceId).lean()
        }
        if (attendance) {

        }

        let action = lodash.get(req, 'body.action')
        if (action == 'reject') {
            await req.app.locals.db.main.AttendanceReview.updateOne({ _id: attendanceReview._id }, {
                status: 'rejected',
                denyReason: lodash.get(req, 'body.denyReason'),
            })
            attendance.changes.push({
                summary: `${user.username} rejected review #${attendanceReview._id}.`,
                objectId: user._id,
                createdAt: moment().toDate()
            })
            await req.app.locals.db.main.Attendance.updateOne({ _id: attendance._id }, { changes: attendance.changes })

            flash.ok(req, 'attendance', 'Application denied.')

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

            let r = await dtrHelper.editAttendance(req.app.locals.db, attendance._id, patch, res.user)
            // console.log(r.changeLogs, r.attendance)
            if (r.attendance) {
                attendance = r.attendance
            }

            await req.app.locals.db.main.AttendanceReview.updateOne({ _id: attendanceReview._id }, {
                status: 'approved',
            })

            attendance.changes.push({
                summary: `${user.username} approved review #${attendanceReview._id}.`,
                objectId: user._id,
                createdAt: moment().toDate()
            })
            await req.app.locals.db.main.Attendance.updateOne({ _id: attendance._id }, { changes: attendance.changes })

            flash.ok(req, 'attendance', 'Application approved.')

        }
        let data = {
            attendanceReview: attendanceReview,
            attendance: attendance,
        }
        return res.redirect('/attendance/review/all')
    } catch (err) {
        next(err);
    }
});

//reports
router.get('/attendance/review2/approved', middlewares.guardRoute(['read_all_attendance', 'update_attendance']), async (req, res, next) => {
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
                    status: 'approved'
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
                $project: {
                    employee: {
                        employments: 0,
                        addresses: 0,
                        personal: 0,
                    }
                }
            },

            // {
            //     $limit: 100
            // },

        ]
        let attendanceReviews = await req.app.locals.db.main.AttendanceReview.aggregate(aggr)
        let attendanceReview = attendanceReviews[0]

        let workSchedules = await req.app.locals.db.main.WorkSchedule.find()
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
        attendanceReviews = attendanceReviews.map((a) => {
            let timeA = lodash.get(a, 'attendance.changes[0].createdAt')
            let timeB = a.attendance.createdAt
            let diff = moment(timeA).diff(moment(timeB), 'days')
            return {
                reviewId: a._id,
                employeeId: a.employeeId,
                firstName: a.employee.firstName,
                middleName: a.employee.middleName,
                lastName: a.employee.lastName,
                timeA: timeA,
                timeB: timeB,
                diff: diff,
            }
        })
        attendanceReviews = attendanceReviews.filter((a, i) => {
            return a.diff > 3
        })
        attendanceReviews = lodash.groupBy(attendanceReviews, (a) => {
            return a.employeeId
        })
        attendanceReviews = lodash.sortBy(attendanceReviews, (a) => {
            return a.length
        }).reverse()
        // return res.send(attendanceReviews)
        res.render('attendance/review2.html', {
            attendanceReviews: attendanceReviews
        });
    } catch (err) {
        next(err);
    }
});

// Holidays
router.get('/attendance/holiday/all', middlewares.guardRoute(['read_all_attendance', 'update_attendance']), async (req, res, next) => {
    try {

        let year = lodash.get(req, 'query.year', moment().startOf('year').format('YYYY'))

        let startMoment = moment().year(year).startOf('year')
        let endMoment = moment().year(year).endOf('year')

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
                    date: { // event date
                        $gte: startMoment.toDate(),
                        $lte: endMoment.toDate(),
                    }
                }
            },
            {
                $sort: {
                    date: 1
                }
            }
        ]
        let holidays = await req.app.locals.db.main.Holiday.aggregate(aggr)

        let data = {
            flash: flash.get(req, 'attendance'),
            holidays: holidays,
            year: startMoment.format('YYYY'),
            start: startMoment.format('YYYY-MM-DD'),
            end: endMoment.format('YYYY-MM-DD'),
        }
        // return res.send(data)
        res.render('attendance/holiday/all.html', data);
    } catch (err) {
        next(err);
    }
});


router.get('/attendance/holiday/create', middlewares.guardRoute(['create_attendance']), async (req, res, next) => {
    try {
        let data = {
            flash: flash.get(req, 'attendance'),
            now: moment().format('YYYY-MM-DD'),
        }
        // return res.send(data)
        res.render('attendance/holiday/create.html', data);
    } catch (err) {
        next(err);
    }
});
router.post('/attendance/holiday', middlewares.guardRoute(['update_attendance']), async (req, res, next) => {
    try {
        let body = lodash.get(req, 'body')
        // return res.send(body)

        let date = lodash.get(body, 'date')
        let name = lodash.get(body, 'name')
        let type = lodash.get(body, 'type')

        let holiday = await req.app.locals.db.main.Holiday.create({
            date: date,
            name: lodash.trim(name),
            type: type
        })

        flash.ok(req, 'attendance', `${holiday.name} added.`)
        res.redirect(`/attendance/holiday/create`)
    } catch (err) {
        next(err);
    }
});
router.get('/attendance/holiday/:holidayId/create-assoc-attendances', middlewares.guardRoute(['update_attendance']), middlewares.getHoliday, async (req, res, next) => {
    try {
        let holiday = res.holiday

        // Get all holiday attendances
        let attendances = await req.app.locals.db.main.Attendance.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: moment(holiday.date).startOf('day').toDate(),
                        $lt: moment(holiday.date).endOf('day').toDate(),
                    }
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
                $lookup: {
                    localField: 'employmentId',
                    foreignField: '_id',
                    from: 'employments',
                    as: 'employments'
                }
            },
            {
                $addFields: {
                    "employee": {
                        $arrayElemAt: ["$employees", 0]
                    }
                },
            },
            {
                $addFields: {
                    "employment": {
                        $arrayElemAt: ["$employments", 0]
                    }
                },
            },
            {
                $project: {
                    employees: 0,
                    employments: 0,
                }
            },
            {
                $project: {
                    type: 1,
                    createdAt: 1,
                    employeeId: 1,
                    employmentId: 1,
                    employee: {
                        _id: 1,
                        firstName: 1,
                        lastName: 1,
                    },
                    employment: {
                        _id: 1,
                        position: 1,
                        employmentType: 1,
                    }
                }
            },
            // {
            //     $match: {
            //         'employment.employmentType': 'cos'
            //     }
            // }
            // {
            //     $sort: {
            //         "employee.lastName": 1
            //     }
            // }
        ])

        let employmentsWithAttendance = attendances.map(a => a.employmentId.toString())

        // return res.send(employmentsWithAttendance)
        // Permanent employees
        let employments = await req.app.locals.db.main.Employment.aggregate([
            {
                $match: {
                    employmentType: 'permanent',
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
                    employees: 0
                }
            }
        ])
        // employments = employments.map((employment) => {
        //     return {
        //         _id: employment._id,
        //         employeeId: employment.employeeId,
        //     }
        // })


        let results = []
        
        for (let e = 0; e < employments.length; e++) {
            let employment = employments[e]

            // Insert if dont have attendance yet on holidate
            let momentNow = moment()
            if (employmentsWithAttendance.includes(employment._id.toString())) {
                // results.push(`Excluded ${employment.position} ${employment._id}`)
            } else {
                let att = await req.app.locals.db.main.Attendance.create({
                    "type": "holiday",
                    "employeeId": employment.employeeId,
                    "employmentId": employment._id,
                    "logs": [],
                    "changes": [{
                        "summary": `${res.user.username} inserted a new attendance.`,
                        "objectId": res.user._id,
                        "createdAt": momentNow.toDate()
                    },
                    {
                        "summary": `${res.user.username} inserted a new attendance.`,
                        "objectId": res.user._id,
                        "createdAt": momentNow.toDate()
                    }],
                    "comments": [{
                        "summary": `Set to Holiday.`,
                        "objectId": res.user._id,
                        "createdAt": momentNow.toDate()
                    }],
                    "createdAt": moment(holiday.date).startOf('day').toDate()
                })
                results.push(`${results.length+1}-${employment.employee.lastName}, ${employment.employee.firstName}`)
            }
        }

        flash.ok(req, 'attendance', `Inserted ${results.length} attendance(s) for holiday "${holiday.name}": ${results.join(", \n")}`)
        res.redirect(`/attendance/holiday/all`)
    } catch (err) {
        next(err);
    }
});
router.get('/attendance/holiday/:holidayId/delete-assoc-attendances', middlewares.guardRoute(['update_attendance']), middlewares.getHoliday, async (req, res, next) => {
    try {
        let holiday = res.holiday

        // Get all holiday attendances
        let attendances = await req.app.locals.db.main.Attendance.aggregate([
            {
                $match: {
                    type: 'holiday',
                    createdAt: moment(holiday.date).startOf('day').toDate()
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
                $project: {
                    type: 1,
                    createdAt: 1,
                    logs: 1,
                    employee: {
                        _id: 1,
                        firstName: 1,
                        lastName: 1,
                    }
                }
            },
            {
                $sort: {
                    "employee.lastName": 1
                }
            }
        ])

        let data = {
            holiday: holiday,
            attendances: attendances
        }
        // return res.send(data)
        res.render(`attendance/holiday/delete-assoc.html`, data)
    } catch (err) {
        next(err);
    }
});
router.post('/attendance/holiday/:holidayId/delete-assoc-attendances', middlewares.antiCsrfCheck, middlewares.guardRoute(['update_attendance']), middlewares.getHoliday, async (req, res, next) => {
    try {
        let holiday = res.holiday

        let rr = await req.app.locals.db.main.Attendance.deleteMany({
            "type": "holiday",
            "createdAt": moment(holiday.date).startOf('day').toDate()
        })

        flash.ok(req, 'attendance', `Deleted ${rr.deletedCount} attendance(s) for holiday "${holiday.name}"`)
        res.redirect(`/attendance/holiday/all`)
    } catch (err) {
        next(err);
    }
});
router.get('/attendance/holiday/:holidayId/delete', middlewares.guardRoute(['delete_attendance']), middlewares.getHoliday, async (req, res, next) => {
    try {
        let holiday = res.holiday.toObject()

        holiday.typeString = ''
        if (holiday.type === 1) {
            holiday.typeString = 'Regular Holiday'

        } else if (holiday.type === 1) {
            holiday.typeString = 'Special Non-working Holiday'
        }

        let data = {
            holiday: holiday
        }

        res.render(`attendance/holiday/delete.html`, data)
    } catch (err) {
        next(err);
    }
});
router.post('/attendance/holiday/:holidayId/delete', middlewares.antiCsrfCheck, middlewares.guardRoute(['delete_attendance']), middlewares.getHoliday, async (req, res, next) => {
    try {
        let holiday = res.holiday

        let message = `${holiday.name} removed.`
        await holiday.remove()

        flash.ok(req, 'attendance', message)
        res.redirect(`/attendance/holiday/all`)
    } catch (err) {
        next(err);
    }
});

router.get('/attendance/holiday/:holidayId', middlewares.guardRoute(['read_attendance']), middlewares.getHoliday, async (req, res, next) => {
    try {
        let holiday = res.holiday

        let data = {
            flash: flash.get(req, 'attendance'),
            holiday: holiday.toObject(),
        }

        // return res.send(data)
        res.render('attendance/holiday/update.html', data);
    } catch (err) {
        next(err);
    }
});

router.post('/attendance/holiday/:holidayId', middlewares.guardRoute(['update_attendance']), middlewares.getHoliday, async (req, res, next) => {
    try {
        let holiday = res.holiday
        let body = lodash.get(req, 'body')
        // return res.send(body)

        let date = lodash.get(body, 'date')
        let name = lodash.get(body, 'name')
        let type = lodash.get(body, 'type')

        await req.app.locals.db.main.Holiday.updateOne(
            {
                _id: holiday._id
            },
            {
                date: date,
                name: lodash.trim(name),
                type: type
            }
        )

        flash.ok(req, 'attendance', `${holiday.name} updated.`)
        res.redirect(`/attendance/holiday/${holiday._id}`)
    } catch (err) {
        next(err);
    }
});


router.get('/attendance/calc', middlewares.guardRoute(['read_attendance']), async (req, res, next) => {
    try {

        let data = {
            flash: flash.get(req, 'attendance'),
        }

        // return res.send(data)
        res.render('attendance/calc.html', data);
    } catch (err) {
        next(err);
    }
});

module.exports = router;