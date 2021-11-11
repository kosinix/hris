/**
 * Admin account
 */

//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment');

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const passwordMan = require('../password-man');

// Router
let router = express.Router()

router.use('/account', middlewares.requireAuthUser)

router.get('/account', async (req, res, next) => {
    try {
        res.redirect('/account/password')
    } catch (err) {
        next(err);
    }
})

router.get('/account/password', async (req, res, next) => {
    try {
        let myAccount = res.user.toObject()

        res.render('account/password.html', {
            flash: flash.get(req, 'account'),
            myAccount: myAccount,
            momentNow: moment(),
        });

    } catch (err) {
        next(err);
    }
});
router.post('/account/password', async (req, res, next) => {
    try {
        let myAccount = res.user.toObject()

        let body = lodash.get(req, 'body')
        let oldPassword = lodash.trim(lodash.get(body, 'oldPassword'))
        let newPassword = lodash.trim(lodash.get(body, 'newPassword'))

        // Check oldPassword
        let passwordHash = passwordMan.hashPassword(oldPassword, myAccount.salt);
        if (passwordHash !== myAccount.passwordHash) {
            flash.error(req, 'account', `Current Password is incorrect.`)
            return res.redirect(`/account/password`)
        }

        passwordHash = passwordMan.hashPassword(newPassword, myAccount.salt);
        await db.main.User.updateOne({
            _id: myAccount._id
        }, {
            passwordHash: passwordHash
        })

        flash.ok(req, 'account', `Password changed successfully.`)
        return res.redirect(`/account/password`)
    } catch (err) {
        next(err);
    }
});

module.exports = router;