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
const middlewares = require('../middlewares');
const s3 = require('../aws-s3');

// Router
let router = express.Router()

router.use('/application', middlewares.requireAuthUser )

router.get('/application/all', middlewares.guardRoute(['read_all_resident', 'read_resident']), async (req, res, next) => {
    try {
        let applications = await db.main.Application.find()
        res.render('application/all.html', {
            flash: flash.get(req, 'application'),
            applications: applications
        });
    } catch (err) {
        next(err);
    }
});

router.get('/application/:applicationId', middlewares.guardRoute(['create_resident', 'update_resident']), middlewares.getApplication, async (req, res, next) => {
    try {
        let person = res.person

        res.render('resident/personal.html', {
            flash: flash.get(req, 'resident'),
            person: person,
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;