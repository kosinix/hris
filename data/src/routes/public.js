//// Core modules
let { timingSafeEqual } = require('crypto')
const url = require('url');

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const axios = require('axios')

//// Modules
const db = require('../db')
const mailer = require('../mailer')
const passwordMan = require('../password-man')

// Router
let router = express.Router()

router.get('/start', async (req, res, next) => {
    try {
        if (lodash.get(req, 'session.authUserId')) {
            return res.redirect(`/`)
        }
        let username = req.query.username
        // console.log(req.session)
        res.render('start.html', {
            username: username
        });
    } catch (err) {
        next(err);
    }
});
router.get('/login', async (req, res, next) => {
    try {
        if (lodash.get(req, 'session.authUserId')) {
            return res.redirect(`/`)
        }
        // console.log(req.session)
        let ip = req.headers['x-real-ip'] || req.connection.remoteAddress;
        res.render('login.html', {
            flash: flash.get(req, 'login'),
            ip: ip,
            username: lodash.get(req, 'query.username', ''),
        });
    } catch (err) {
        next(err);
    }
});
router.post('/login', async (req, res, next) => {
    try {
        if (CONFIG.loginDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.loginDelay)) // Rate limit 
        }

        let post = req.body;

        let username = lodash.get(post, 'username', '');
        let password = lodash.trim(lodash.get(post, 'password', ''))
        let recaptchaToken = lodash.trim(lodash.get(post, 'recaptchaToken', ''))

        // Recaptcha
        if (CONFIG.recaptchav3.enabled) {

            let params = new url.URLSearchParams({
                secret: CRED.recaptchav3.secret,
                response: recaptchaToken
            });
            let response = await axios.post(`https://www.google.com/recaptcha/api/siteverify`, params.toString(), {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            })

            // console.log(response.config, response.data)
            let score = lodash.get(response, 'data.score', 0.0)
            if (score < 0.5) {
                throw new Error(`Security error.`)
            }
        }

        // Find admin
        let user = await db.main.User.findOne({ username: username });
        if (!user) {
            throw new Error('Incorrect username.')
        }

        if (!user.active) {
            throw new Error('Your account is deactivated.');
        }

        // Check password
        let passwordHash = passwordMan.hashPassword(password, user.salt);
        if (!timingSafeEqual(Buffer.from(passwordHash, 'utf8'), Buffer.from(user.passwordHash, 'utf8'))) {
            throw new Error('Incorrect password.');
        }

        if (!lodash.get(user.toObject(), 'settings.ol', true)) {
            await new Promise(resolve => setTimeout(resolve, 30000)) // Rate limit 
        }

        // Save user id to session
        lodash.set(req, 'session.authUserId', user._id);

        // Security: Anti-CSRF token.
        let antiCsrfToken = await passwordMan.randomStringAsync(16)
        lodash.set(req, 'session.acsrf', antiCsrfToken);

        if (user.roles.includes('employee')) {
            return res.redirect('/e-profile/home')
        }
        if (user.roles.includes('clinical')) {
            return res.redirect('/hdf/all')
        }
        if (user.roles.includes('president') || user.roles.includes('campusdirectormosqueda') || user.roles.includes('campusdirectorbaterna')) {
            return res.redirect('/attendance/monthly')
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

// Forgot password
router.get('/forgot', async (req, res, next) => {
    try {
        if (lodash.get(req, 'session.authUserId')) {
            return res.redirect(`/`)
        }
        res.render('forgot.html', {
            flash: flash.get(req, 'forgot'),
            email: lodash.get(req, 'query.email', ''),
        })
    } catch (err) {
        next(err);
    }
});
router.post('/forgot', async (req, res, next) => {
    try {
        if (CONFIG.loginDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.loginDelay)) // Rate limit 
        }

        let post = req.body;

        let email = lodash.trim(lodash.get(post, 'email', ''))
        if (!email) {
            throw new Error('Blank email.')
        }

        const validateEmail = (email) => {
            return String(email)
                .toLowerCase()
                .match(
                    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
                );
        }
        if (!validateEmail(email)) {
            throw new Error('Invalid email.')
        }
        let recaptchaToken = lodash.trim(lodash.get(post, 'recaptchaToken', ''))

        // Recaptcha
        if (CONFIG.recaptchav3.enable) {
            let params = new url.URLSearchParams({
                secret: CRED.recaptchav3.secret,
                response: recaptchaToken
            });
            let response = await axios.post(`https://www.google.com/recaptcha/api/siteverify`, params.toString(), {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            })

            let score = lodash.get(response, 'data.score', 0.0)
            // console.log('recaptcha score', score)
            if (score < 0.5) {
                throw new Error(`Security error.`)
            }
        }

        // Find admin
        let user = await db.main.User.findOne({ email: email });
        if (!user) {
            throw new Error('Email not found. Please use the email that you registered with HRIS.')
        }

        if (!user.active) {
            throw new Error('Your account is deactivated.');
        }

        if (!user.roles.includes('employee')) {
            throw new Error('This is for employee accounts only. Please contact the system admin.');
        }

        // Delete expired
        await db.main.PasswordReset.deleteMany({
            expiredAt: {
                $lte: moment().toDate()
            }
        })

        let passwordReset = await db.main.PasswordReset.findOne({
            createdBy: email,
        })
        if (passwordReset) {
            let diff = moment(passwordReset.expiredAt).diff(moment(), 'minutes')
            throw new Error(`You still have a pending request for a password reset. Please wait after ${diff} minutes and try again.`)
        }

        let secureKey = await passwordMan.randomStringAsync(32)
        let resetLink = `${CONFIG.app.url}/forgotten/${secureKey}`
        let hash = passwordMan.hashSha256(resetLink)
        resetLink += '?hash=' + hash

        let momentNow = moment()
        passwordReset = await db.main.PasswordReset.create({
            secureKey: secureKey,
            createdBy: email,
            payload: {
                url: resetLink,
                userId: user._id,
                hash: hash
            },
            createdAt: momentNow.toDate(),
            expiredAt: momentNow.clone().add(1, 'hour').toDate(),
        })

        let data = {
            to: user.email,
            firstName: user.firstName,
            resetLink: `${resetLink}`
        }
        await mailer.send('reset.html', data)

        // console.log(passwordReset)
        // console.log(info)

        res.redirect(`/sent?email=${user.email}`);
    } catch (err) {
        console.error(err)
        flash.error(req, 'forgot', err.message);
        return res.redirect('/forgot');
    }
});
router.get('/sent', async (req, res, next) => {
    try {
        if (lodash.get(req, 'session.authUserId')) {
            return res.redirect(`/`)
        }

        res.render('sent.html', {
            flash: flash.get(req, 'forgot'),
            email: lodash.get(req, 'query.email', '')
        })
    } catch (err) {
        next(err)
    }
});
router.get('/sent-done', async (req, res, next) => {
    try {
        if (lodash.get(req, 'session.authUserId')) {
            return res.redirect(`/`)
        }
        res.render('sent-done.html', {
            flash: flash.get(req, 'forgot'),
        })
    } catch (err) {
        next(err);
    }
});
router.get('/forgotten/:secureKey', async (req, res, next) => {
    try {
        // Delete expired
        await db.main.PasswordReset.deleteMany({
            expiredAt: {
                $lte: moment().toDate()
            }
        })

        // Find
        let secureKey = lodash.get(req, 'params.secureKey')
        if (!secureKey) {
            throw new Error('Missing secureKey.')
        }

        let passwordReset = await db.main.PasswordReset.findOne({
            secureKey: secureKey,
        })
        if (!passwordReset) {
            throw new Error('Link not found.')
        }

        let hash = lodash.get(req, 'query.hash')
        if (!hash) {
            throw new Error('Missing hash.')
        }

        let resetLink = `${CONFIG.app.url}/forgotten/${secureKey}`
        if (hash != passwordMan.hashSha256(resetLink)) {
            throw new Error('Invalid hash.')
        }

        // Find admin
        let user = await db.main.User.findOne({ email: passwordReset.createdBy });
        if (!user) {
            throw new Error('Email not found.')
        }

        if (!user.active) {
            throw new Error('Your account is deactivated.');
        }

        // Gen password
        let password = await passwordMan.genPassword(8)
        let passwordHash = passwordMan.hashPassword(password, user.salt)
        user.passwordHash = passwordHash
        await user.save()
        await passwordReset.remove()

        return res.render('sent-done.html', {
            username: user.username,
            password: password,
        });
    } catch (err) {
        console.error(err)
        flash.error(req, 'forgot', err.message);
        return res.redirect('/forgot');
    }
});

// Privacy
router.get('/data-privacy', async (req, res, next) => {
    try {
        res.render('data-privacy.html');
    } catch (err) {
        next(err);
    }
});

// TODO: Remove when done
/*
router.get('/query/employment', async (req, res, next) => {
    try {
        let search = lodash.get(req, 'query.s', '');
        let keys = search.split(' ')
        keys = lodash.map(keys, (o) => {
            o = lodash.trim(o)
            return new RegExp(o, "i")
        })
        // console.log(keys)
        // Our address returned starts from bgy level
        let query = {
            $or: [
                {
                    firstName: keys[0]
                },
                {
                    lastName: keys[0]
                },
            ]
        }

        // raw ops
        // let employees = await db.main.Employee.collection.find(query).limit(10).toArray()
        let aggr = []
        aggr.push({ $match: query })
        aggr.push({ $limit: 10 })
        aggr.push({
            $lookup:
            {
                from: "employments",
                localField: "_id",
                foreignField: "employeeId",
                as: "employments"
            }
        })

        let employees = await db.main.Employee.aggregate(aggr)
        let ret = []
        employees.forEach((employee, i) => {
            let full = [employee.firstName]
            if (employee.lastName) {
                full.push(employee.lastName)
            }
            full = full.join(' ')

            employee.employments.forEach((employment, i) => {
                let final = `${full} - ${employment.position}`

                ret.push({
                    id: employment._id,
                    name: final
                })
            })
        })

        return res.send(ret)

    } catch (err) {
        next(err);
    }
});
*/

router.get('/help', async (req, res, next) => {
    try {

        res.render('e-profile/help.html');
    } catch (err) {
        next(err);
    }
});
router.get('/help/timezone-correction', async (req, res, next) => {
    try {
        res.render('e-profile/help-timezone.html');
    } catch (err) {
        next(err);
    }
});

module.exports = router;