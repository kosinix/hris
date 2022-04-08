/**
 * Currently used by hybrid scanners to connect to server
 */

//// Core modules
const crypto = require('crypto');
const url = require('url');

//// External modules
const express = require('express')
const jwt = require('jsonwebtoken')
const lodash = require('lodash')
const axios = require('axios')

//// Modules
const db = require('../db')
const middlewares = require('../middlewares')
const jwtHelper = require('../jwt-helper')
const passwordMan = require('../password-man')

// Router
let router = express.Router()

// router.use('/api')



router.get('/api/status', middlewares.api.requireJwt, async (req, res, next) => {
    try {
        res.send('online')
    } catch (err) {
        next(err);
    }
});

router.post('/api/login', async (req, res, next) => {
    try {
        if(ENV !== 'dev') await new Promise(resolve => setTimeout(resolve, 5000)) // Rate limit 

        let post = req.body;

        let username = lodash.get(post, 'username', '');
        let password = lodash.trim(lodash.get(post, 'password', ''))
        let recaptchaToken = lodash.trim(lodash.get(post, 'recaptchaToken', ''))

        // Recaptcha
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

        // Find admin
        let user = await db.main.User.findOne({ username: username }).lean()
        if (!user) {
            throw new Error('Incorrect username.')
        }

        if (!user.active) {
            throw new Error('Your account is deactivated.');
        }

        // Check password
        let passwordHash = passwordMan.hashPassword(password, user.salt);
        if (!crypto.timingSafeEqual(Buffer.from(passwordHash, 'utf8'), Buffer.from(user.passwordHash, 'utf8'))) {
            throw new Error('Incorrect password.');
        }

        let scanner = await db.main.Scanner.findOne({
            userId: user._id
        }).lean()
        if(!scanner){
            throw new Error('Your account dont have a scanner assigned.');
        }

        let payload = jwtHelper.createPayload(user, scanner)
        let token = jwt.sign(payload, CRED.jwt.secret)
        res.send(token)
    } catch (err) {
        next(err)
    }
});

router.get('/logout', async (req, res, next) => {
    try {
        lodash.set(req, 'session.authUserId', null)
        lodash.set(req, 'session.acsrf', null)
        lodash.set(req, 'session.flash', null)
        res.clearCookie(CONFIG.session.name, CONFIG.session.cookie)

        res.redirect('/login');
    } catch (err) {
        next(err);
    }
});

module.exports = router;