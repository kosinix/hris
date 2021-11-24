//// Core modules
const fs = require('fs')

//// External modules
const express = require('express')
const flash = require('kisapmata')
const phAddress = require('ph-address')
const moment = require('moment')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');

// Router
let router = express.Router()

router.use('/reports', middlewares.requireAuthUser)
// router.use('/reports', middlewares.guardRoute(['read_all_admin', 'create_admin', 'read_admin', 'update_admin', 'delete_admin']))

router.get('/reports/all', async (req, res, next) => {
    try {
        
        res.render('reports/all.html', {
            flash: flash.get(req, 'reports'),
        });
    } catch (err) {
        next(err);
    }
});


module.exports = router;