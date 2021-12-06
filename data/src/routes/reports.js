//// Core modules
const fs = require('fs')

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');

// Router
let router = express.Router()

router.use('/reports', middlewares.requireAuthUser)
// router.use('/reports', middlewares.guardRoute(['read_all_admin', 'create_admin', 'read_admin', 'update_admin', 'delete_admin']))

router.get('/reports/all', async (req, res, next) => {
    try {

        res.render('reports/all.html', {
            flash: flash.get(req, 'reports'),
        });
    } catch (err) {
        next(err);
    }
});


router.get('/reports/attendance/incomplete', async (req, res, next) => {
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

router.get('/reports/attendance/complete', async (req, res, next) => {
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
router.get('/reports/rsp/all', async (req, res, next) => {
    try {
        res.render('reports/rsp/all.html');
    } catch (err) {
        next(err);
    }
});
router.get('/reports/rsp/gender', async (req, res, next) => {
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
        res.render('reports/rsp/gender.html', data);
    } catch (err) {
        next(err);
    }
});

// PM
router.get('/reports/pm/all', async (req, res, next) => {
    try {
        res.render('reports/pm/all.html');
    } catch (err) {
        next(err);
    }
});
router.get('/reports/pm/non-party', async (req, res, next) => {
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
router.get('/reports/rar/all', async (req, res, next) => {
    try {
        res.render('reports/rar/all.html');
    } catch (err) {
        next(err);
    }
});
router.get('/reports/rar/early', async (req, res, next) => {
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