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
const passwordMan = require('../password-man');
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

        let roles = await db.main.Role.find()
        let permissions = await db.main.Role.find()
        let password = passwordMan.randomString(10)
        // return res.send(roles)
        res.render('user/create.html', {
            roles: roles,
            permissions: permissions,
            password: password,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/user/create', middlewares.guardRoute(['create_user']), async (req, res, next) => {
    try {
        let body = req.body
        // return res.send(body)
        let patch = {}
        lodash.set(patch, 'firstName', lodash.get(body, 'firstName'))
        lodash.set(patch, 'middleName', lodash.get(body, 'middleName'))
        lodash.set(patch, 'lastName', lodash.get(body, 'lastName'))
        lodash.set(patch, 'email', lodash.get(body, 'email'))
        lodash.set(patch, 'username', lodash.get(body, 'username'))
        lodash.set(patch, 'active', lodash.get(body, 'active'))
        lodash.set(patch, 'roles', lodash.get(body, 'roles'))

        let password = lodash.get(body, 'password')
        let salt = passwordMan.randomString(16)
        let passwordHash = passwordMan.hashPassword(password, salt)
        lodash.set(patch, 'passwordHash', passwordHash)
        lodash.set(patch, 'salt', salt)

        let user = await db.main.User.create(patch)

        flash.ok(req, 'user', `Added "${user.username}"".`)
        res.redirect(`/user/${user._id}`)
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


router.get('/user/:userId/edit', middlewares.guardRoute(['read_user']), middlewares.getUser, async (req, res, next) => {
    try {
        let user = res.user.toObject()

        let roles = await db.main.Role.find().lean()
        let permissions = await db.main.Permission.find().lean()
        let password = passwordMan.randomString(10)
        // return res.send(roles)
        res.render('user/edit.html', {
            user: user,
            roles: roles,
            permissions: permissions,
            password: password,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/user/:userId/edit', middlewares.guardRoute(['read_user']), middlewares.getUser, async (req, res, next) => {
    try {
        let user = res.user.toObject()

        let body = req.body
        // return res.send(body)
        let patch = {}
        lodash.set(patch, 'firstName', lodash.get(body, 'firstName'))
        lodash.set(patch, 'middleName', lodash.get(body, 'middleName'))
        lodash.set(patch, 'lastName', lodash.get(body, 'lastName'))
        lodash.set(patch, 'email', lodash.get(body, 'email'))
        lodash.set(patch, 'username', lodash.get(body, 'username'))
        lodash.set(patch, 'active', lodash.get(body, 'active'))
        lodash.set(patch, 'roles', lodash.get(body, 'roles'))

        let password = lodash.get(body, 'password')
        if (password) {
            let salt = user.salt
            let passwordHash = passwordMan.hashPassword(password, salt)
            lodash.set(patch, 'passwordHash', passwordHash)
            lodash.set(patch, 'salt', salt)
        }

        await db.main.User.updateOne({ _id: user._id }, patch)

        flash.ok(req, 'user', `Updated "${user.username}"".`)
        res.redirect(`/user/all`)
    } catch (err) {
        next(err);
    }
});
module.exports = router;