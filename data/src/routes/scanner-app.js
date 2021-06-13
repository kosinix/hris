//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const passwordMan = require('../password-man');

// Router
let router = express.Router()


router.get('/scanner-app/login', async (req, res, next) => {
    try {
        console.log(req.session)
        let ip = req.headers['x-real-ip'] || req.socket.remoteAddress;
        res.render('scanner-app/login.html', {
            flash: flash.get(req, 'login'),
            ip: ip,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/scanner-app/login', async (req, res, next) => {
    try {
        let post = req.body;

        let uid = lodash.get(post, 'username', '');
        let password = lodash.get(post, 'password', '');

        let scanner = await db.main.Scanner.findOne({ uid: uid });
        if (!scanner) {
            throw new Error('Incorrect ID.')
        }

        if (!scanner.active) {
            throw new Error('Scanner is deactivated.');
        }

        // Check password
        let passwordHash = passwordMan.hashPassword(password, scanner.salt);
        if (passwordHash !== scanner.passwordHash) {
            throw new Error('Incorrect password.');
        }

        // Save ID to session
        lodash.set(req, 'session.authScannerId', scanner._id);

        // Security: Anti-CSRF token.
        let antiCsrfToken = await passwordMan.randomStringAsync(16)
        lodash.set(req, 'session.acsrf', antiCsrfToken);

        return res.redirect('/scanner-app');
    } catch (err) {
        flash.error(req, 'login', err.message);
        return res.redirect('/scanner-app/login');
    }
});

router.get('/scanner-app/logout', async (req, res, next) => {
    try {
        lodash.set(req, 'session.authScannerId', null);
        lodash.set(req, 'session.acsrf', null);
        lodash.set(req, 'session.flash', null);
        res.clearCookie(CONFIG.session.name, CONFIG.session.cookie);

        res.redirect('/scanner-app/login');
    } catch (err) {
        next(err);
    }
});

router.get('/scanner-app', middlewares.requireAuthScanner, async (req, res, next) => {
    try {
        res.render('scanner-app/index.html', {
            scanner: res.authScanner
        })
    } catch (err) {
        next(err);
    }
});

router.get('/scanner-app/find', middlewares.requireAuthScanner, async (req, res, next) => {
    try {
        let authScanner = res.authScanner
        let code = lodash.get(req, 'query.code')

        let employee = await db.main.Employee.findOne({
            uid: code
        })

        if(!employee){
            throw new Error('Employee not found.')
        }

        return res.redirect(`/scanner-app/verify?code=${code}`)

        // Last log for this employee in this entity
        let log = await db.main.Log.findOne({
            employeeId: employee._id,
            entityId: authScanner.entityId,
        }).sort({_id: -1 })

        if(authScanner.type === 1) { // Entrance
            // Check if already entered 
            if(lodash.get(log, 'inside') === true){
                throw new Error('Employee already entered. Please scan your QR code in the exit scanner to continue.')
            }

            log = new db.main.Log({
                employeeId: employee._id,
                entityId: authScanner.entityId,
                inside: true,
                enteredOn: authScanner._id,
                enteredAt: new Date(),
            })
            await log.save()

        } else if(authScanner.type === 2) { // Exit
            // Check if already exited
            if(lodash.get(log, 'inside') === false){
                throw new Error('Employee already exited.')
            }

            if(!log){
                throw new Error('Employee has not entered here. Cannot use exit scanner.')
            } else {
                log.exitedOn = authScanner._id
                log.exitedAt = new Date()
                log.inside = false
                await log.save()
            }
        } else { 
            throw new Error(`Invalid scanner type "${authScanner.type}".`)
        }


        res.render('scanner-app/check-in.html',{
            authScanner: authScanner.toObject(),
            employee: employee,
            log: log,
        })

    } catch (err) {
        res.render('scanner-app/error.html',{
            error: err.message
        })
    }
});

router.get('/scanner-app/verify', middlewares.requireAuthScanner, async (req, res, next) => {
    try {
        let authScanner = res.authScanner
        let code = lodash.get(req, 'query.code')

        let employee = await db.main.Employee.findOne({
            uid: code
        })

        if(!employee){
            throw new Error('Employee not found.')
        }

        res.render('scanner-app/verify.html',{
            authScanner: authScanner.toObject(),
            employee: employee,
        })

    } catch (err) {
        res.render('scanner-app/error.html',{
            error: err.message
        })
    }
});

router.post('/scanner-app/scan', middlewares.requireAuthScanner, async (req, res, next) => {
    try {
        let authScanner = res.authScanner
        let code = lodash.get(req, 'body.code')

        let employee = await db.main.Employee.findOne({
            uid: code
        })

        if(!employee){
            throw new Error('Employee not found.')
        }
        
        // Last log for this employee in this entity
        let log = await db.main.Log.findOne({
            employeeId: employee._id,
            entityId: authScanner.entityId,
        }).sort({_id: -1 })

        if(authScanner.type === 1) { // Entrance
            // Check if already entered 
            if(lodash.get(log, 'inside') === true){
                throw new Error('Employee already entered. Please scan your QR code in the exit scanner to continue.')
            }

            log = new db.main.Log({
                employeeId: employee._id,
                entityId: authScanner.entityId,
                inside: true,
                enteredOn: authScanner._id,
                enteredAt: new Date(),
            })
            await log.save()

        } else if(authScanner.type === 2) { // Exit
            // Check if already exited
            if(lodash.get(log, 'inside') === false){
                throw new Error('Employee already exited.')
            }

            if(!log){
                throw new Error('Employee has not entered here. Cannot use exit scanner.')
            } else {
                log.exitedOn = authScanner._id
                log.exitedAt = new Date()
                log.inside = false
                await log.save()
            }
        } else { 
            throw new Error(`Invalid scanner type "${authScanner.type}".`)
        }


        res.render('scanner-app/check-in.html',{
            authScanner: authScanner.toObject(),
            employee: employee,
            log: log,
        })

    } catch (err) {
        res.render('scanner-app/error.html',{
            error: err.message
        })
    }
});

router.get('/scanner-app/check-in', middlewares.requireAuthScanner, async (req, res, next) => {
    try {
        res.render('scanner-app/check-in.html', {
            authScanner: authScanner.toObject(),
            employee: employee,
            // log: log,
        })
    } catch (err) {
        next(err);
    }
});

module.exports = router;