/**
 * Routes for admin options
 */
//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const mailer = require('../mailer');
const middlewares = require('../middlewares');
const paginator = require('../paginator');

// Router
let router = express.Router()

router.use('/options', middlewares.requireAuthUser)

router.get('/options/all', middlewares.guardRoute(['read_all_user', 'read_user']), async (req, res, next) => {
    try {
        
        let data = {
            time: moment().hours(CONFIG.hros.flagRaising.end.hour).minutes(CONFIG.hros.flagRaising.end.minute).format('HH:mm')
        }
        res.render('options/all.html', data);
    } catch (err) {
        next(err);
    }
});

module.exports = router;