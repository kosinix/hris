//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')

//// Modules
const db = require('../db')
const passwordMan = require('../password-man')

// Router
let router = express.Router()

router.get('/login', async (req, res, next) => {
    try {
        console.log(req.session)
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

        let email = lodash.get(post, 'email', '');
        let password = lodash.get(post, 'password', '');

        // Find admin
        let user = await db.main.User.findOne({ email: email });
        if (!user) {
            throw new Error('Incorrect email or password.')
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

        if(user.roles.includes('employee')){
            return res.redirect('/e-profile/dtr')
        }
        if(user.roles.includes('checker')){
            let scanner = await db.main.Scanner.findOne({
                userId: user._id
            })
            if(scanner){
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

module.exports = router;