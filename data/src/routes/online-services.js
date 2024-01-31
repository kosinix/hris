//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const middlewares = require('../middlewares');
const paginator = require('../paginator');

// Router
let router = express.Router()

router.use('/online-services', middlewares.requireAuthUser)

router.get('/online-services/home', middlewares.guardRoute(['read_all_attendance']), async (req, res, next) => {
    try {
        let data = {
            title: 'Human Resource Online Services (HROS)',
            flash: flash.get(req, 'online-services'),
            momentNow: moment(),
        }
        res.render('online-services/home.html', data);

    } catch (err) {
        next(err);
    }
});

// Authority to Travel
router.get('/online-services/at/all', middlewares.guardRoute(['read_all_attendance']), async (req, res, next) => {
    try {
        let lastId = lodash.get(req, 'query.lastId', '')
        let perPage = 100
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let lastName = lodash.get(req, 'query.lastName')
        lodash.set(req, 'session.pagination.perPage', perPage)

        let query = {}

        if (lastId) {
            if (sortOrder === -1) {
                query = {
                    _id: {
                        $lt: req.app.locals.db.mongoose.Types.ObjectId(lastId)
                    }
                }
            } else {
                query = {
                    _id: {
                        $gt: req.app.locals.db.mongoose.Types.ObjectId(lastId)
                    }
                }
            }
        }

        let aggr = []

        // Sort by _id 
        aggr.push({ $sort: { _id: sortOrder } })
        aggr.push({ $match: query })
        if (!lastName) {
            aggr.push({ $limit: perPage })
        }
        aggr.push({
            $lookup:
            {
                localField: "employeeId",
                foreignField: "_id",
                from: "employees",
                as: "employees"
            }
        })
        aggr.push({
            $addFields: {
                "employee": {
                    $arrayElemAt: ["$employees", 0]
                }
            }
        })
        // Turn array employees into field employee
        // Add field employee
        aggr.push({
            $project: {
                employees: 0,
            }
        })


        if (lastName) {
            aggr.push({
                $match: {
                    'employee.lastName': new RegExp(lastName, "i")
                }
            })
            aggr.push({ $limit: perPage })

        }

        let util = require('util')
        console.log(util.inspect(aggr, false, null, true))
        let ats = await req.app.locals.db.main.LeaveForm.aggregate(aggr)

        //
        aggr = []

        // Sort by _id 
        aggr.push({ $sort: { _id: sortOrder } })
        if (lastName) {
            aggr.push({
                $lookup:
                {
                    localField: "employeeId",
                    foreignField: "_id",
                    from: "employees",
                    as: "employees"
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
                $match: {
                    'employee.lastName': new RegExp(lastName, "i")
                }
            })
        }

        let counts = await req.app.locals.db.main.LeaveForm.aggregate(aggr)

        // return res.send(ats)
        let data = {
            title: 'Human Resource Online Services (HROS) - Authority to Travel',
            flash: flash.get(req, 'online-services'),
            ats: ats,
            sortOrder: sortOrder,
            lastName: lastName,
            page: page,
            perPage: perPage,
            momentNow: moment(),
            count: counts.length
        }
        res.render('online-services/authority-to-travel/all.html', data);

    } catch (err) {
        next(err);
    }
});

router.get('/online-services/at/:atId', middlewares.guardRoute(['read_all_attendance']), async (req, res, next) => {
    try {
        let atId = req.params.atId
        let at = await req.app.locals.db.main.AuthorityToTravel.findById(atId).lean()
        if (!at) {
            throw new Error('Not found.')
        }
        let data = {
            title: 'Edit Authority to Travel',
            flash: flash.get(req, 'online-services'),
            at: at,
        }
        res.render('online-services/authority-to-travel/update.html', data);

    } catch (err) {
        next(err);
    }
});
router.post('/online-services/at/:atId/update', middlewares.guardRoute(['read_all_attendance']), async (req, res, next) => {
    try {
        let atId = req.params.atId
        let at = await req.app.locals.db.main.AuthorityToTravel.findById(atId)
        if (!at) {
            throw new Error('Not found.')
        }
        at.periodOfTravel = moment(req.body.periodOfTravel).toDate()
        at.periodOfTravelEnd = moment(req.body.periodOfTravelEnd).toDate()
        await at.save()

        flash.ok(req, 'online-services', `Authority to Travel updated.`)
        res.redirect(`/online-services/at/${at._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/online-services/at/:atId/delete', middlewares.guardRoute(['read_all_attendance']), async (req, res, next) => {
    try {
        let atId = req.params.atId
        let at = await req.app.locals.db.main.AuthorityToTravel.findById(atId)
        if (!at) {
            throw new Error('Not found.')
        }
        console.log(at)
        await at.remove()

        flash.ok(req, 'online-services', `Authority to Travel deleted.`)
        res.redirect(`/online-services/at/all`)
    } catch (err) {
        next(err);
    }
});

// Leave Form
router.get('/online-services/leave/all', middlewares.guardRoute(['read_all_attendance']), async (req, res, next) => {
    try {
        let lastId = lodash.get(req, 'query.lastId', '')
        let perPage = 100
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let lastName = lodash.get(req, 'query.lastName')
        lodash.set(req, 'session.pagination.perPage', perPage)

        let query = {}

        if (lastId) {
            if (sortOrder === -1) {
                query = {
                    _id: {
                        $lt: req.app.locals.db.mongoose.Types.ObjectId(lastId)
                    }
                }
            } else {
                query = {
                    _id: {
                        $gt: req.app.locals.db.mongoose.Types.ObjectId(lastId)
                    }
                }
            }
        }

        let aggr = []

        // Sort by _id 
        aggr.push({ $sort: { _id: sortOrder } })
        aggr.push({ $match: query })
        if (!lastName) {
            aggr.push({ $limit: perPage })
        }
        aggr.push({
            $lookup:
            {
                localField: "employeeId",
                foreignField: "_id",
                from: "employees",
                as: "employees"
            }
        })
        aggr.push({
            $addFields: {
                "employee": {
                    $arrayElemAt: ["$employees", 0]
                }
            }
        })
        // Turn array employees into field employee
        // Add field employee
        aggr.push({
            $project: {
                employees: 0,
            }
        })


        if (lastName) {
            aggr.push({
                $match: {
                    'employee.lastName': new RegExp(lastName, "i")
                }
            })
            aggr.push({ $limit: perPage })

        }

        let util = require('util')
        console.log(util.inspect(aggr, false, null, true))
        let ats = await req.app.locals.db.main.LeaveForm.aggregate(aggr)

        //
        aggr = []

        // Sort by _id 
        aggr.push({ $sort: { _id: sortOrder } })
        if (lastName) {
            aggr.push({
                $lookup:
                {
                    localField: "employeeId",
                    foreignField: "_id",
                    from: "employees",
                    as: "employees"
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
                $match: {
                    'employee.lastName': new RegExp(lastName, "i")
                }
            })
        }

        let counts = await req.app.locals.db.main.LeaveForm.aggregate(aggr)

        // return res.send(ats)
        let data = {
            title: 'Human Resource Online Services (HROS) - Application for Leave',
            flash: flash.get(req, 'online-services'),
            ats: ats,
            sortOrder: sortOrder,
            lastName: lastName,
            page: page,
            perPage: perPage,
            momentNow: moment(),
            count: counts.length
        }
        res.render('online-services/leave/all.html', data);

    } catch (err) {
        next(err);
    }
});

router.get('/online-services/leave/:atId', middlewares.guardRoute(['read_all_attendance']), async (req, res, next) => {
    try {
        let atId = req.params.atId
        let at = await req.app.locals.db.main.LeaveForm.findById(atId).lean()
        if (!at) {
            throw new Error('Not found.')
        }
        let data = {
            title: 'Edit Authority to Travel',
            flash: flash.get(req, 'online-services'),
            at: at,
        }
        res.render('online-services/authority-to-travel/update.html', data);

    } catch (err) {
        next(err);
    }
});
router.post('/online-services/leave/:atId/update', middlewares.guardRoute(['read_all_attendance']), async (req, res, next) => {
    try {
        let atId = req.params.atId
        let at = await req.app.locals.db.main.LeaveForm.findById(atId)
        if (!at) {
            throw new Error('Not found.')
        }
        at.periodOfTravel = moment(req.body.periodOfTravel).toDate()
        at.periodOfTravelEnd = moment(req.body.periodOfTravelEnd).toDate()
        await at.save()

        flash.ok(req, 'online-services', `Authority to Travel updated.`)
        res.redirect(`/online-services/at/${at._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/online-services/leave/:atId/delete', middlewares.guardRoute(['read_all_attendance']), async (req, res, next) => {
    try {
        let atId = req.params.atId
        let at = await req.app.locals.db.main.LeaveForm.findById(atId)
        if (!at) {
            throw new Error('Not found.')
        }
        console.log(at)
        await at.remove()

        flash.ok(req, 'online-services', `Authority to Travel deleted.`)
        res.redirect(`/online-services/at/all`)
    } catch (err) {
        next(err);
    }
});
module.exports = router;