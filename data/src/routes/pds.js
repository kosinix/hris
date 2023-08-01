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
router.post('/e/pds/personal-info', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        if(!res.user?.settings?.editPds){
            throw new Error('PDS editing locked.')
        }
        let employee = res.employee.toObject()
        let patch = res.employee.toObject()
        let body = lodash.get(req, 'body')
        // return res.send(body)

        lodash.set(patch, 'lastName', lodash.get(body, 'lastName'))
        lodash.set(patch, 'firstName', lodash.get(body, 'firstName'))
        lodash.set(patch, 'middleName', lodash.get(body, 'middleName'))
        lodash.set(patch, 'suffix', lodash.get(body, 'suffix'))
        lodash.set(patch, 'birthDate', lodash.get(body, 'birthDate'))
        lodash.set(patch, 'gender', lodash.get(body, 'gender'))
        lodash.set(patch, 'civilStatus', lodash.get(body, 'civilStatus'))
        lodash.set(patch, 'mobileNumber', lodash.get(body, 'mobileNumber'))
        lodash.set(patch, 'phoneNumber', lodash.get(body, 'phoneNumber'))
        lodash.set(patch, 'email', lodash.get(body, 'email'))

        patch.history = employee.history
        if (patch.gender !== employee.gender) {
            patch.history.push({
                comment: `Changed gender from ${employee.gender} to ${patch.gender}.`,
                createdAt: moment().toDate()
            })
        }

        // TODO: Should generate new id every save??
        lodash.set(patch, 'addresses.0._id', req.app.locals.db.mongoose.Types.ObjectId())
        lodash.set(patch, 'addresses.0.unit', lodash.get(body, 'unit0'))
        lodash.set(patch, 'addresses.0.street', lodash.get(body, 'street0'))
        lodash.set(patch, 'addresses.0.village', lodash.get(body, 'village0'))
        lodash.set(patch, 'addresses.0.psgc', lodash.get(body, 'psgc0'))
        lodash.set(patch, 'addresses.0.zipCode', lodash.get(body, 'zipCode0'))
        lodash.set(patch, 'addressPermanent', lodash.get(patch, 'addresses.0._id'))
        let address0 = await req.app.locals.db.main.Address.findOne({
            code: lodash.get(body, 'psgc0', '')
        })
        if (address0) {
            let full = address.build(
                lodash.get(patch, 'addresses.0.unit'),
                lodash.get(patch, 'addresses.0.street'),
                lodash.get(patch, 'addresses.0.village'),
                lodash.get(address0, 'full'),
            )

            lodash.set(patch, 'address', full)
            lodash.set(patch, 'addresses.0.full', lodash.get(address0, 'full'))
            lodash.set(patch, 'addresses.0.brgy', address0.name)
            lodash.set(patch, 'addresses.0.cityMun', address0.cityMunName)
            lodash.set(patch, 'addresses.0.province', address0.provName)
        }

        // TODO: Should generate new id every save??
        lodash.set(patch, 'addresses.1._id', req.app.locals.db.mongoose.Types.ObjectId())
        lodash.set(patch, 'addresses.1.unit', lodash.get(body, 'unit1'))
        lodash.set(patch, 'addresses.1.street', lodash.get(body, 'street1'))
        lodash.set(patch, 'addresses.1.village', lodash.get(body, 'village1'))
        lodash.set(patch, 'addresses.1.psgc', lodash.get(body, 'psgc1'))
        lodash.set(patch, 'addresses.1.zipCode', lodash.get(body, 'zipCode1'))
        lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.1._id'))
        let address1 = await req.app.locals.db.main.Address.findOne({
            code: lodash.get(body, 'psgc1', '')
        })
        if (address1) {
            let full = address.build(
                lodash.get(patch, 'addresses.1.unit'),
                lodash.get(patch, 'addresses.1.street'),
                lodash.get(patch, 'addresses.1.village'),
                lodash.get(address1, 'full'),
            )
            lodash.set(patch, 'address', full)
            lodash.set(patch, 'addresses.1.full', lodash.get(address1, 'full'))
            lodash.set(patch, 'addresses.1.brgy', address1.name)
            lodash.set(patch, 'addresses.1.cityMun', address1.cityMunName)
            lodash.set(patch, 'addresses.1.province', address1.provName)
        }

        lodash.set(patch, 'personal.birthPlace', lodash.get(body, 'birthPlace'))
        lodash.set(patch, 'personal.height', lodash.get(body, 'height'))
        lodash.set(patch, 'personal.weight', lodash.get(body, 'weight'))
        lodash.set(patch, 'personal.bloodType', lodash.get(body, 'bloodType'))
        lodash.set(patch, 'personal.gsis', lodash.get(body, 'gsis'))
        lodash.set(patch, 'personal.sss', lodash.get(body, 'sss'))
        lodash.set(patch, 'personal.philHealth', lodash.get(body, 'philHealth'))
        lodash.set(patch, 'personal.tin', lodash.get(body, 'tin'))
        lodash.set(patch, 'personal.pagibig', lodash.get(body, 'pagibig'))
        lodash.set(patch, 'personal.agencyEmployeeNumber', lodash.get(body, 'agencyEmployeeNumber'))
        lodash.set(patch, 'personal.citizenship', lodash.get(body, 'citizenship', []))
        lodash.set(patch, 'personal.citizenshipCountry', lodash.get(body, 'citizenshipCountry', ''))
        lodash.set(patch, 'personal.citizenshipSource', lodash.get(body, 'citizenshipSource', []))

        
        
        // return res.send(patch)
        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

        flash.ok(req, 'employee', `PDS updated.`)
        // if (lodash.get(body, 'actionType') === 'saveNext') {
        //     return res.redirect(`/e-profile/pds2`)
        // }
        res.redirect(`/e/pds/personal-info`)
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
        if(!res.user?.settings?.editPds){
            throw new Error('PDS editing locked.')
        }
        
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
        let patch = lodash.get(req, 'body.schools', [])

        patch = patch.sort((a, b) => {
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

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.schools': patch
            }
        })

        res.send(patch)
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
        let patch = lodash.get(req, 'body.eligibilities', [])
        
        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.eligibilities': patch
            }
        })

        res.send(patch)
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
        let patch = lodash.get(req, 'body.workExperiences', [])

        patch = patch.sort((a, b) => {
            try {
                let aFrom = moment(a.fromDate).unix()
                let bFrom = moment(b.fromDate).unix()
                if (aFrom < bFrom) {
                    return 1;
                }
                if (aFrom > bFrom) {
                    return -1;
                }
                return 0;
            } catch (err) {
                return 0
            }
        })

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.workExperiences': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});

router.get('/e/pds/voluntary-work', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e/pds/voluntary-work.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Voluntary Work`,
            employee: employee,
            momentNow: moment(),
        })
    } catch (err) {
        next(err);
    }
});
router.post('/e/pds/voluntary-work', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = lodash.get(req, 'body.voluntaryWorks')

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.voluntaryWorks': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});

router.get('/e/pds/learning-development', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e/pds/learning-development.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Learning and Development`,
            employee: employee,
            momentNow: moment(),
        })
    } catch (err) {
        next(err);
    }
});
router.post('/e/pds/learning-development', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = lodash.get(req, 'body.trainings', [])

        patch = patch.sort((a, b) => {
            try {
                let aFrom = moment(a.fromDate).unix()
                let bFrom = moment(b.fromDate).unix()
                if (aFrom < bFrom) {
                    return 1;
                }
                if (aFrom > bFrom) {
                    return -1;
                }
                return 0;
            } catch (err) {
                return 0
            }
        })

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.trainings': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});

router.get('/e/pds/other-info', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e/pds/other-info.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Other Info`,
            employee: employee,
            momentNow: moment(),
        })
    } catch (err) {
        next(err);
    }
});
router.post('/e/pds/other-info', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = lodash.get(req, 'body.extraCurriculars', [])

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.extraCurriculars': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});

router.get('/e/pds/more-info', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e/pds/more-info.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Other Info`,
            employee: employee,
            momentNow: moment(),
        })
    } catch (err) {
        next(err);
    }
});
router.post('/e/pds/more-info', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.lockPds, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = res.employee.toObject()
        let body = lodash.get(req, 'body')
        // return res.send(body)

        lodash.set(patch, 'personal.relatedThirdDegree', lodash.get(body, 'relatedThirdDegree'))
        lodash.set(patch, 'personal.relatedFourthDegree', lodash.get(body, 'relatedFourthDegree'))
        lodash.set(patch, 'personal.relatedFourthDegreeDetails', lodash.get(body, 'relatedFourthDegreeDetails'))
        lodash.set(patch, 'personal.guiltyAdmin', lodash.get(body, 'guiltyAdmin'))
        lodash.set(patch, 'personal.guiltyAdminDetails', lodash.get(body, 'guiltyAdminDetails'))
        lodash.set(patch, 'personal.criminalCharge', lodash.get(body, 'criminalCharge'))
        lodash.set(patch, 'personal.criminalChargeDetails', lodash.get(body, 'criminalChargeDetails'))
        lodash.set(patch, 'personal.criminalChargeDate', lodash.get(body, 'criminalChargeDate'))
        lodash.set(patch, 'personal.convicted', lodash.get(body, 'convicted'))
        lodash.set(patch, 'personal.convictedDetails', lodash.get(body, 'convictedDetails'))
        lodash.set(patch, 'personal.problematicHistory', lodash.get(body, 'problematicHistory'))
        lodash.set(patch, 'personal.problematicHistoryDetails', lodash.get(body, 'problematicHistoryDetails'))
        lodash.set(patch, 'personal.electionCandidate', lodash.get(body, 'electionCandidate'))
        lodash.set(patch, 'personal.electionCandidateDetails', lodash.get(body, 'electionCandidateDetails'))
        lodash.set(patch, 'personal.electionResigned', lodash.get(body, 'electionResigned'))
        lodash.set(patch, 'personal.electionResignedDetails', lodash.get(body, 'electionResignedDetails'))
        lodash.set(patch, 'personal.dualCitizen', lodash.get(body, 'dualCitizen'))
        lodash.set(patch, 'personal.dualCitizenDetails', lodash.get(body, 'dualCitizenDetails'))
        lodash.set(patch, 'personal.indigenousGroup', lodash.get(body, 'indigenousGroup'))
        lodash.set(patch, 'personal.indigenousGroupDetails', lodash.get(body, 'indigenousGroupDetails'))
        lodash.set(patch, 'personal.pwd', lodash.get(body, 'pwd'))
        lodash.set(patch, 'personal.pwdDetails', lodash.get(body, 'pwdDetails'))
        lodash.set(patch, 'personal.soloParent', lodash.get(body, 'soloParent'))
        lodash.set(patch, 'personal.soloParentDetails', lodash.get(body, 'soloParentDetails'))
        lodash.set(patch, 'personal.references', lodash.get(body, 'references', []))
        lodash.set(patch, 'personal.governmentId', lodash.get(body, 'governmentId'))
        lodash.set(patch, 'personal.governmentIdNumber', lodash.get(body, 'governmentIdNumber'))
        lodash.set(patch, 'personal.governmentIdDatePlace', lodash.get(body, 'governmentIdDatePlace'))
        lodash.set(patch, 'personal.datePdsFilled', lodash.get(body, 'datePdsFilled'))
        lodash.set(patch, 'personal.personAdministeringOath', lodash.get(body, 'personAdministeringOath'))

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

        flash.ok(req, 'employee', `PDS updated.`)

        res.redirect(`/e/pds/more-info`)
    } catch (err) {
        next(err);
    }
});

module.exports = router;