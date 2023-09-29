//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const middlewares = require('../middlewares')
const S3_CLIENT = require('../aws-s3-client')  // V3 SDK

// Router
let router = express.Router()

router.use('/memo', middlewares.requireAuthUser)

router.get('/memo/all', middlewares.guardRoute(['read_all_memo', 'read_memo']), async (req, res, next) => {
    try {
        const lastId = req.query?.lastId
        let criteria = {}
        if (lastId) {
            criteria = {
                _id: {
                    $lt: req.app.locals.db.mongoose.Types.ObjectId(lastId)
                }
            }
        }

        const memos = await req.app.locals.db.main.Memo.aggregate([
            {
                $sort: {
                    date: -1,
                    _id: -1,
                }
            },
            {
                $match: criteria
            },
            {
                $limit: 10
            },
        ])

        res.render('memo/all.html', {
            flash: flash.get(req, 'memo'),
            memos: memos,
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
router.post('/memo/create', middlewares.guardRoute(['create_memo']), middlewares.dataUrlToReqFiles(['url']), middlewares.handleUpload({ allowedMimes: ["application/pdf"] }), async (req, res, next) => {
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
                memberIds = memberIds.split(',').map(id => new req.app.locals.db.mongoose.Types.ObjectId(id))
                for (let x = 0; x < memberIds.length; x++) {
                    let memberId = memberIds[x]
                    let objectId = null
                    let name = ''
                    let type = ''

                    let employment = await req.app.locals.db.main.Employment.findById(memberId)
                    if (employment) {
                        objectId = employment._id
                        type = 'employment'
                        let employee = await req.app.locals.db.main.Employee.findById(employment.employeeId)
                        if (employee) {
                            name = `${employee.firstName} ${employee.lastName} - ${employment.position}`
                        }
                    } else {
                        let employeeList = await req.app.locals.db.main.EmployeeList.findById(memberId)
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
        patch.url = lodash.get(req, 'saveList.url[0]')

        // return res.send(patch)

        let memo = await req.app.locals.db.main.Memo.create(patch)

        flash.ok(req, 'memo', `Added memo no. ${memo.number} series of ${moment(patch.date).format('YYYY')}.`)
        res.redirect(`/memo/${memo._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/memo/:memoId', middlewares.guardRoute(['read_all_memo', 'read_memo']), middlewares.getMemo, async (req, res, next) => {
    try {
        let memo = res.memo.toObject()
        let url = memo.url

        if (!memo.url.includes('https://drive.google.com')) {
            url = await S3_CLIENT.getSignedUrl(CONFIG.aws.bucket1.name, CONFIG.aws.bucket1.prefix + '/' + memo.url);
        }

        res.render('memo/read.html', {
            flash: flash.get(req, 'memo'),
            memo: memo,
            url: url
        });
    } catch (err) {
        next(err);
    }
});
router.get('/memo/:memoId/delete', middlewares.guardRoute(['read_memo', 'delete_memo']), middlewares.getMemo, async (req, res, next) => {
    try {
        let memo = res.memo

        // Delete files on AWS S3
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'
        let url = memo.url
        if (url) {
            let objects = [
                { Key: `${bucketKeyPrefix}${url}` },
            ]
            await S3_CLIENT.deleteObjects(bucketName, objects)
        }

        await memo.remove()
        flash.ok(req, 'memo', 'Memo removed.')
        res.redirect(`/memo/all`)
    } catch (err) {
        next(err);
    }
});

router.get('/e/memo', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        const lastId = req.query?.lastId
        let criteria = {}
        if (lastId) {
            criteria = {
                _id: {
                    $lt: req.app.locals.db.mongoose.Types.ObjectId(lastId)
                }
            }
        }

        const memos = await req.app.locals.db.main.Memo.aggregate([
            {
                $sort: {
                    date: -1,
                    _id: -1,
                }
            },
            {
                $match: criteria
            },
            {
                $limit: 10
            },
        ])

        res.render('e/memo/all.html', {
            flash: flash.get(req, 'memo'),
            memos: memos,
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/e/memo/:memoId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getMemo, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let memo = res.memo.toObject()

        let url = memo.url

        if (!memo.url.includes('https://drive.google.com')) {
            url = await S3_CLIENT.getSignedUrl(CONFIG.aws.bucket1.name, CONFIG.aws.bucket1.prefix + '/' + memo.url);
        }

        res.render('e/memo/read.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            memo: memo,
            url: url,
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;