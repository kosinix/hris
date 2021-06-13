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
const db = require('../../db');
const middlewares = require('../../middlewares');
const s3 = require('../../aws-s3');

// Router
let router = express.Router()

router.get('/api/application', async (req, res, next) => {
    try {
        return res.send({
            l:'aaaa'
        })
    } catch (err) {
        next(err);
    }
});

module.exports = router;