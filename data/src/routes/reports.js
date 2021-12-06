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

router.get('/reports/rsp/all', async (req, res, next) => {
    try {

        let aggr = [
            {
                $match: {
                    gender: 'F'
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
                $match: {
                    'employments.0': {
                        $exists: true
                    }
                }
            },
            { $count: "total" }
        ]
        let females = await db.main.Employee.aggregate(aggr)
        females = lodash.get(females, '0.total', 0)

        aggr = [
            {
                $match: {
                    gender: 'M'
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
                $match: {
                    'employments.0': {
                        $exists: true
                    }
                }
            },
            { $count: "total" }
        ]
        let males = await db.main.Employee.aggregate(aggr)
        males = lodash.get(males, '0.total', 0)

        let total = males + females
        let data = {
            total: total,
            males: males,
            females: females,
            malesPercentage: Math.round(males / total * 100),
            femalesPercentage: Math.round(females / total * 100),
        }
        res.render('reports/rsp/all.html', data);
    } catch (err) {
        next(err);
    }
});

router.get('/reports/rsp/gender', async (req, res, next) => {
    try {

        let start = lodash.get(req, 'query.start', moment().format('YYYY-MM-DD'))
        let end = lodash.get(req, 'query.end', moment().format('YYYY-MM-DD'))

        let startMoment = moment(start).startOf('day')
        let endMoment = moment(end).endOf('day')
        let aggr = [
            {
                $match: {
                    gender: 'F'
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
                $match: {
                    'employments.0': {
                        $exists: true
                    }
                }
            },
            { $count: "total" }
        ]
        let females = await db.main.Employee.aggregate(aggr)
        females = lodash.get(females, '0.total', 0)
        aggr = [
            {
                $match: {
                    gender: 'M'
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
                $match: {
                    'employments.0': {
                        $exists: true
                    }
                }
            },
            { $count: "total" }
        ]
        let males = await db.main.Employee.aggregate(aggr)
        males = lodash.get(males, '0.total', 0)

        let total = males + females
        let data = {
            total: total,
            males: males,
            females: females,
            malesPercentage: Math.round(males / total * 100),
            femalesPercentage: Math.round(females / total * 100),
        }
        res.render('reports/rsp/gender.html', data);
    } catch (err) {
        next(err);
    }
});

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
        let end = lodash.get(req, 'query.end', moment().format('YYYY-MM-DD'))

        let startMoment = moment(start).startOf('day')
        let endMoment = moment(end).endOf('day')

        let aggr = [
            {
                $match: {
                    createdAt: {
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
                    'createdAt': -1
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
            endDate: endMoment.format('YYYY-MM-DD'),
        }
        // return res.send(data)
        res.render('reports/rar/early.html', data);
    } catch (err) {
        next(err);
    }
});

module.exports = router;