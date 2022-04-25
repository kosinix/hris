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

router.use('/memo', middlewares.requireAuthUser)

router.get('/memo/all', middlewares.guardRoute(['read_all_memo', 'read_memo']), async (req, res, next) => {
    try {
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', 'date')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', -1))
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

router.get('/memo/create', middlewares.guardRoute(['create_memo']), async (req, res, next) => {
    try {
        res.render('memo/create.html', {
            flash: flash.get(req, 'memo'),
        });
    } catch (err) {
        next(err);
    }
});
router.post('/memo/create', middlewares.guardRoute(['create_memo']), async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        // return res.send(req.body)
        lodash.set(patch, 'number', lodash.get(body, 'number'))
        lodash.set(patch, 'subject', lodash.get(body, 'subject'))
        lodash.set(patch, 'date', lodash.get(body, 'date'))
        lodash.set(patch, 'url', lodash.get(body, 'url'))
        lodash.set(patch, 'visibility', lodash.get(body, 'visibility'))
        let memberIds = lodash.get(body, 'memberIds')

        let members = []
        if (patch.visibility === 'members') {
            if (!memberIds) {
                let err = new Error('No members selected.')
                flash.error(req, 'memo', err.message)
                err.type = 'flash'
                err.redirect = '/memo/create'
                throw err
            } else {
                memberIds = memberIds.split(',').map(id => new db.mongoose.Types.ObjectId(id))
                for (let x = 0; x < memberIds.length; x++) {
                    let memberId = memberIds[x]
                    let objectId = null
                    let name = ''
                    let type = ''

                    let employment = await db.main.Employment.findById(memberId)
                    if (employment) {
                        objectId = employment._id
                        type = 'employment'
                        let employee = await db.main.Employee.findById(employment.employeeId)
                        if (employee) {
                            name = `${employee.firstName} ${employee.lastName} - ${employment.position}`
                        }
                    } else {
                        let employeeList = await db.main.EmployeeList.findById(memberId)
                        if (employeeList) {
                            objectId = employeeList._id
                            name = `${employeeList.name} - ${employeeList.tags.join(',')}`
                            type = 'list'
                        }
                    }
                    if (objectId && name && type) {
                        members.push({
                            objectId: objectId,
                            name: name,
                            type: type,
                        })
                    }

                }
            }
        }

        patch.members = members

        // return res.send(patch)

        let memo = await db.main.Memo.create(patch)

        flash.ok(req, 'memo', `Added memo no. ${memo.number} series of ${moment(patch.date).format('YYYY')}.`)
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
router.get('/memo/:memoId/delete', middlewares.guardRoute(['read_memo', 'delete_memo']), middlewares.getMemo, async (req, res, next) => {
    try {
        let memo = res.memo

        await memo.remove()
        flash.ok(req, 'memo', 'Memo removed.')
        res.redirect(`/memo/all`)
    } catch (err) {
        next(err);
    }
});

router.get('/memo/:memoId/edit', middlewares.guardRoute(['update_memo']), middlewares.getMemo, async (req, res, next) => {
    try {
        let memo = res.memo.toObject()
        res.render('memo/update.html', {
            flash: flash.get(req, 'memo'),
            memo: memo,
            members: memo.members
        });
    } catch (err) {
        next(err);
    }
});
router.post('/memo/:memoId/edit', middlewares.guardRoute(['update_memo']), middlewares.getMemo, async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        // return res.send(req.body)
        lodash.set(patch, 'number', lodash.get(body, 'number'))
        lodash.set(patch, 'subject', lodash.get(body, 'subject'))
        lodash.set(patch, 'date', lodash.get(body, 'date'))
        lodash.set(patch, 'url', lodash.get(body, 'url'))
        lodash.set(patch, 'visibility', lodash.get(body, 'visibility'))
        let memberIds = lodash.get(body, 'memberIds')

        let members = []
        if (patch.visibility === 'members') {
            if (!memberIds) {
                let err = new Error('No members selected.')
                flash.error(req, 'memo', err.message)
                err.type = 'flash'
                err.redirect = '/memo/create'
                throw err
            } else {
                memberIds = memberIds.split(',').map(id => new db.mongoose.Types.ObjectId(id))
                for (let x = 0; x < memberIds.length; x++) {
                    let memberId = memberIds[x]
                    let objectId = null
                    let name = ''
                    let type = ''

                    let employment = await db.main.Employment.findById(memberId)
                    if (employment) {
                        objectId = employment._id
                        type = 'employment'
                        let employee = await db.main.Employee.findById(employment.employeeId)
                        if (employee) {
                            name = `${employee.firstName} ${employee.lastName} - ${employment.position}`
                        }
                    } else {
                        let employeeList = await db.main.EmployeeList.findById(memberId)
                        if (employeeList) {
                            objectId = employeeList._id
                            name = `${employeeList.name} - ${employeeList.tags.join(',')}`
                            type = 'list'
                        }
                    }
                    if (objectId && name && type) {
                        members.push({
                            objectId: objectId,
                            name: name,
                            type: type,
                        })
                    }

                }
            }
        }

        patch.members = members

        // return res.send(patch)

        let memo = res.memo
        
        await db.main.Memo.updateOne({ _id: memo._id }, patch)

        flash.ok(req, 'memo', `Updated memo no. ${memo.number} series of ${moment(patch.date).format('YYYY')}.`)
        res.redirect(`/memo/${memo._id}`)
    } catch (err) {
        next(err);
    }
});

module.exports = router;