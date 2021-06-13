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

router.use('/app', middlewares.requireAuthUser)
// router.use('/app', middlewares.guardRoute(['read_all_app', 'create_app', 'read_app', 'update_app', 'delete_app']))

router.get('/app/all', async (req, res, next) => {
    try {
        let apps = await db.main.App.find()
        res.render('app/all.html', {
            flash: flash.get(req, 'app'),
            apps: apps
        });
    } catch (err) {
        next(err);
    }
});

router.get('/app/create', async (req, res, next) => {
    try {

        res.render('app/create.html', {});
    } catch (err) {
        next(err);
    }
});
router.post('/app/create', async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        lodash.set(patch, 'firstName', lodash.get(body, 'firstName'))
        lodash.set(patch, 'middleName', lodash.get(body, 'middleName'))
        lodash.set(patch, 'lastName', lodash.get(body, 'lastName'))
        lodash.set(patch, 'suffix', lodash.get(body, 'suffix'))
        lodash.set(patch, 'birthDate', lodash.get(body, 'birthDate'))
        lodash.set(patch, 'gender', lodash.get(body, 'gender'))
        // lodash.set(patch, 'addresses.0._id', db.mongoose.Types.ObjectId())
        // lodash.set(patch, 'addresses.0.unit', lodash.get(body, 'unit1'))
        // lodash.set(patch, 'addresses.0.brgyDistrict', lodash.get(body, 'brgyDistrict1'))
        // lodash.set(patch, 'addresses.0.cityMun', lodash.get(body, 'cityMun1'))
        // lodash.set(patch, 'addresses.0.province', lodash.get(body, 'province1'))
        // lodash.set(patch, 'addresses.0.region', lodash.get(body, 'region1'))
        // lodash.set(patch, 'addresses.1._id', db.mongoose.Types.ObjectId())
        // lodash.set(patch, 'addresses.1.unit', lodash.get(body, 'unit2'))
        // lodash.set(patch, 'addresses.1.brgyDistrict', lodash.get(body, 'brgyDistrict2'))
        // lodash.set(patch, 'addresses.1.cityMun', lodash.get(body, 'cityMun2'))
        // lodash.set(patch, 'addresses.1.province', lodash.get(body, 'province2'))
        // lodash.set(patch, 'addresses.1.region', lodash.get(body, 'region2'))
        // lodash.set(patch, 'addressPermanent', lodash.get(patch, 'addresses.0._id'))
        // lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.1._id'))
        // if(body.addressSame === 'true'){
        //     patch.addresses.splice(1,1) // Remove second array
        //     lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.0._id'))
        // }

        // TODO: Check duplicate

        let person = new db.main.App(patch)
        await person.save()
        flash.ok(req, 'app', `Added ${person.firstName} ${person.lastName}.`)
        res.send(`/app/address/${person._id}`)
    } catch (err) {
        next(err);
    }
});


module.exports = router;