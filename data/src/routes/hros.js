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

        let data = {
            title: 'Human Resource Online Services (HROS) - Authority to Travel',
            flash: flash.get(req, 'hros'),
            employee: employee,
            at: {
                controlNumber: moment().format('YY-MM-') + '123'
            },
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
        let body = req.body

        if (moment(body.periodOfTravelEnd).isBefore(moment(body.periodOfTravel))) {
            flash.error(req, 'hros', 'Invalid period of travel. Please check your "To" and "From" dates.')
            return res.redirect('/hros/at/create')
        }
        if (lodash.toString(body.natureOfBusiness).length > 300) {
            flash.error(req, 'hros', 'Nature Of Business must not exceed 300 characters.')
            return res.redirect('/hros/at/create')
        }

        let ats = await db.main.AuthorityToTravel.find({
            employeeId: employee._id,
            periodOfTravel: {
                $gte: body.periodOfTravel,
            },
            periodOfTravelEnd: {
                $lte: body.periodOfTravelEnd,
            }
        })
        if (ats.length > 0) {
            flash.error(req, 'hros', 'Cannot create Authority to Travel on the provided period. There is an overlap with another Authority to Travel.')
            return res.redirect('/hros/at/create')
        }


        let at = await db.main.AuthorityToTravel.create({
            employeeId: employee._id,
            status: 1,
            periodOfTravel: body.periodOfTravel,
            periodOfTravelEnd: body.periodOfTravelEnd,
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
            flash.ok(req, 'hros', 'Authority to Travel submitted. Please dont forget to set your attendance to "Travel" on the said date(s). Please print your Authority to Travel and have it signed.')
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

router.get('/hros/at.docx', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let data = {
            title: 'Human Resource Online Services (HROS) - Authority to Travel',
            employee: employee,
            at: {
                controlNumber: moment().format('YY-MM-') + '123'
            },
            momentNow: moment(),
        }
        res.render('hros/authority-to-travel.html', data);

    } catch (err) {
        next(err);
    }
});



router.get('/hros/coax', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment

        res.render('hros/dtr-edit.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            employment: employment,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/hros/coa', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, fileUpload(), middlewares.handleExpressUploadMagic, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentId = res.employmentId
        let employment = res.employment
        let attendanceId = lodash.get(req, 'params.attendanceId')

        // Get pending
        let attendanceReview = await db.main.AttendanceReview.findOne({
            attendanceId: attendanceId,
            status: 'pending'
        }).lean()

        if (attendanceReview) {
            throw new Error('Attendance correction application for this date is still under review.')
        }

        // Get attendance
        let attendance = await db.main.Attendance.findOne({
            _id: attendanceId,
            employmentId: employmentId,
        }).lean()

        if (!attendance) {
            throw new Error('Attendance not found.')
        }

        let saveList = lodash.get(req, 'saveList')
        let attachments = lodash.get(saveList, 'photo')
        let body = lodash.get(req, 'body')


        // ORIG
        let orig = JSON.parse(JSON.stringify(attendance))
        delete orig._id

        // PATCH
        let patch = JSON.parse(JSON.stringify(attendance))
        delete patch._id

        patch.attendanceId = attendance._id.toString()
        patch.attachments = attachments
        patch.type = body.type
        patch.correctionReason = body.correctionReason
        patch.logsheetNumber = body.logsheetNumber
        patch.workScheduleId = body.workScheduleId
        patch.status = 'pending'

        let getMode = (x) => {
            let mode = 1
            if (x === 0) {
                mode = 1
            } else if (x === 1) {
                mode = 0
            } else if (x === 2) {
                mode = 1
            } else if (x === 3) {
                mode = 0
            }
            return mode
        }

        // Merge 4 logs
        for (let x = 0; x < 4; x++) {
            let origLog = lodash.get(orig, `logs[${x}]`)
            let patchLog = lodash.get(body, `log${x}`)
            let newLog = origLog
            let momentLog = moment(patchLog, 'HH:mm', true) // Turn to moment or null if fails
            if (momentLog.isValid()) {

                let dateTime = moment(attendance.createdAt).hours(momentLog.hours()).minutes(momentLog.minutes()).toDate()
                let mode = getMode(x)
                if (origLog) {
                    newLog.dateTime = dateTime
                    newLog.mode = mode
                } else { // undefined
                    newLog = {
                        _id: db.mongoose.Types.ObjectId(),
                        scannerId: null,
                        dateTime: dateTime,
                        mode: mode,
                        type: 'online',

                    }
                }

            }

            patch.logs[x] = newLog
        }
        // Remove undefined
        patch.logs = patch.logs.filter(o => o !== undefined)
        patch = JSON.parse(JSON.stringify(patch))

        // return res.send(patch)
        let merged = lodash.merge(orig, patch)
        let review = await db.main.AttendanceReview.create(merged)

        // return res.send({
        //     orig: JSON.parse(JSON.stringify(attendance)),
        //     patch: patch,
        //     merged: merged,
        //     review: review,
        // })

        flash.ok(req, 'employee', 'Application submitted.')
        res.redirect(`/e-profile/dtr/${employmentId}`)
    } catch (err) {
        next(err);
    }
});

module.exports = router;