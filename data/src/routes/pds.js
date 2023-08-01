//// Core modules
const path = require('path')

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const momentRange = require('moment-range')
const momentExt = momentRange.extendMoment(moment)
const qr = require('qr-image')
const sharp = require('sharp')

//// Modules
const address = require('../address');
const countries = require('../countries');
const dtrHelper = require('../dtr-helper');
const excelGen = require('../excel-gen');
const middlewares = require('../middlewares');
const passwordMan = require('../password-man');
const paginator = require('../paginator');
const suffixes = require('../suffixes');
const s3 = require('../aws-s3');
const { AppError } = require('../errors');
const uploader = require('../uploader');
const workScheduler = require('../work-scheduler');

// Router
let router = express.Router()

router.use('/e/pds', middlewares.requireAuthUser)


router.use('/e/pds', async (req, res, next) => {
    res.locals.title = "Personal Data Sheet"
    next()
})

router.get('/e/pds/personal-info', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e/pds/personal-info.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Personal Information`,
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        })
    } catch (err) {
        next(err);
    }
});

router.get('/e/pds/family-background', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e/pds/family-background.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Family Background`,
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        })
    } catch (err) {
        next(err);
    }
});
router.post('/e/pds/family-background/children', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = res.employee.toObject()
        let body = lodash.get(req, 'body')
        // return res.send(body)

        lodash.set(patch, 'personal.children', lodash.get(body, 'children', []))

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.children': patch.personal.children
            }
        })

        res.send(patch.personal.children)
    } catch (err) {
        next(err);
    }
});
router.post('/e/pds/family-background/spouse', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = lodash.get(req, 'body.spouse')

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.spouse': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});
router.post('/e/pds/family-background/father', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = lodash.get(req, 'body.father')

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.father': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});
router.post('/e/pds/family-background/mother', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = lodash.get(req, 'body.mother')

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.mother': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});

router.get('/e/pds/educational-background', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e/pds/educational-background.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Educational Background`,
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        })
    } catch (err) {
        next(err);
    }
});
router.post('/e/pds/educational-background', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = res.employee.toObject()
        let body = lodash.get(req, 'body')
        // return res.send(body)

        lodash.set(patch, 'personal.schools', lodash.get(body, 'schools', []))
        patch.personal.schools = patch.personal.schools.sort((a, b) => {
            try {
                let aFrom = parseInt(a.periodFrom)
                let bFrom = parseInt(b.periodFrom)
                if (aFrom > bFrom) {
                    return 1;
                }
                if (aFrom < bFrom) {
                    return -1;
                }
                return 0;
            } catch (err) {
                return 0
            }
        })

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

        res.send(patch.personal.schools)
    } catch (err) {
        next(err);
    }
});

router.get('/e/pds/csc-eligibility', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e/pds/csc-eligibility.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - CSC Eligibility`,
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e/pds/csc-eligibility', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = res.employee.toObject()
        let body = lodash.get(req, 'body')
        // return res.send(body)

        lodash.set(patch, 'personal.eligibilities', lodash.get(body, 'eligibilities', []))

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

        res.send(patch.personal.eligibilities)
    } catch (err) {
        next(err);
    }
});

router.get('/e/pds/work-experience', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e/pds/work-experience.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Work Experience`,
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e/pds/work-experience', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = res.employee.toObject()
        let body = lodash.get(req, 'body')
        // return res.send(body)

        lodash.set(patch, 'personal.workExperiences', lodash.get(body, 'workExperiences', []))
        patch.personal.workExperiences = patch.personal.workExperiences.sort((a, b) => {
            let aFrom = moment(a.fromDate).unix()
            let bFrom = moment(b.fromDate).unix()
            if (aFrom < bFrom) {
                return 1;
            }
            if (aFrom > bFrom) {
                return -1;
            }
            return 0;
        })
        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)


        res.send(patch.personal.workExperiences)
    } catch (err) {
        next(err);
    }
});

module.exports = router;