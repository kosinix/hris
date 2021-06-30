//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const payrollCalc = require('../payroll-calc');

// Router
let router = express.Router()

router.use('/payroll', middlewares.requireAuthUser)

router.get('/payroll/all', middlewares.guardRoute(['read_all_payroll', 'read_payroll']), async (req, res, next) => {
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
        let totalDocs = await db.main.Payroll.countDocuments(query)
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/payroll/all',
            req.query
        )

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        // console.log(query, projection, options, sort)

        let payrolls = await db.main.Payroll.find(query, projection, options).sort(sort).lean()

        // let scanners = []
        // payrolls.forEach((payroll) => {
        //     scanners.push(db.main.Scanner.find({ payrollId: payroll._id })) // return array of scanners
        // })
        // scanners = await Promise.all(scanners)
        // payrolls.forEach((payroll, i) => {
        //     payroll.scanners = scanners[i]
        // })

        res.render('payroll/all.html', {
            flash: flash.get(req, 'payroll'),
            payrolls: payrolls,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/payroll/create', middlewares.guardRoute(['create_payroll']), async (req, res, next) => {
    try {

        res.render('payroll/create.html', {
        });
    } catch (err) {
        next(err);
    }
});
router.post('/payroll/create', middlewares.guardRoute(['create_payroll']), async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        lodash.set(patch, 'name', lodash.get(body, 'name'))

        lodash.set(patch, 'template', lodash.get(body, 'template'))
        lodash.set(patch, 'dateStart', lodash.get(body, 'dateStart'))
        lodash.set(patch, 'dateEnd', lodash.get(body, 'dateEnd'))

        let payroll = new db.main.Payroll(patch)
        await payroll.save()
        flash.ok(req, 'payroll', `Created payroll "${payroll.name}".`)
        res.redirect(`/payroll/employees/${payroll._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/payroll/:payrollId', middlewares.guardRoute(['read_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()

        res.redirect(`/payroll/employees/${payroll._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/payroll/payrollin/:payrollId', middlewares.guardRoute(['read_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()

        payroll = await payrollCalc.getCosStaff(payroll, CONFIG.workTime.workDays, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints)

        // return res.send(payroll)
        res.render('payroll/payrollin.html', {
            flash: flash.get(req, 'payroll'),
            payroll: payroll,
        });
    } catch (err) {
        next(err);
    }
});


router.post('/payroll/:payrollId/ded', middlewares.guardRoute(['read_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()

        res.send(`ok ok`)
    } catch (err) {
        next(err);
    }
});

router.get('/payroll/employees/:payrollId', middlewares.guardRoute(['read_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()

        // Expand from just _id and employmentId to full details
        payroll.employments = payroll.employments.map((o) => {
            return db.main.Employment.findById(o._id).lean()
        })
        payroll.employments = await Promise.all(payroll.employments)

        // Add employee details to employment.employee property
        let promises = []
        payroll.employments.forEach((o) => {
            promises.push(db.main.Employee.findById(o.employeeId).lean())
        })
        let employees = await Promise.all(promises)
        payroll.employments = payroll.employments.map((o, i) => {
            o.employee = employees[i]
            return o
        })

        payroll = await payrollCalc.getCosStaff(payroll, CONFIG.workTime.workDays, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints)

        // return res.send(payroll)
        res.render('payroll/employees.html', {
            flash: flash.get(req, 'payroll'),
            payroll: payroll,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/payroll/employees/:payrollId', middlewares.guardRoute(['update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll

        let body = req.body
        let employment = await db.main.Employment.findById(body.employmentId);
        if (!employment) {
            throw new Error("Sorry, employment not found.")
        }

        let employee = await db.main.Employee.findById(employment.employeeId);
        if (!employee) {
            throw new Error("Sorry, employee not found.")
        }

        if (payroll.employments.find((e) => {
            return e._id.toString() === employment._id.toString()
        })) {
            throw new Error("Sorry, employment already here.")
        }

        payroll.employments.push(employment)
        await payroll.save()


        flash.ok(req, 'payroll', `Employee "${employee.firstName}" added to payroll "${payroll.name}".`)
        res.redirect(`/payroll/${payroll._id}`)

        // res.render('payroll/employee-add.html', {
        //     flash: flash.get(req, 'payroll'),
        //     payroll: payroll,
        // });
    } catch (err) {
        next(err);
    }
});

router.get('/payroll/incentives/:payrollId', middlewares.guardRoute(['read_payroll', 'update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()

        res.render('payroll/incentives.html', {
            flash: flash.get(req, 'payroll'),
            payroll: payroll,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/payroll/incentives/:payrollId', middlewares.guardRoute(['read_payroll', 'update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll

        let incentive = req.body
        incentive._id = db.mongoose.Types.ObjectId()
        incentive.uid = lodash.camelCase(incentive.name)

        incentive.initialAmount = lodash.get(incentive, 'initialAmount', '0')
        incentive.initialAmount = incentive.initialAmount.replace(/,/g, '')
        incentive.initialAmount = lodash.toNumber(incentive.initialAmount)
        incentive.initialAmount = parseFloat(incentive.initialAmount)

        let result = lodash.find(payroll.incentives, (i) => {
            return i.uid === incentive.uid
        })
        if (result) {
            flash.error(req, 'payroll', `Incentive ${incentive.name} already present.`)
            return res.redirect(`/payroll/incentives/${payroll._id}`)
        }

        payroll.incentives.push(incentive)

        await payroll.save()
        flash.ok(req, 'payroll', `Added incentive to payroll.`)
        res.redirect(`/payroll/incentives/${payroll._id}`)

    } catch (err) {
        next(err);
    }
});

router.get('/payroll/deductions/:payrollId', middlewares.guardRoute(['read_payroll', 'update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()

        res.render('payroll/deductions.html', {
            flash: flash.get(req, 'payroll'),
            payroll: payroll,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/payroll/deductions/:payrollId', middlewares.guardRoute(['read_payroll', 'update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll

        let deduction = req.body
        deduction._id = db.mongoose.Types.ObjectId()
        deduction.uid = lodash.camelCase(deduction.name)
        deduction.initialAmount = lodash.get(deduction, 'initialAmount', '0')
        deduction.initialAmount = deduction.initialAmount.replace(/,/g, '')
        deduction.initialAmount = lodash.toNumber(deduction.initialAmount)
        deduction.initialAmount = parseFloat(deduction.initialAmount)

        let result = lodash.find(payroll.deductions, (i) => {
            return i.uid === deduction.uid
        })
        if (result) {
            flash.error(req, 'payroll', `Deduction ${deduction.name} already present.`)
            return res.redirect(`/payroll/deductions/${payroll._id}`)
        }

        payroll.deductions.push(deduction)
        await payroll.save()

        flash.ok(req, 'payroll', `Added deduction to payroll.`)
        res.redirect(`/payroll/deductions/${payroll._id}`)

    } catch (err) {
        next(err);
    }
});

router.get('/payroll/update/:payrollId', middlewares.guardRoute(['read_payroll', 'update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {

        res.render('payroll/update.html', {
            payroll: res.payroll.toObject()
        });
    } catch (err) {
        next(err);
    }
});
router.post('/payroll/update/:payrollId', middlewares.guardRoute(['read_payroll', 'update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll

        let body = req.body
        let patch = {}
        lodash.set(patch, 'name', lodash.get(body, 'name'))
        lodash.set(patch, 'dateStart', lodash.get(body, 'dateStart'))
        lodash.set(patch, 'dateEnd', lodash.get(body, 'dateEnd'))
        lodash.set(patch, 'template', lodash.get(body, 'template'))

        lodash.merge(payroll, patch)
        await payroll.save()

        flash.ok(req, 'payroll', `Updated payroll "${payroll.name}".`)
        res.redirect(`/payroll/update/${payroll._id}`)
    } catch (err) {
        next(err);
    }
});

module.exports = router;