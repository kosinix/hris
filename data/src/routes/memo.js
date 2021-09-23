//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const paginator = require('../paginator');

// Router
let router = express.Router()

router.use('/memo', middlewares.requireAuthUser)

router.get('/memo/all', middlewares.guardRoute(['read_all_memo', 'read_memo']), async (req, res, next) => {
    try {
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = parseInt(lodash.get(req, 'query.customSort'))
        lodash.set(req, 'session.pagination.perPage', perPage)

        let query = {}
        let projection = {}

        // Pagination
        let totalDocs = await db.main.Memo.countDocuments(query)
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/memo/all',
            req.query
        )

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        // console.log(query, projection, options, sort)

        let memos = await db.main.Memo.find(query, projection, options).sort(sort).lean()

        res.render('memo/all.html', {
            flash: flash.get(req, 'memo'),
            memos: memos,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});

router.post('/memo', middlewares.guardRoute(['create_memo']), async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        lodash.set(patch, 'number', lodash.get(body, 'number'))
        lodash.set(patch, 'subject', lodash.get(body, 'subject'))
        lodash.set(patch, 'date', lodash.get(body, 'date'))
        lodash.set(patch, 'url', lodash.get(body, 'url'))

        let memo = await db.main.Memo.create(patch)

        flash.ok(req, 'memo', `Added ${memo.number}.`)
        res.redirect(`/memo/${memo._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/memo/:memoId', middlewares.guardRoute(['read_all_memo', 'read_memo']), middlewares.getMemo, async (req, res, next) => {
    try {
        let memo = res.memo.toObject()

        res.render('memo/read.html', {
            flash: flash.get(req, 'memo'),
            memo: memo,
        });
    } catch (err) {
        next(err);
    }
});


module.exports = router;