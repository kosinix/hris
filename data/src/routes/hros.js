//// Core modules

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const momentRange = require('moment-range')
const momentExt = momentRange.extendMoment(moment)
const qr = require('qr-image')

//// Modules
const db = require('../db');
const dtrHelper = require('../dtr-helper');
const excelGen = require('../excel-gen');
const middlewares = require('../middlewares');
const nunjucksEnv = require('../nunjucks-env');
const paginator = require('../paginator');
const suffixes = require('../suffixes');
const s3 = require('../aws-s3');
const { AppError } = require('../errors');
const uploader = require('../uploader');
const workScheduler = require('../work-scheduler');

// Router
let router = express.Router()

router.use('/hros', middlewares.requireAuthUser)

router.get('/hros/home', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let data = {
            title: 'Human Resource Online Services (HROS)',
            flash: flash.get(req, 'hros'),
            employee: employee,
            momentNow: moment(),
        }
        res.render('hros/home.html', data);

    } catch (err) {
        next(err);
    }
});

// Authority to Travel
router.get('/hros/at/all', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = lodash.get(req, 'query.customSort')
        let customFilter = lodash.get(req, 'query.customFilter')
        let customFilterValue = lodash.get(req, 'query.customFilterValue')
        lodash.set(req, 'session.pagination.perPage', perPage)

        let query = {
            employeeId: employee._id
        }
        let projection = {}

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        // console.log(query, projection, options, sort)

        let aggr = []

        aggr.push({
            $lookup:
            {
                localField: "_id",
                foreignField: "employeeId",
                from: "employees",
                as: "employees"
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
            '/hros/at/all',
            req.query
        )

        if (!isNaN(perPage)) {
            aggr.push({ $skip: options.skip })
            aggr.push({ $limit: options.limit })
        }
        let ats = await db.main.AuthorityToTravel.aggregate(aggr)

        let data = {
            title: 'Human Resource Online Services (HROS) - Authority to Travel',
            employee: employee,
            flash: flash.get(req, 'hros'),
            ats: ats,
            pagination: pagination,
            momentNow: moment(),
        }
        res.render('hros/authority-to-travel/all.html', data);

    } catch (err) {
        next(err);
    }
});
router.get('/hros/at/create', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employments = employee.employments

        let data = {
            title: 'Human Resource Online Services (HROS) - Authority to Travel',
            flash: flash.get(req, 'hros'),
            employee: employee,
            employments: employments,
            employmentId: employments[0]._id,
            momentNow: moment(),
        }
        res.render('hros/authority-to-travel/create.html', data);

    } catch (err) {
        next(err);
    }
});
router.post('/hros/at/create', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let user = res.user.toObject()
        let body = req.body



        // return res.send(body)
        if (moment(body.periodOfTravelEnd).isBefore(moment(body.periodOfTravel))) {
            flash.error(req, 'hros', 'Invalid period of travel. Please check your "To" and "From" dates.')
            return res.redirect('/hros/at/create')
        }
        if (lodash.toString(body.natureOfBusiness).length > 180) {
            flash.error(req, 'hros', 'Nature Of Business must not exceed 180 characters.')
            return res.redirect('/hros/at/create')
        }
        let employmentId = lodash.get(body, 'employmentId')
        let employment = await db.main.Employment.findById(employmentId).lean()
        if (!employment) {
            flash.error(req, 'hros', 'Employment not found.')
            return res.redirect('/hros/at/create')
        }

        let ats = await db.main.AuthorityToTravel.find({
            employeeId: employee._id,
            employmentId: employment._id,
            $or: [
                {
                    periodOfTravel: {
                        $gte: moment(body.periodOfTravel).toDate(),
                        $lte: moment(body.periodOfTravelEnd).toDate(),
                    },
                },
                {
                    periodOfTravelEnd: {
                        $gte: moment(body.periodOfTravel).toDate(),
                        $lte: moment(body.periodOfTravelEnd).toDate(),
                    }
                }
            ]

        })
        if (ats.length > 0) {
            flash.error(req, 'hros', 'Cannot create Authority to Travel on the provided period. There is an overlap with another Authority to Travel.')
            return res.redirect('/hros/at/create')
        }


        let at = await db.main.AuthorityToTravel.create({
            employeeId: employee._id,
            employmentId: employment._id,
            status: 1,
            periodOfTravel: moment(body.periodOfTravel).toDate(),
            periodOfTravelEnd: moment(body.periodOfTravelEnd).toDate(),
            controlNumber: '',
            data: {
                designation: body.designation,
                officialStation: body.officialStation,
                destination: body.destination,
                natureOfBusiness: body.natureOfBusiness,
                endorser: body.endorser,
                endorserDesignation: body.endorserDesignation,
                approver: body.approver,
                approverDesignation: body.approverDesignation,
            }
        })

        if (lodash.get(body, 'autoset', false)) {
            let a = body.periodOfTravel
            let b = body.periodOfTravelEnd
            // If you want an inclusive end date (fully-closed interval)
            for (var m = moment(a); m.diff(b, 'days') <= 0; m.add(1, 'days')) {
                // console.log(m.format('YYYY-MM-DD'));
                let attendance = {
                    employeeId: employee._id,
                    employmentId: employment._id,
                    type: 'travel',
                    workScheduleId: employment.workScheduleId,
                    createdAt: m.toDate(),
                    logs: [],
                    changes: [],
                    comments: [],
                }
                attendance.changes.push({
                    summary: `${user.username} inserted a new attendance.`,
                    objectId: user._id,
                    createdAt: m.toDate()
                })
                await db.main.Attendance.create(attendance)
            }
        }

        let autoApprove = true
        if (autoApprove) {
            let ats = await db.main.AuthorityToTravel.find({
                periodOfTravel: {
                    $gte: moment().startOf('month').toDate(),
                },
                periodOfTravelEnd: {
                    $lte: moment().endOf('month').toDate(),
                }
            })

            let counter = new String(ats.length)

            at.controlNumber = moment().format('YY-MM-') + counter.padStart(3, '0') + ' (Online)'
            at.status = 2
            await at.save()
            let message = `Authority to Travel submitted. `
            if (lodash.get(body, 'autoset', false)) {
                message += `1.) Please print your Authority to Travel and have it signed. `
                message += `2.) Attached it when submitting your DTR. `
            } else {
                message += `1.) Please dont forget to set your attendance to "Travel" on the day(s) of your travel. `
                message += `2.) Please print your Authority to Travel and have it signed. `
                message += `3.) Attached it when submitting your DTR. `
            }
            flash.ok(req, 'hros', message)
            return res.redirect(`/hros/at/all`)
        }
        flash.ok(req, 'hros', 'Authority to Travel submitted. Please wait for HR approval. Refresh this page later to check.')
        res.redirect(`/hros/at/all`)

    } catch (err) {
        next(err);
    }
});
router.get('/hros/at/:authorityToTravelId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let at = await db.main.AuthorityToTravel.findById(req.params.authorityToTravelId)
        if (!at) {
            throw new Error('Authority To Travel not found.')
        }


        let words = at.data.natureOfBusiness.replace(/\s\s+/g, ' ').split(' ')
        if (words.length > 32) {
            at.data.natureOfBusiness1 = words.splice(0, 32).join(' ')
            at.data.natureOfBusiness2 = words.splice(0, 25).join(' ')

        } else {
            at.data.natureOfBusiness1 = words.join(' ')
            at.data.natureOfBusiness2 = ''

        }

        let data = {
            title: `Authority to Travel - ${employee.firstName} ${employee.lastName} - ${at.controlNumber}`,
            employee: employee,
            at: at,
            momentNow: moment(),
        }
        res.render('hros/authority-to-travel/read.html', data);

    } catch (err) {
        next(err);
    }
});
router.get('/hros/at/:authorityToTravelId/print', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let at = await db.main.AuthorityToTravel.findById(req.params.authorityToTravelId)
        if (!at) {
            throw new Error('Authority To Travel not found.')
        }


        let words = at.data.natureOfBusiness.replace(/\s\s+/g, ' ').split(' ')
        if (words.length > 18) {
            at.data.natureOfBusiness1 = words.splice(0, 18).join(' ')
            at.data.natureOfBusiness2 = words.splice(0, 18).join(' ')

        } else {
            at.data.natureOfBusiness1 = words.join(' ')
            at.data.natureOfBusiness2 = ''

        }

        let data = {
            title: `Authority to Travel - ${employee.firstName} ${employee.lastName} - ${at.controlNumber}`,
            employee: employee,
            at: at,
            momentNow: moment(),
        }
        res.render('hros/authority-to-travel/authority-to-travel.html', data);

    } catch (err) {
        next(err);
    }
});
router.get('/hros/at/:authorityToTravelId/delete', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let at = await db.main.AuthorityToTravel.findById(req.params.authorityToTravelId)
        if (!at) {
            throw new Error('Authority To Travel not found.')
        }
        if (at.status === 2) {
            throw new Error('Cannot cancel Authority To Travel as it is already approved. Please have it corrected by the HRMO.')
        }

        await at.remove()
        flash.ok(req, 'hros', 'Application for Authority to Travel cancelled.')
        res.redirect(`/hros/at/all`)

    } catch (err) {
        next(err);
    }
});


// Cert of appearance
router.get('/hros/coa', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('hros/certificate-of-appearance/certificate-of-appearance.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});


module.exports = router;