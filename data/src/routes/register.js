//// Core modules

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const lodash = require('lodash')
const qr = require('qr-image')

//// Modules
const middlewares = require('../middlewares');
const passwordMan = require('../password-man');

// Router
let router = express.Router()


router.get('/register/:registrationFormId', async (req, res, next) => {
    try {
        let registrationFormId = lodash.get(req, 'params.registrationFormId')
        let registrationForm = await req.app.locals.db.main.RegistrationForm.findById(registrationFormId)
        if (!registrationForm) {
            throw new Error('Form not found.')
        } else {
            if (registrationForm.status === 'finished') {
                throw new Error('You are already registered. Please proceed to the login page.')
            }
            if (registrationForm.status === 'verified') {
                throw new Error('You are already verified. Please open your email.')
            }
        }
        registrationForm.status = 'started'
        await registrationForm.save()
        res.render('register-user.html', {
            flash: flash.get(req, 'register'),
            registrationForm: registrationForm
        });
    } catch (err) {
        next(err);
    }
});

router.post('/register/:registrationFormId', fileUpload(), middlewares.handleExpressUploadMagic, async (req, res, next) => {
    try {
        let registrationFormId = lodash.get(req, 'params.registrationFormId')
        let registrationForm = await req.app.locals.db.main.RegistrationForm.findById(registrationFormId)
        if (!registrationForm) {
            throw new Error('Form not found.')
        } else {
            if (registrationForm.status === 'finished') {
                throw new Error('You are already registered. Please proceed to the login page.')
            }
            if (registrationForm.status === 'verified') {
                throw new Error('You are already verified. Please open your email.')
            }
        }

        registrationForm.employmentId = lodash.get(req, 'body.employmentId')
        registrationForm.photo = lodash.get(req, 'body.photo', '')
        registrationForm.email = lodash.get(req, 'body.email', '')
        registrationForm.status = 'finished'
        await registrationForm.save()

        let employmentId = registrationForm.employmentId 
        let employment = await req.app.locals.db.main.Employment.findById(employmentId).lean()
        let employee = null
        if (employment) {
            employee = await req.app.locals.db.main.Employee.findOne({ _id: employment.employeeId })
            employment.employee = employee.toObject()
        }
        let userA = await req.app.locals.db.main.User.findById(employment.employee.userId)
        if (!userA) {
            throw new Error('You dont have an user account.')
        }

        let data = {
            employment: employment,
            employee: employment.employee,
            registrationForm: registrationForm,
            // user: userA,
            // password: password,
        }
        if (req.xhr) {
            return res.send(data)
        }
        res.render('register-user.html', data)
    } catch (err) {
        if (req.xhr) {
            return res.status(500).send(err.message)
        }
        next(err);
    }
});


router.use('/register', middlewares.requireAuthUser)
router.use('/register', middlewares.guardRoute(['use_scanner']))

router.get('/register', async (req, res, next) => {
    try {
        res.render('register.html', {
            flash: flash.get(req, 'register'),
        });
    } catch (err) {
        next(err);
    }
});
router.post('/register', async (req, res, next) => {
    try {
        let body = req.body
        let code = lodash.get(body, 'code')

        let registrationForm = await req.app.locals.db.main.RegistrationForm.findOne({
            uid: code,
        })
        if (!registrationForm) {
            registrationForm = await req.app.locals.db.main.RegistrationForm.create({
                uid: code,
            })
        } else {
            if (registrationForm.status === 'finished') {
                throw new Error('You are already registered. Please proceed to the login page.')
            }
            if (registrationForm.status === 'verified') {
                throw new Error('You are already verified. Please open your email.')
            }
        }
        let qrData = `${CONFIG.app.url}/register/${registrationForm._id}`
        qrData = qr.imageSync(qrData, { size: 5, type: 'png' }).toString('base64')

        let payload = {
            qr: qrData,
            registrationForm: registrationForm.toObject()
        }

        if (req.xhr) {
            return res.send(payload)
        }
        res.render('register-qr.html', payload);
    } catch (err) {
        if (req.xhr) {
            return res.status(500).send(err.message)
        }
        next(err);
    }
});



router.get('/register/long-poll/:registrationFormId', async (req, res, next) => {
    try {
        let registrationFormId = lodash.get(req, 'params.registrationFormId')

        let x = 0
        let maxTime = 60000 * 1 // 1 minutes
        // let maxTime = 10000
        let intervals = 5000 // 1 secs
        let maxX = maxTime / intervals // 12 steps

        let longPoll = () => {
            x++
            // console.log(`${x} of ${maxX}`);

            req.app.locals.db.main.RegistrationForm.findById(registrationFormId).then((r) => {
                if (r.status === 'started') {
                    clearInterval(intervalObj)
                    // console.log('r', r)
                    res.send('done')
                }
            }).catch(function (error) {
                // handle error
                console.log(error);
                clearInterval(intervalObj)
            }).then(function () {
                // always executed
                // clearInterval(intervalObj)
                // console.log('always executed');
            });

            if (x >= maxX) { // Prevent infinite loop
                clearInterval(intervalObj)
                res.status(408).send('Long poll loop maxed out.')
            }
        }

        // Call first at 0 seconds
        longPoll()
        // Call every 5 secs
        let intervalObj = setInterval(longPoll, intervals)
    } catch (err) {
        next(err);
    }
});

module.exports = router;