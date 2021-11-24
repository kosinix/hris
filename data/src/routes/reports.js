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
                            $in: ['wfh','travel','pass','leave']
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


module.exports = router;