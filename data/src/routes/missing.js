//// Core modules
const path = require('path')

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const middlewares = require('../middlewares');
const paginator = require('../paginator');

// Router
let router = express.Router()

router.use('/e/missing', middlewares.requireAuthUser)

router.get('/e/missing/u/middleName', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let data = {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
        }
        res.render('e/missing/home.html', data);
    } catch (err) {
        next(err);
    }
});
module.exports = router;