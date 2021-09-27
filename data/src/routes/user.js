//// TODO: Check code
//// Core modules
const fs = require('fs')

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const phAddress = require('ph-address')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const s3 = require('../aws-s3');

// Router
let router = express.Router()

router.use('/user', middlewares.requireAuthUser)

router.get('/user/all', middlewares.guardRoute(['read_all_user', 'create_user', 'read_user', 'update_user', 'delete_user']), async (req, res, next) => {
    try {

        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = lodash.get(req, 'query.customSort')
        let customFilter = lodash.get(req, 'query.customFilter')
        let customFilterValue = lodash.get(req, 'query.customFilterValue')
        lodash.set(req, 'session.pagination.perPage', perPage)

        let query = {
            roles: {
                $nin: ['employee']
            }
        }
        let projection = {}

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        // console.log(query, projection, options, sort)

        let aggr = []

        aggr.push({ $match: query })
        aggr.push({ $sort: sort })

        // Pagination
        let countDocuments = await db.main.User.aggregate(aggr)
        let totalDocs = countDocuments.length
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/user/all',
            req.query
        )

        if (!isNaN(perPage)) {
            aggr.push({ $skip: options.skip })
            aggr.push({ $limit: options.limit })
        }
        let users = await db.main.User.aggregate(aggr)

        // console.log(util.inspect(aggr, false, null, true))

        // return res.send(users)
        res.render('user/all.html', {
            flash: flash.get(req, 'user'),
            users: users,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/user/create', middlewares.guardRoute(['create_user']), async (req, res, next) => {
    try {

        res.render('user/create.html', {});
    } catch (err) {
        next(err);
    }
});
router.post('/user/create', middlewares.guardRoute(['create_user']), async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        lodash.set(patch, 'firstName', lodash.get(body, 'firstName'))
        lodash.set(patch, 'middleName', lodash.get(body, 'middleName'))
        lodash.set(patch, 'lastName', lodash.get(body, 'lastName'))
        lodash.set(patch, 'suffix', lodash.get(body, 'suffix'))
        lodash.set(patch, 'birthDate', lodash.get(body, 'birthDate'))
        lodash.set(patch, 'gender', lodash.get(body, 'gender'))
        // lodash.set(patch, 'addresses.0._id', db.mongoose.Types.ObjectId())
        // lodash.set(patch, 'addresses.0.unit', lodash.get(body, 'unit1'))
        // lodash.set(patch, 'addresses.0.brgyDistrict', lodash.get(body, 'brgyDistrict1'))
        // lodash.set(patch, 'addresses.0.cityMun', lodash.get(body, 'cityMun1'))
        // lodash.set(patch, 'addresses.0.province', lodash.get(body, 'province1'))
        // lodash.set(patch, 'addresses.0.region', lodash.get(body, 'region1'))
        // lodash.set(patch, 'addresses.1._id', db.mongoose.Types.ObjectId())
        // lodash.set(patch, 'addresses.1.unit', lodash.get(body, 'unit2'))
        // lodash.set(patch, 'addresses.1.brgyDistrict', lodash.get(body, 'brgyDistrict2'))
        // lodash.set(patch, 'addresses.1.cityMun', lodash.get(body, 'cityMun2'))
        // lodash.set(patch, 'addresses.1.province', lodash.get(body, 'province2'))
        // lodash.set(patch, 'addresses.1.region', lodash.get(body, 'region2'))
        // lodash.set(patch, 'addressPermanent', lodash.get(patch, 'addresses.0._id'))
        // lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.1._id'))
        // if(body.addressSame === 'true'){
        //     patch.addresses.splice(1,1) // Remove second array
        //     lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.0._id'))
        // }

        // TODO: Check duplicate

        let person = new db.main.Person(patch)
        await person.save()
        flash.ok(req, 'user', `Added ${person.firstName} ${person.lastName}.`)
        res.redirect(`/user/address/${person._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/user/:userId', middlewares.guardRoute(['read_user']), middlewares.getUser, async (req, res, next) => {
    try {
        let user = res.user.toObject()

        res.render('user/read.html', {
            flash: flash.get(req, 'user'),
            user: user,
        });
    } catch (err) {
        next(err);
    }
});
module.exports = router;