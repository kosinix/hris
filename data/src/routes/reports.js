//// Core modules
const fs = require('fs')

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const dtrHelper = require('../dtr-helper');
const excelGen = require('../excel-gen');
const middlewares = require('../middlewares');
const paginator = require('../paginator');

// Router
let router = express.Router()

router.use('/reports', middlewares.requireAuthUser)

router.get('/reports/all', middlewares.guardRoute(['read_all_report']), async (req, res, next) => {
    try {

        res.render('reports/all.html', {
            flash: flash.get(req, 'reports'),
        });
    } catch (err) {
        next(err);
    }
});

router.get('/reports/attendance/incomplete', middlewares.guardRoute(['read_all_report']), async (req, res, next) => {
    try {

        let start = lodash.get(req, 'query.start', moment().format('YYYY-MM-DD'))
        let end = lodash.get(req, 'query.end', moment().format('YYYY-MM-DD'))

        let startMoment = moment(start).startOf('day')
        let endMoment = moment(end).endOf('day')
        let aggr = []
        aggr.push({
            $addFields: {
                "logsLength": {
                    $size: '$logs'
                }
            }
        })

        aggr.push({
            $match: {
                type: 'normal',
                logsLength: {
                    $lt: 4
                },
                createdAt: {
                    $gte: startMoment.clone().startOf('day').toDate(),
                    $lte: endMoment.clone().endOf('day').toDate(),
                }
            }
        })

        // Join
        aggr.push({
            $lookup: {
                localField: 'employeeId',
                foreignField: '_id',
                from: 'employees',
                as: 'employees'
            }
        })

        aggr.push({
            $lookup: {
                localField: 'employmentId',
                foreignField: '_id',
                from: 'employments',
                as: 'employments'
            }
        })

        aggr.push({
            $addFields: {
                "employee": {
                    $arrayElemAt: ["$employees", 0]
                }
            }
        })

        aggr.push({
            $addFields: {
                "employment": {
                    $arrayElemAt: ["$employments", 0]
                }
            }
        })


        aggr.push({
            $project: {
                employees: 0,
                employments: 0,
            }
        })

        let attendances = await req.app.locals.db.main.Attendance.aggregate(aggr)
        // return res.send(attendances)
        res.render('reports/attendance/incomplete.html', {
            flash: flash.get(req, 'reports'),
            attendances: attendances,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/reports/attendance/complete', middlewares.guardRoute(['read_all_report']), async (req, res, next) => {
    try {

        let start = lodash.get(req, 'query.start', moment().format('YYYY-MM-DD'))
        let end = lodash.get(req, 'query.end', moment().format('YYYY-MM-DD'))

        let startMoment = moment(start).startOf('day')
        let endMoment = moment(end).endOf('day')
        let aggr = []
        aggr.push({
            $addFields: {
                "logsLength": {
                    $size: '$logs'
                }
            }
        })

        aggr.push({
            $match: {
                $or: [
                    {
                        type: 'normal',
                        logsLength: {
                            $eq: 4
                        },
                    },
                    {
                        type: {
                            $in: ['wfh', 'travel', 'pass', 'leave']
                        }
                    }
                ],
                createdAt: {
                    $gte: startMoment.clone().startOf('day').toDate(),
                    $lte: endMoment.clone().endOf('day').toDate(),
                }
            }
        })

        // Join
        aggr.push({
            $lookup: {
                localField: 'employeeId',
                foreignField: '_id',
                from: 'employees',
                as: 'employees'
            }
        })

        aggr.push({
            $lookup: {
                localField: 'employmentId',
                foreignField: '_id',
                from: 'employments',
                as: 'employments'
            }
        })

        aggr.push({
            $addFields: {
                "employee": {
                    $arrayElemAt: ["$employees", 0]
                }
            }
        })

        aggr.push({
            $addFields: {
                "employment": {
                    $arrayElemAt: ["$employments", 0]
                }
            }
        })


        aggr.push({
            $project: {
                employees: 0,
                employments: 0,
            }
        })

        let attendances = await req.app.locals.db.main.Attendance.aggregate(aggr)
        // return res.send(attendances)
        res.render('reports/attendance/complete.html', {
            flash: flash.get(req, 'reports'),
            attendances: attendances,
        });
    } catch (err) {
        next(err);
    }
});

// RSP
router.get('/reports/rsp/all', middlewares.guardRoute(['read_all_report']), async (req, res, next) => {
    try {
        res.render('reports/rsp/all.html');
    } catch (err) {
        next(err);
    }
});
router.get('/reports/rsp/gender', middlewares.guardRoute(['read_all_report']), async (req, res, next) => {
    try {

        let generate = (total, males, females) => {
            return {
                total: total,
                females: females,
                males: males,
                femalesPercentage: lodash.toInteger(Math.round(females / total * 100)),
                malesPercentage: lodash.toInteger(Math.round(males / total * 100)),
            }
        }

        let employees = await req.app.locals.db.main.Employee.aggregate([
            {
                $lookup: {
                    localField: '_id',
                    foreignField: 'employeeId',
                    from: 'employments',
                    as: 'employments'
                }
            },
            {
                $match: {
                    'employments': {
                        $elemMatch: {
                            'active': true
                        }
                    }
                }
            },
        ])
        let overall = generate(
            employees.length,
            employees.filter(e => e.gender === 'M').length,
            employees.filter(e => e.gender === 'F').length
        )

        employees = await req.app.locals.db.main.Employee.aggregate([
            {
                $lookup: {
                    localField: '_id',
                    foreignField: 'employeeId',
                    from: 'employments',
                    as: 'employments'
                }
            },
            {
                $match: {
                    'employments.0.group': 'faculty'
                }
            },
        ])
        let faculty = generate(
            employees.length,
            employees.filter(e => e.gender === 'M').length,
            employees.filter(e => e.gender === 'F').length
        )

        employees = await req.app.locals.db.main.Employee.aggregate([
            {
                $lookup: {
                    localField: '_id',
                    foreignField: 'employeeId',
                    from: 'employments',
                    as: 'employments'
                }
            },
            {
                $match: {
                    'employments': {
                        $elemMatch: {
                            'group': 'staff',
                            'active': true
                        }
                    }
                }
            },
        ])
        let staff = generate(
            employees.length,
            employees.filter(e => e.gender === 'M').length,
            employees.filter(e => e.gender === 'F').length
        )

        let data = {
            overall: overall,
            faculty: faculty,
            staff: staff,
        }
        // return res.send(data)
        res.render('reports/rsp/gender/chart.html', data);
    } catch (err) {
        next(err);
    }
});
router.get(['/reports/rsp/gender/table', `/reports/rsp/gender/table.xlsx`], middlewares.guardRoute(['read_all_report']), async (req, res, next) => {
    try {

        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', 'lastName')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = lodash.get(req, 'query.customSort')
        let customFilter = lodash.get(req, 'query.customFilter')
        let customFilterValue = lodash.get(req, 'query.customFilterValue')
        lodash.set(req, 'session.pagination.perPage', perPage)

        let query = {
            'employments': {
                $elemMatch: {
                    'active': true
                }
            }
        }

        if (['gender'].includes(customFilter)) {
            query[`gender`] = customFilterValue
        }

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)
        if (['department', 'employmentType', 'group', 'position', 'campus'].includes(sortBy)) {
            sort[`employments.0.${sortBy}`] = sortOrder
        }

        // console.log(query, projection, options, sort)

        // let employees = await req.app.locals.db.main.Employee.find(query, projection, options).sort(sort)
        let aggr = []

        aggr.push({
            $lookup:
            {
                localField: "_id",
                foreignField: "employeeId",
                from: "employments",
                as: "employments"
            }
        })
        aggr.push({ $match: query })
        aggr.push({ $sort: sort })

        // Pagination
        let countDocuments = await req.app.locals.db.main.Employee.aggregate(aggr)
        let totalDocs = countDocuments.length
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/reports/rsp/gender/table',
            req.query
        )

        if (!isNaN(perPage)) {
            aggr.push({ $skip: options.skip })
            aggr.push({ $limit: options.limit })
        }
        let employees = await req.app.locals.db.main.Employee.aggregate(aggr)

        let data = {
            flash: flash.get(req, 'reports'),
            employees: employees,
            pagination: pagination,
            query: req.query,
        }
        if (req.originalUrl.includes('.xlsx')) {

            let workbook = await excelGen.templateGenderReport(employees)

            let buffer = await workbook.xlsx.writeBuffer();
            res.set('Content-Disposition', `attachment; filename="gender.xlsx"`)
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            return res.send(buffer)
        }

        // return res.send(data)
        res.render('reports/rsp/gender/table.html', data);
    } catch (err) {
        next(err);
    }
});

// LD
// LD - trainings
router.get('/reports/lad/all', middlewares.guardRoute(['read_all_report']), async (req, res, next) => {
    try {
        res.render('reports/lad/all.html');
    } catch (err) {
        next(err);
    }
});
router.get(['/reports/lad/training/all', '/reports/lad/training/all.xlsx'], middlewares.guardRoute(['read_all_report']), async (req, res, next) => {
    try {
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = lodash.get(req, 'query.customSort')
        let customFilter = lodash.get(req, 'query.customFilter')
        let customFilterValue = lodash.get(req, 'query.customFilterValue')
        lodash.set(req, 'session.pagination.perPage', perPage)

        let query = {}
        let projection = {}

        if (['department', 'employmentType', 'group', 'position', 'campus'].includes(customFilter)) {
            query[`employments.0.${customFilter}`] = customFilterValue
        }

        if (['permanent-faculty'].includes(customFilter)) {
            query[`employments.0.employmentType`] = 'permanent'
            query[`employments.0.group`] = 'faculty'
        }
        if (['permanent-staff'].includes(customFilter)) {
            query[`employments.0.employmentType`] = 'permanent'
            query[`employments.0.group`] = 'staff'
        }
        if (['cos-teaching'].includes(customFilter)) {
            query[`employments.0.employmentType`] = 'cos'
            query[`employments.0.group`] = 'faculty'
        }
        if (['cos-staff'].includes(customFilter)) {
            query[`employments.0.employmentType`] = 'cos'
            query[`employments.0.group`] = 'staff'
        }
        if (['part-time'].includes(customFilter)) {
            query[`employments.0.employmentType`] = 'part-time'
            query[`employments.0.group`] = 'faculty'
        }

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)
        if (['department', 'employmentType', 'group', 'position', 'campus'].includes(sortBy)) {
            sort[`employments.0.${sortBy}`] = sortOrder
        }

        // console.log(query, projection, options, sort)

        let aggr = []

        aggr.push({
            $lookup:
            {
                localField: "_id",
                foreignField: "employeeId",
                from: "employments",
                as: "employments"
            }
        })
        // aggr.push({
        //     $project: {
        //         trainings: {
        //             $map: {
        //                 input: "$personal.trainings",
        //                 as: "training",
        //                 in: {
        //                     $getField: "$$training.title"
        //                 }
        //             }
        //         }
        //     }
        // })

        aggr.push({ $match: query })
        aggr.push({ $sort: sort })

        // Pagination
        let countDocuments = await req.app.locals.db.main.Employee.aggregate(aggr)
        let totalDocs = countDocuments.length
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/reports/lad/training/all',
            req.query
        )

        if (!isNaN(perPage)) {
            aggr.push({ $skip: options.skip })
            aggr.push({ $limit: options.limit })
        }
        let employees = await req.app.locals.db.main.Employee.aggregate(aggr)

        employees = employees.map(e => {
            // sort
            let schools = []
            let school = lodash.get(e, 'personal.schools', []).find(s => s.level === 'Elementary')
            if (school) {
                schools.push(school)
            }
            school = e.personal.schools.find(s => s.level === 'Secondary')
            if (school) {
                schools.push(school)
            }

            school = e.personal.schools.find(s => s.level === 'Vocational')
            if (school) {
                schools.push(school)
            }

            school = e.personal.schools.find(s => s.level === 'College')
            if (school) {
                schools.push(school)
            }

            school = e.personal.schools.find(s => s.level === 'Graduate Studies')
            if (school) {
                schools.push(school)
            }

            schools = schools.filter(s => s.name !== '' && s.name !== 'N/A' && s.name !== 'n/a')
            e.lastSchool = schools.pop()

            // eligibilities
            let eligibilities = lodash.get(e, 'personal.eligibilities', [])
            if(!eligibilities) eligibilities = []
            e.eligibilities = eligibilities.filter(o => o.name !== '')
            return e
        })
        // console.log(util.inspect(aggr, false, null, true))

        // return res.send(employees)
        if (req.originalUrl.includes('.xlsx')) {
            let workbook = await excelGen.templateReportTrainingAll(employees, pagination)
            let buffer = await workbook.xlsx.writeBuffer();
            res.set('Content-Disposition', `attachment; filename="overall-trainings.xlsx"`)
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            return res.send(buffer)
        }
        res.render('reports/lad/training/all.html', {
            flash: flash.get(req, 'employee'),
            employees: employees,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});

// PM
router.get('/reports/pm/all', middlewares.guardRoute(['read_all_report']), async (req, res, next) => {
    try {
        res.render('reports/pm/all.html');
    } catch (err) {
        next(err);
    }
});
router.get('/reports/pm/non-party', middlewares.guardRoute(['read_all_report']), async (req, res, next) => {
    try {

        let employees = await req.app.locals.db.main.Employee.aggregate([
            {
                $lookup: {
                    localField: '_id',
                    foreignField: 'employeeId',
                    from: 'attendances',
                    as: 'attendances'
                }
            },
            {
                $lookup: {
                    localField: '_id',
                    foreignField: 'employeeId',
                    from: 'employments',
                    as: 'employments'
                }
            },
            {
                $addFields: {
                    "totalA": {
                        $size: "$attendances"
                    }
                }
            },
            {
                $addFields: {
                    "totalE": {
                        $size: "$employments"
                    }
                }
            },
            {
                $match: {
                    totalE: {
                        $gte: 1
                    },
                    totalA: {
                        $lte: 5
                    }
                }
            },
            {
                $sort: {
                    totalA: 1,
                    'employments.0.employmentType': -1
                }
            },
        ])

        let facus = employees.filter(e => lodash.get(e, 'employments[0].group') == 'faculty')
        let staffs = employees.filter(e => lodash.get(e, 'employments[0].group') == 'staff')
        let data = {
            employees: employees,
            facus: facus,
            staffs: staffs,
        }

        // return res.send(data)
        res.render('reports/pm/non-party.html', data);
    } catch (err) {
        next(err);
    }
});

// PM - Tardiness
router.get(['/reports/pm/tardiness/overall', '/reports/pm/tardiness/overall.xlsx'], middlewares.guardRoute(['read_all_report']), async (req, res, next) => {
    try {

        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = 40 //parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', 'lastName')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))

        let start = lodash.get(req, 'query.start', moment().format('YYYY-MM-DD'))
        let end = lodash.get(req, 'query.end', moment().format('YYYY-MM-DD'))
        let startMoment = moment(start).startOf('day')
        let endMoment = moment(end).endOf('day')

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        let aggr = []
        aggr.push({ $project: { firstName: 1, middleName: 1, lastName: 1 } })
        aggr.push({ $sort: sort })

        // Pagination
        let countDocuments = await req.app.locals.db.main.Employee.aggregate(aggr)
        let totalDocs = countDocuments.length
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/reports/pm/tardiness/overall',
            req.query
        )

        if (!isNaN(perPage)) {
            aggr.push({ $skip: options.skip })
            aggr.push({ $limit: options.limit })
        }
        let employees = await req.app.locals.db.main.Employee.aggregate(aggr)

        let promises = employees.map((employee) => {
            return req.app.locals.db.main.Attendance.aggregate([
                {
                    $match: {
                        employeeId: employee._id,
                        createdAt: {
                            $gte: startMoment.clone().startOf('day').toDate(),
                            $lte: endMoment.clone().endOf('day').toDate(),
                        }
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
                }
            ])
        })

        let results = await Promise.all(promises)
        results.forEach((attendances, i) => {
            attendances = attendances.filter(attendance => {
                let weekDay = moment(attendance.createdAt).format('ddd')
                return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekDay) // These days only
            })

            attendances = attendances.map(attendance => {
                let _moment = moment(attendance.createdAt)
                let date = _moment.format('YYYY-MM-DD')
                let weekDay = _moment.format('ddd')
                let weekDayLower = weekDay.toLowerCase()

                // v2 schedule schema with weekday support
                let timeSegments = lodash.get(attendance, `workSchedule.weekDays.${weekDayLower}.timeSegments`)
                if (timeSegments) {
                    timeSegments = timeSegments.map((t) => {
                        t.maxHours = t.max
                        return t
                    })
                }
                // original schedule schema
                if (!timeSegments) {
                    timeSegments = lodash.get(attendance, 'workSchedule.timeSegments')
                }
                let dtr = dtrHelper.calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints, timeSegments)
                return {
                    date: date,
                    underTimeTotalMinutes: dtr.underTimeTotalMinutes,
                }
            })

            attendances = attendances.filter(attendance => {
                return attendance.underTimeTotalMinutes > 0
            })

            let totalMinutes = attendances.reduce((prev, current) => {
                return prev + current.underTimeTotalMinutes
            }, 0)


            let hoursPerDay = 8
            let underDays = totalMinutes / 60 / hoursPerDay
            let underHours = (underDays - Math.floor(underDays)) * hoursPerDay
            let underMinutes = (underHours - Math.floor(underHours)) * 60

            employees[i].totalMinutes = totalMinutes
            employees[i].underDays = Math.floor(underDays)
            employees[i].underHours = Math.floor(underHours)
            employees[i].underMinutes = Math.round(underMinutes)
            employees[i].undertimeFreq = attendances.length
        })


        let periodString = startMoment.format('MMM DD, YYYY')
        if (startMoment.format('MMM DD, YYYY') != endMoment.format('MMM DD, YYYY')) {
            periodString += ` to ${endMoment.format('MMM DD, YYYY')}`
        }

        // return res.send(employees)
        if (req.originalUrl.includes('.xlsx')) {
            let workbook = await excelGen.templateReportTardinessOverall(employees, periodString, pagination)
            let buffer = await workbook.xlsx.writeBuffer();
            res.set('Content-Disposition', `attachment; filename="overall-tardiness.xlsx"`)
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            return res.send(buffer)
        }
        res.render('reports/pm/tardiness/overall.html', {
            flash: flash.get(req, 'reports'),
            startMoment: startMoment,
            endMoment: endMoment,
            periodString: periodString,
            employees: employees,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});
router.get(['/reports/pm/tardiness/:employmentId/report', '/reports/pm/tardiness/:employmentId/report.xlsx'], middlewares.guardRoute(['read_all_report']), middlewares.getEmployment, async (req, res, next) => {
    try {
        let employment = res.employment
        let employee = await req.app.locals.db.main.Employee.findById(employment.employeeId)

        let start = lodash.get(req, 'query.start', moment().format('YYYY-MM-DD'))
        let end = lodash.get(req, 'query.end', moment().format('YYYY-MM-DD'))
        let showWeekDays = 'Mon|Tue|Wed|Thu|Fri' //lodash.get(req, 'query.showWeekDays', 'Mon|Tue|Wed|Thu|Fri|Sat|Sun') 
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

        let undertimeFreq = days.map(d => {
            return lodash.get(d, 'dtr.underTimeTotalMinutes', 0)
        }).filter(d => d > 0).length
        // console.log(undertimeFreq)
        let totalMinutes = 0
        let totalMinutesUnderTime = 0
        days.forEach((day) => {
            totalMinutes += lodash.get(day, 'dtr.totalMinutes', 0)
            totalMinutesUnderTime += lodash.get(day, 'dtr.underTimeTotalMinutes', 0)
        })

        let timeRecordSummary = dtrHelper.getTimeBreakdown(totalMinutes, totalMinutesUnderTime, 8)
        // return res.send(timeRecordSummary)
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
        showTotalAs = 'undertime'
        let countTimeBy = 'all'
        let compatibilityUrl = [
            `start=${start}`,
            `end=${end}`,
            `periodWeekDays=${periodWeekDays}`,
            `showTotalAs=${showTotalAs}`,
            `countTimeBy=${countTimeBy}`,
        ]
        compatibilityUrl = compatibilityUrl.join('&')


        let periodString = startMoment.format('MMM DD, YYYY')
        if (startMoment.format('MMM DD, YYYY') != endMoment.format('MMM DD, YYYY')) {
            periodString += ` to ${endMoment.format('MMM DD, YYYY')}`
        }

        if (req.originalUrl.includes('.xlsx')) {
            let workbook = await excelGen.templateReportTardinessPerEmployee(employee, periodString, undertimeFreq, timeRecordSummary)
            let buffer = await workbook.xlsx.writeBuffer();
            res.set('Content-Disposition', `attachment; filename="${employee.lastName | replace(/\s/g, '-')}-tardiness.xlsx"`)
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            return res.send(buffer)
        }
        res.render('reports/pm/tardiness/per-employee.html', {
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
            undertimeFreq: undertimeFreq,
            startMoment: startMoment,
            endMoment: endMoment,
            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => o !== 'normal'),
            compatibilityUrl: compatibilityUrl,
        });
    } catch (err) {
        next(err);
    }
});

// PM - Flag Raising
router.get(['/reports/pm/flag-raising/overall', '/reports/pm/flag-raising/overall.csv'], middlewares.guardRoute(['read_all_report']), async (req, res, next) => {
    try {
        let date = lodash.get(req, 'query.date', moment().format('YYYY-MM-DD'))
        let mDate = moment(date)

        let query = {
            createdAt: {
                $gte: mDate.clone().startOf('month').toDate(),
                $lte: mDate.clone().endOf('month').toDate(),
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
            $addFields: { 
                dateGroup: { 
                    $dateToString: { format: "%Y-%m-%d", date: "$dateTime", "timezone": '+08'} 
                }
            }
        })
        
        aggr.push({
            $sort: { 
                'employee.lastName': 1,
                'dateGroup': 1,
            }
        })

        let attendances = await req.app.locals.db.main.AttendanceFlag.aggregate(aggr)
        const dateGroups = Object.keys(lodash.groupBy(attendances, (attendance) => {
            return attendance.dateGroup
        })).sort()
        attendances = lodash.groupBy(attendances, (attendance) => {
            return attendance.employeeId
        })

        let attendancesByGroups = lodash.mapValues(attendances, (attendance, employeeId)=>{
            attendance = lodash.keyBy(attendance, (a) => {
                return a.dateGroup
            })
            return attendance
        })

        // return res.send(attendancesByGroups)
        let months = Array.from(Array(12).keys()).map((e, i) => {
            return mDate.clone().month(i).startOf('month')
        }); // 1-count

        let years = []
        for (let y = parseInt(moment().format('YYYY')); y > 1999; y--) {
            years.push(y)
        }
        if (req.originalUrl.includes('.csv')) {
            let counter = 1
            let csv = lodash.map(attendances, (o, employeeId) => {
                let employee = o[0].employee
                let lastName = employee.lastName || ''
                let firstName = employee.firstName || ''

                let row = [
                    counter,
                    lastName,
                    firstName,
                ]
                dateGroups.forEach((dateGroup)=>{
                    if (attendancesByGroups[employeeId][dateGroup]) {
                        row.push(moment(attendancesByGroups[employeeId][dateGroup].dateTime).format('hh:mm A'))
                    } else {
                        row.push('')
                    }
                })
                row.push(o.length)
                counter++
                return row.join(', ')
            })
            let titleRow = [
                '#',
                'Last Name',
                'First Name',
            ]
            dateGroups.forEach((dateGroup)=>{
                titleRow.push(moment(dateGroup).format('MMM DD (ddd)'))
            })
            titleRow.push(`Out of ${dateGroups.length}`)
            
            csv.unshift(titleRow.join(', '))
            res.set('Content-Disposition', `attachment; filename="Flag-Raising-${mDate.format('MMM-YYYY')}.csv"`)
            res.set('Content-Type', 'text/csv')
            return res.send(csv.join("\n"))
        }
        res.render('reports/pm/flag-raising/overall.html', {
            flash: flash.get(req, 'reports'),
            mDate: mDate,
            months: months,
            years: years,
            attendances: attendances,
            attendancesByGroups: attendancesByGroups,
            dateGroups: dateGroups,
        });
    } catch (err) {
        next(err);
    }
});


// RAR
router.get('/reports/rar/all', middlewares.guardRoute(['read_all_report']), async (req, res, next) => {
    try {
        res.render('reports/rar/all.html');
    } catch (err) {
        next(err);
    }
});
router.get('/reports/rar/early', middlewares.guardRoute(['read_all_report']), async (req, res, next) => {
    try {

        let start = lodash.get(req, 'query.start', moment().format('YYYY-MM-DD'))
        let end = lodash.get(req, 'query.start', moment().format('YYYY-MM-DD'))

        let startMoment = moment(start).startOf('day')
        let endMoment = moment(end).endOf('day')

        let aggr = [
            {
                $match: {
                    type: 'normal',
                    'logs.0.dateTime': {
                        $exists: true,
                        $gte: moment(startMoment).toDate(),
                        $lt: moment(endMoment).toDate(),
                    }
                },
            },
            {
                $lookup: {
                    localField: 'employeeId',
                    foreignField: '_id',
                    from: 'employees',
                    as: 'employees'
                }
            },
            // Attendance can only have one employee, move employees[0] to employee
            {
                $addFields: {
                    "employee": {
                        $arrayElemAt: ["$employees", 0]
                    }
                }
            },
            // Remove employees[]
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
            // Attendance can only have one employment, move employments[0] to employment
            {
                $addFields: {
                    "employment": {
                        $arrayElemAt: ["$employments", 0]
                    }
                }
            },
            // Remove employments[]
            {
                $project: {
                    employments: 0,
                }
            },
            {
                $sort: {
                    'logs.0.dateTime': 1
                }
            },
            {
                $project: {
                    'employee': {
                        personal: 0,
                        employments: 0,
                    }
                }
            },
            { $limit: 10 }
        ]
        let earlyBirds = await req.app.locals.db.main.Attendance.aggregate(aggr)

        let data = {
            earlyBirds: earlyBirds,
            startDate: startMoment.format('YYYY-MM-DD'),
        }
        // return res.send(data)
        res.render('reports/rar/early.html', data);
    } catch (err) {
        next(err);
    }
});

module.exports = router;