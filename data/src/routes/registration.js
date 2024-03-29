/**
 * Routes for verifying registrations
 */
//// Core modules
const fs = require('fs')
const util = require('util')

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const mailer = require('../mailer');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const passwordMan = require('../password-man');

// Router
let router = express.Router()

router.use('/registration', middlewares.requireAuthUser)

router.get('/registration/all', middlewares.guardRoute(['read_all_user', 'read_user']), async (req, res, next) => {
    try {
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = lodash.get(req, 'query.customSort')
        let customFilter = lodash.get(req, 'query.customFilter')
        let customFilterValue = lodash.get(req, 'query.customFilterValue')
        lodash.set(req, 'session.pagination.perPage', perPage)

        let query = {
            // status: 'finished'
        }
        let projection = {}

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        // console.log(query, projection, options, sort)

        let aggr = []

        aggr.push({ $match: query })
        aggr.push({ $sort: sort })

        // Pagination
        let countDocuments = await req.app.locals.db.main.RegistrationForm.aggregate(aggr)
        let totalDocs = countDocuments.length
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/registration/all',
            req.query
        )

        if (!isNaN(perPage)) {
            aggr.push({ $skip: options.skip })
            aggr.push({ $limit: options.limit })
        }
        let registrations = await req.app.locals.db.main.RegistrationForm.aggregate(aggr)

        let promises = registrations.map((o) => {
            return req.app.locals.db.main.Employment.findOne({ _id: lodash.get(o, 'employmentId') })
        })
        let employments = await Promise.all(promises)

        promises = employments.map((o) => {
            return req.app.locals.db.main.Employee.findOne({ _id: lodash.get(o, 'employeeId') })
        })
        let employees = await Promise.all(promises)

        registrations = registrations.map((o, i) => {
            o.employment = employments[i]
            o.employee = employees[i]
            return o
        })

        // console.log(util.inspect(aggr, false, null, true))

        let data = {
            flash: flash.get(req, 'registration'),
            registrations: registrations,
            pagination: pagination,
            query: req.query,
        }
        if (req.xhr) {
            return res.send(data)
        }
        res.render('registration/all.html', data);
    } catch (err) {
        next(err);
    }
});

// check email look
router.get('/registration/email', middlewares.guardRoute(['read_employee']), async (req, res, next) => {
    try {
        let firstName = lodash.get(req, 'query.firstName', 'Juan')
        let email = lodash.get(req, 'query.email', 'juan@example.com')
        let username = lodash.get(req, 'query.username', 'juan.cruz')
        let password = lodash.get(req, 'query.password', passwordMan.genPassword(10))
        res.render('emails/verified.html', {
            to: email,
            firstName: firstName,
            username: username,
            password: password,
            appUrl: `${CONFIG.app.url}`,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/registration/approve/:registrationId', middlewares.guardRoute(['create_user', 'update_user']), middlewares.getRegistration, async (req, res, next) => {
    try {
        let registration = res.registration

        let username = registration.userAccount.username
        let password = passwordMan.genPassword(10)
        let passwordHash = passwordMan.hashPassword(password, registration.userAccount.salt)

        await req.app.locals.db.main.User.updateOne({ _id: registration.userAccount._id }, {
            passwordHash: passwordHash
        })

        // Associate
        await req.app.locals.db.main.Employee.updateOne({ _id: registration.employee._id }, {
            uid: registration.uid // ID card number
        })

        let data = {
            to: registration.email,
            firstName: registration.employee.firstName,
            username: username,
            password: password,
            appUrl: `${CONFIG.app.url}`,
        }

        let info = await mailer.send('verified.html', data)

        await req.app.locals.db.main.RegistrationForm.updateOne({ _id: registration._id }, {
            status: 'verified'
        })

        flash.ok(req, 'registration', `Verified ${registration.employee.firstName} ${registration.employee.lastName}.`)
        res.redirect(`/registration/all`)
    } catch (err) {
        next(err);
    }
});

router.get('/registration/create', middlewares.guardRoute(['read_all_user', 'read_user']), async (req, res, next) => {
    try {
        res.render('registration/create.html', {
            flash: flash.get(req, 'register'),
        });
    } catch (err) {
        next(err);
    }
});
router.post('/registration/create', middlewares.guardRoute(['create_user', 'update_user']), async (req, res, next) => {
    try {
        let code = lodash.trim(lodash.get(req, 'body.uid'))
        let email = lodash.trim(lodash.get(req, 'body.email'))
        let employmentId = lodash.trim(lodash.get(req, 'body.employmentId'))

        let registrationForm = await req.app.locals.db.main.RegistrationForm.findOne({
            uid: code,
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
                uid: code,
                employmentId: employmentId,
                email: email,
                photo: '',
                status: 'finished',
            })
        }
        //

        let employment = await req.app.locals.db.main.Employment.findById(registrationForm.employmentId).lean()
        if (!employment) {
            throw new Error("Sorry, employment not found.")
        }

        let employee = await req.app.locals.db.main.Employee.findById(employment.employeeId).lean()
        if (!employee) {
            throw new Error("Sorry, employee not found.")
        }

        let userAccount = await req.app.locals.db.main.User.findById(employee.userId).lean()
        if (!userAccount) {
            throw new Error('You dont have an user account.')
        }


        registrationForm.employment = employment
        registrationForm.employee = employee
        registrationForm.userAccount = userAccount

        let username = registrationForm.userAccount.username
        let password = passwordMan.genPassword(8)
        let passwordHash = passwordMan.hashPassword(password, registrationForm.userAccount.salt)

        await req.app.locals.db.main.User.updateOne({ _id: registrationForm.userAccount._id }, {
            passwordHash: passwordHash
        })

        // Associate
        await req.app.locals.db.main.Employee.updateOne({ _id: registrationForm.employee._id }, {
            uid: registrationForm.uid // ID card number
        })

        let data = {
            to: registrationForm.email,
            firstName: registrationForm.employee.firstName,
            username: username,
            password: password,
            loginUrl: `${CONFIG.app.url}/login?username=${username}`
        }

        let info = await mailer.send('verified.html', data)

        await req.app.locals.db.main.RegistrationForm.updateOne({ _id: registrationForm._id }, {
            status: 'verified'
        })

        flash.ok(req, 'register', 'Employee registered and verified.')
        return res.redirect('/registration/create')
    } catch (err) {
        next(err);
    }
});

module.exports = router;