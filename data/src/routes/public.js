//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const qr = require('qr-image')

//// Modules
const db = require('../db')
const passwordMan = require('../password-man')

// Router
let router = express.Router()

router.get('/login', async (req, res, next) => {
    try {
        // console.log(req.session)
        let ip = req.headers['x-real-ip'] || req.connection.remoteAddress;
        res.render('login.html', {
            flash: flash.get(req, 'login'),
            ip: ip,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/login', async (req, res, next) => {
    try {
        let post = req.body;

        let username = lodash.get(post, 'username', '');
        let password = lodash.get(post, 'password', '');

        // Find admin
        let user = await db.main.User.findOne({ username: username });
        if (!user) {
            throw new Error('Incorrect username or password.')
        }

        if (!user.active) {
            throw new Error('Your account is deactivated.');
        }

        // Check password
        let passwordHash = passwordMan.hashPassword(password, user.salt);
        if (passwordHash !== user.passwordHash) {
            throw new Error('Incorrect password.');
        }

        // Save user id to session
        lodash.set(req, 'session.authUserId', user._id);

        // Security: Anti-CSRF token.
        let antiCsrfToken = await passwordMan.randomStringAsync(16)
        lodash.set(req, 'session.acsrf', antiCsrfToken);

        if (user.roles.includes('employee')) {
            return res.redirect('/e-profile/home')
        }
        if (user.roles.includes('checker')) {
            let scanner = await db.main.Scanner.findOne({
                userId: user._id
            })
            if (scanner) {
                return res.redirect(`${CONFIG.app.url}/scanner/${scanner.uid}/scan`)
            }
        }
        return res.redirect('/');
    } catch (err) {
        flash.error(req, 'login', err.message);
        return res.redirect('/login');
    }
});

router.get('/logout', async (req, res, next) => {
    try {
        lodash.set(req, 'session.authUserId', null);
        lodash.set(req, 'session.acsrf', null);
        lodash.set(req, 'session.flash', null);
        res.clearCookie(CONFIG.session.name, CONFIG.session.cookie);

        res.redirect('/login');
    } catch (err) {
        next(err);
    }
});


router.get('/register', async (req, res, next) => {
    try {
        // console.log(req.session)
        let ip = req.headers['x-real-ip'] || req.connection.remoteAddress;
        res.render('register.html', {
            flash: flash.get(req, 'login'),
            ip: ip,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/register', async (req, res, next) => {
    try {
        let body = req.body
        let code = lodash.get(body, 'code')

        let registrationForm = await db.main.RegistrationForm.findOne({
            uid: code,
        })
        if(!registrationForm){
            registrationForm = await db.main.RegistrationForm.create({
                uid: code,
            })
        } else {
            if(registrationForm.finished){
                throw new Error('You are already registered. Please proceed to the login page.')
            }
        }
        let qrData = `${CONFIG.app.url}/register/${registrationForm._id}`
        qrData = qr.imageSync(qrData, { size: 5, type: 'png' }).toString('base64')

        let payload = {
            qr: qrData,
            registrationForm: registrationForm.toObject()
        }

        if(req.xhr){
            return res.send(payload)
        }
        res.render('register-qr.html', payload);
    } catch (err) {
        if(req.xhr){
            return res.status(500).send(err.message)
        }
        next(err);
    }
});

router.get('/register/:registrationFormId', async (req, res, next) => {
    try {
        let registrationFormId = lodash.get(req, 'params.registrationFormId')
        let registrationForm = await db.main.RegistrationForm.findById(registrationFormId)
        if(!registrationForm){
            throw new Error('Form not found.')
        } else {
            if(registrationForm.finished){
                throw new Error('You are already registered.')
            }
        }
        registrationForm.started = true
        await registrationForm.save()
        res.send('form here...')
    } catch (err) {
        next(err);
    }
});

router.get('/register-long-poll/:registrationFormId', async (req, res, next) => {
    try {
        let registrationFormId = lodash.get(req, 'params.registrationFormId')

        let x = 0
        let maxTime = 30000 * 1 // 1 minutes
        // let maxTime = 10000
        let intervals = 5000 // 1 secs
        let maxX = maxTime / intervals // 12 steps

        let longPoll = () => {
            x++
            console.log(`${x} of ${maxX}`);

            db.main.RegistrationForm.findById(registrationFormId).then((r) => {
                if(r.started){
                    clearInterval(intervalObj)
                    console.log('r', r)
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