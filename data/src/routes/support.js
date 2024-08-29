//// Core modules
const fs = require('fs')

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')

//// Modules
const middlewares = require('../middlewares')
const passwordMan = require('../password-man')

// Router
let router = express.Router()

router.use('/support', middlewares.requireAuthUser)

// Register ID
router.get('/support/register', middlewares.guardRoute(['can_register_rfid']), async (req, res, next) => {
    try {
        res.render('support/register.html', {
            flash: flash.get(req, 'support'),
        });
    } catch (err) {
        next(err);
    }
});
router.post('/support/register', middlewares.guardRoute(['can_register_rfid']), async (req, res, next) => {
    try {
        let body = req.body
        let employmentId = lodash.get(body, 'employmentId')

        let employment = await req.app.locals.db.main.Employment.findById(employmentId)
        if (!employment) {
            throw new Error('Employment not found.')
        }
        let employee = await req.app.locals.db.main.Employee.findOne({
            _id: employment.employeeId
        })

        if ((employee.uid + '').length === 10) {
            throw new Error('Employee already has a registered ID.')
        }

        res.redirect(`/support/register/${employmentId}`)
    } catch (err) {
        next(err);
    }
});

router.get('/support/register/:employmentId', middlewares.guardRoute(['can_register_rfid']), middlewares.getEmployment, async (req, res, next) => {
    try {
        let employment = res.employment
        if (!employment) {
            throw new Error('Employment not found.')
        }
        let employee = await req.app.locals.db.main.Employee.findOne({
            _id: employment.employeeId
        })

        res.render('support/register-employment.html', {
            flash: flash.get(req, 'support'),
            employment: employment,
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/support/register/:employmentId', middlewares.guardRoute(['can_register_rfid']), middlewares.getEmployment, async (req, res, next) => {
    try {
        let employment = res.employment.toObject()
        let employee = await req.app.locals.db.main.Employee.findOne({
            _id: employment.employeeId
        }).lean()
        if (!employee) {
            throw new Error('Employee not found.')
        }

        if ((employee.uid + '').length === 10) {
            throw new Error('Employee already has a registered ID.')
        }

        //

        let rfid = lodash.trim(lodash.get(req, 'body.uid'))
        let employmentId = employment._id


        if (lodash.isNaN(rfid)) {
            throw new Error('Invalid RFID format.')
        }
        if (lodash.size(rfid) !== 10) {
            throw new Error('Invalid RFID length.')
        }

        //// User
        let userAccount = await req.app.locals.db.main.User.findById(employee.userId).lean()
        if (!userAccount) {
            throw new Error('You dont have an user account.')
        }
        let email = userAccount.email

        let registrationForm = await req.app.locals.db.main.RegistrationForm.findOne({
            uid: rfid,
        })
        if (registrationForm) {
            if (registrationForm.status === 'finished') {
                throw new Error(`You are already registered. Please proceed to the login page.`)
            }
            if (registrationForm.status === 'verified') {
                throw new Error(`You are already verified. Please open your email.`)
            }
        } else {
            registrationForm = await req.app.locals.db.main.RegistrationForm.create({
                uid: rfid,
                employmentId: employmentId,
                email: email,
                photo: '',
                status: 'finished',
            })
        }



        registrationForm.employment = employment
        registrationForm.employee = employee
        registrationForm.userAccount = userAccount

        let username = registrationForm.userAccount.username
        let password = passwordMan.genPassword()
        let passwordHash = passwordMan.hashPassword(password, userAccount.salt)

        await req.app.locals.db.main.User.updateOne({ _id: registrationForm.userAccount._id }, {
            passwordHash: passwordHash
        })

        // Associate
        await req.app.locals.db.main.Employee.updateOne({ _id: registrationForm.employee._id }, {
            uid: registrationForm.uid // ID card number
        })

        await req.app.locals.db.main.RegistrationForm.updateOne({ _id: registrationForm._id }, {
            status: 'verified'
        })

        flash.ok(req, 'support', 'Employee registered and verified.')
        res.redirect('/support/register')

    } catch (err) {
        next(err);
    }
});


// Register ID
router.get('/support/dtr', middlewares.guardRoute(['read_attendance']), async (req, res, next) => {
    try {
        res.render('support/employee.html', {
            flash: flash.get(req, 'support'),
        });
    } catch (err) {
        next(err);
    }
});
router.get('/support/dtr/:employmentId', middlewares.guardRoute(['read_attendance']), async (req, res, next) => {
    try {

        let employment = await req.app.locals.db.main.Employment.findById(req.params.employmentId)
        if (!employment) {
            throw new Error('Employment not found.')
        }
        let employee = await req.app.locals.db.main.Employee.findOne({
            _id: employment.employeeId
        })
        if (!employee) {
            throw new Error('Employee not found.')
        }

        return res.redirect(`/attendance/employment/${employment._id}`)

    } catch (err) {
        next(err);
    }
});

// Change ID
router.get('/support/id-change', middlewares.guardRoute(['read_attendance']), async (req, res, next) => {
    try {
        res.render('support/id-change.html', {
            flash: flash.get(req, 'support'),
        });
    } catch (err) {
        next(err);
    }
});
router.get('/support/id-change/:employmentId', middlewares.guardRoute(['read_attendance']), async (req, res, next) => {
    try {

        let employment = await req.app.locals.db.main.Employment.findById(req.params.employmentId)
        if (!employment) {
            throw new Error('Employment not found.')
        }
        let employee = await req.app.locals.db.main.Employee.findOne({
            _id: employment.employeeId
        })
        if (!employee) {
            throw new Error('Employee not found.')
        }

        res.render('support/id-change-id.html', {
            flash: flash.get(req, 'support'),
            employment: employment,
            employee: employee,
        });

    } catch (err) {
        next(err);
    }
});
router.post('/support/id-change/:employmentId', middlewares.guardRoute(['can_register_rfid']), middlewares.getEmployment, async (req, res, next) => {
    try {
        let employment = res.employment.toObject()
        let employee = await req.app.locals.db.main.Employee.findOne({
            _id: employment.employeeId
        }).lean()
        if (!employee) {
            throw new Error('Employee not found.')
        }

        let rfid = lodash.trim(lodash.get(req, 'body.uid'))
        let employmentId = employment._id


        if (lodash.isNaN(rfid)) {
            throw new Error('Invalid RFID format.')
        }
        if (lodash.size(rfid) !== 10) {
            throw new Error('Invalid RFID length.')
        }

        let userAccount = await req.app.locals.db.main.User.findById(employee.userId).lean()
        if (!userAccount) {
            throw new Error('You dont have an user account.')
        }


        // Associate
        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            uid: rfid
        })


        flash.ok(req, 'support', 'Employee ID changed.')
        res.redirect('/support/id-change')

    } catch (err) {
        next(err);
    }
});
module.exports = router;