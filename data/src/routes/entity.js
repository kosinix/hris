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

router.use('/entity', middlewares.requireAuthUser)

router.get('/entity/all', middlewares.guardRoute(['read_all_entity', 'read_entity']), async (req, res, next) => {
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
        let totalDocs = await db.main.Entity.countDocuments(query)
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/entity/all',
            req.query
        )

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        // console.log(query, projection, options, sort)

        let entities = await db.main.Entity.find(query, projection, options).sort(sort).lean()

        let scanners = []
        entities.forEach((entity) => {
            scanners.push(db.main.Scanner.find({ entityId: entity._id })) // return array of scanners
        })
        scanners = await Promise.all(scanners)
        entities.forEach((entity, i) => {
            entity.scanners = scanners[i]
        })

        res.render('entity/all.html', {
            flash: flash.get(req, 'entity'),
            entities: entities,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/entity/create', middlewares.guardRoute(['create_entity']), async (req, res, next) => {
    try {

        res.render('entity/create.html', {
        });
    } catch (err) {
        next(err);
    }
});
router.post('/entity/create', middlewares.guardRoute(['create_entity']), async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        lodash.set(patch, 'name', lodash.get(body, 'name'))
        lodash.set(patch, 'type', lodash.get(body, 'type'))

        let entity = new db.main.Entity(patch)
        await entity.save()
        flash.ok(req, 'entity', `Added ${entity.name}.`)
        res.redirect(`/entity/${entity._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/entity/:entityId', middlewares.getEntity, async (req, res, next) => {
    try {
        let entity = res.entity.toObject()

        entity.scanners = await db.main.Scanner.find({ entityId: entity._id });

        res.render('entity/read.html', {
            flash: flash.get(req, 'entity'),
            entity: entity,
        });
    } catch (err) {
        next(err);
    }
});


module.exports = router;