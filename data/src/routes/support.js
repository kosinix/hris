//// Core modules
const fs = require('fs')

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const phAddress = require('ph-address')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const db = require('../db');
const mailer = require('../mailer');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const passwordMan = require('../password-man');
const s3 = require('../aws-s3');

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

        let employment = await db.main.Employment.findById(employmentId)
        if(!employment){
            throw new Error('Employment not found.')
        }
        let employee = await db.main.Employee.findOne({
            _id: employment.employeeId
        })

        if((employee.uid + '').length === 10) {
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
        if(!employment){
            throw new Error('Employment not found.')
        }
        let employee = await db.main.Employee.findOne({
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
        let employee = await db.main.Employee.findOne({
            _id: employment.employeeId
        }).lean()
        if(!employee){
            throw new Error('Employee not found.')
        }

        if((employee.uid + '').length === 10) {
            throw new Error('Employee already has a registered ID.')
        }

        //

        let rfid = lodash.trim(lodash.get(req, 'body.uid'))
        let email = lodash.trim(lodash.get(req, 'body.email'))
        let employmentId = employment._id


        if(lodash.isNaN(rfid)){
            throw new Error('Invalid RFID format.')
        }
        if(lodash.size(rfid) !== 10){
            throw new Error('Invalid RFID length.')
        }

        
        let registrationForm = await db.main.RegistrationForm.findOne({
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
            registrationForm = await db.main.RegistrationForm.create({
                uid: rfid,
                employmentId: employmentId,
                email: email,
                photo: '',
                status: 'finished',
            })
        }

        ////

        let userAccount = await db.main.User.findById(employee.userId).lean()
        if (!userAccount) {
            throw new Error('You dont have an user account.')
        }

        registrationForm.employment = employment
        registrationForm.employee = employee
        registrationForm.userAccount = userAccount

        let username = registrationForm.userAccount.username
        let password = passwordMan.genPassUpperCase()
        let passwordHash = passwordMan.hashPassword(password, userAccount.salt)

        await db.main.User.updateOne({ _id: registrationForm.userAccount._id }, {
            passwordHash: passwordHash
        })

        // Associate
        await db.main.Employee.updateOne({ _id: registrationForm.employee._id }, {
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
        console.log(info)

        await db.main.RegistrationForm.updateOne({ _id: registrationForm._id }, {
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

        let employment = await db.main.Employment.findById(req.params.employmentId)
        if(!employment){
            throw new Error('Employment not found.')
        }
        let employee = await db.main.Employee.findOne({
            _id: employment.employeeId 
        })
        if(!employee){
            throw new Error('Employee not found.')
        }

        return res.redirect(`/attendance/employee/${employee._id}/employment/${employment._id}`)
        
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

        let employment = await db.main.Employment.findById(req.params.employmentId)
        if(!employment){
            throw new Error('Employment not found.')
        }
        let employee = await db.main.Employee.findOne({
            _id: employment.employeeId 
        })
        if(!employee){
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
        let employee = await db.main.Employee.findOne({
            _id: employment.employeeId
        }).lean()
        if(!employee){
            throw new Error('Employee not found.')
        }

        let rfid = lodash.trim(lodash.get(req, 'body.uid'))
        let employmentId = employment._id


        if(lodash.isNaN(rfid)){
            throw new Error('Invalid RFID format.')
        }
        if(lodash.size(rfid) !== 10){
            throw new Error('Invalid RFID length.')
        }

        let userAccount = await db.main.User.findById(employee.userId).lean()
        if (!userAccount) {
            throw new Error('You dont have an user account.')
        }


        // Associate
        await db.main.Employee.updateOne({ _id: employee._id }, {
            uid: rfid
        })


        flash.ok(req, 'support', 'Employee ID changed.')
        res.redirect('/support/id-change')

    } catch (err) {
        next(err);
    }
});
module.exports = router;