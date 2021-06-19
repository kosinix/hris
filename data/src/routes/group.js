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

router.use('/group', middlewares.requireAuthUser)

router.get('/group/all', middlewares.guardRoute(['read_all_group', 'read_group']), async (req, res, next) => {
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
        let totalDocs = await db.main.Group.countDocuments(query)
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/group/all',
            req.query
        )

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        // console.log(query, projection, options, sort)

        let groups = await db.main.Group.find(query, projection, options).sort(sort).lean()

        let parents = []
        groups.forEach((group) => {
            parents.push(db.main.Group.findById(group.parentId))
        })
        parents = await Promise.all(parents)
        groups.forEach((group, i) => {
            group.parent = parents[i]
        })

        res.render('group/all.html', {
            flash: flash.get(req, 'group'),
            groups: groups,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/group/create', middlewares.guardRoute(['create_group']), async (req, res, next) => {
    try {

        let parents = await db.main.Group.find({

        })
        parents = parents.map((o) => {
            return {
                value: o._id,
                text: o.name
            }
        })

        parents.unshift({ value: '', text: '' })
        res.render('group/create.html', {
            flash: flash.get(req, 'group'),
            parents: parents
        });
    } catch (err) {
        next(err);
    }
});
router.post('/group/create', middlewares.guardRoute(['create_group']), async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        lodash.set(patch, 'name', lodash.get(body, 'name'))
        lodash.set(patch, 'description', lodash.get(body, 'description'))

        if (lodash.get(body, 'parentId')) {
            lodash.set(patch, 'parentId', lodash.get(body, 'parentId'))
        }

        let group = new db.main.Group(patch)
        await group.save()
        flash.ok(req, 'group', `Added ${group.name}.`)
        res.redirect(`/group/${group._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/group/:groupId', middlewares.getGroup, async (req, res, next) => {
    try {
        let group = res.group.toObject()

        let subgroups = await db.main.Group.find({
            parentId: group._id
        })

        let parents = []
        subgroups.forEach((group) => {
            parents.push(db.main.Group.findById(group.parentId))
        })
        parents = await Promise.all(parents)
        subgroups.forEach((group, i) => {
            group.parent = parents[i]
        })

        res.render('group/read.html', {
            flash: flash.get(req, 'group'),
            group: group,
            subgroups: subgroups,
        });
    } catch (err) {
        next(err);
    }
});


module.exports = router;