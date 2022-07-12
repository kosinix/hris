//// Core modules
const fs = require('fs')
const util = require('util')

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const excelGen = require('../excel-gen');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const s3 = require('../aws-s3');

// Router
let router = express.Router()

router.use('/hdf', middlewares.requireAuthUser)

router.get('/hdf/all', middlewares.guardRoute(['read_all_hdf', 'read_hdf']), async (req, res, next) => {
    try {
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = undefined;//parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = lodash.get(req, 'query.customSort')
        let customFilter = lodash.get(req, 'query.customFilter')
        let customFilterValue = lodash.get(req, 'query.customFilterValue')
        lodash.set(req, 'session.pagination.perPage', perPage)

        
        let queryDate = lodash.get(req, 'query.date', moment().format('YYYY-MM-DD'))
        let momentNow = moment(queryDate)

        let query = {
            createdAt: {
                $gte: momentNow.startOf('day').toDate(),
                $lt: momentNow.endOf('day').toDate(),
            }
        }


        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        // console.log(query, options, sort)

        let aggr = []
        aggr.push({
            $lookup:
            {
                from: "employees",
                localField: "employeeId",
                foreignField: "_id",
                as: "employees"
            }
        })
        aggr.push({ $match: query })
        aggr.push({ $sort: sort })

        // Pagination
        let countDocuments = await req.app.locals.db.main.HealthDeclaration.aggregate(aggr)
        let totalDocs = countDocuments.length
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/hdf/all',
            req.query
        )

        if (!isNaN(perPage)) {
            aggr.push({ $skip: options.skip })
            aggr.push({ $limit: options.limit })
        }
        let healthDeclarations = await req.app.locals.db.main.HealthDeclaration.aggregate(aggr)
        healthDeclarations = healthDeclarations.map((o) => {
            let score = 0
            score += (parseFloat(o.data.tmp) > 37.5) ? 1 : 0 // temp
            score += (o.data.sym.length > 0) ? 1 : 0 // symptoms
            score += (o.data.vmf === 'Yes') ? 1 : 0 // visitedMedicalFacility
            score += (o.data.sus === 'Yes') ? 1 : 0 // suspectedCovidPatient
            score += (o.data.sfm === 'Yes') ? 1 : 0 // sickFamilyMembers
            o.score = Math.round(score / 5 * 100)
            o.employee = o.employees[0]
            delete o.employees
            return o
        })
        // console.log(util.inspect(aggr, false, null, true))

        // return res.send(healthDeclarations)
        if (req.query.csv == 1) {
            let workbook = await excelGen.templateHdf(healthDeclarations)
            let buffer = await workbook.xlsx.writeBuffer();
            res.set('Content-Disposition', `attachment; filename="hdf-${momentNow.format('YYYY-MM-DD')}.xlsx"`)
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            return res.send(buffer)
        }
        res.render('hdf/all.html', {
            flash: flash.get(req, 'hdf'),
            healthDeclarations: healthDeclarations,
            pagination: pagination,
            query: req.query,
            momentNow: momentNow,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/hdf/read/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/personal.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;