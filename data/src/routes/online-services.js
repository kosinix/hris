//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const db = require('../db');
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

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        // console.log(query, projection, options, sort)

        let aggr = []

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
        aggr.push({ $match: query })
        aggr.push({ $sort: sort })

        // Pagination
        let countDocuments = await db.main.AuthorityToTravel.aggregate(aggr)
        let totalDocs = countDocuments.length
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/online-services/at/all',
            req.query
        )

        if (!isNaN(perPage)) {
            aggr.push({ $skip: options.skip })
            aggr.push({ $limit: options.limit })
        }
        let ats = await db.main.AuthorityToTravel.aggregate(aggr)

        // return res.send(ats)
        let data = {
            title: 'Human Resource Online Services (HROS) - Authority to Travel',
            flash: flash.get(req, 'online-services'),
            ats: ats,
            pagination: pagination,
            momentNow: moment(),
        }
        res.render('online-services/authority-to-travel/all.html', data);

    } catch (err) {
        next(err);
    }
});

router.get('/online-services/at/:atId', middlewares.guardRoute(['read_all_attendance']), async (req, res, next) => {
    try {
        let atId = req.params.atId
        let at = await db.main.AuthorityToTravel.findById(atId).lean()
        if(!at){
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
router.get('/online-services/at/:atId/delete', middlewares.guardRoute(['read_all_attendance']), async (req, res, next) => {
    try {
        let atId = req.params.atId
        let at = await db.main.AuthorityToTravel.findById(atId)
        if(!at){
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