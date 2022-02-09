//// Core modules
const fs = require('fs')

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const db = require('../db');
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

        let attendances = await db.main.Attendance.aggregate(aggr)
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

        let attendances = await db.main.Attendance.aggregate(aggr)
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

        let employees = await db.main.Employee.aggregate([
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
                    'employments.0': {
                        $exists: true // employed!
                    }
                }
            },
        ])
        let overall = generate(
            employees.length,
            employees.filter(e => e.gender === 'M').length,
            employees.filter(e => e.gender === 'F').length
        )

        employees = await db.main.Employee.aggregate([
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

        employees = await db.main.Employee.aggregate([
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
                    'employments.0.group': 'staff'
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
            'employments.0': {
                $exists: true // employed!
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

        // let employees = await db.main.Employee.find(query, projection, options).sort(sort)
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
        let countDocuments = await db.main.Employee.aggregate(aggr)
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
        let employees = await db.main.Employee.aggregate(aggr)
       
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

        let employees = await db.main.Employee.aggregate([
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
        let earlyBirds = await db.main.Attendance.aggregate(aggr)

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