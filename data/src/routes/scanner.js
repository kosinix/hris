//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const passwordMan = require('../password-man');


// Router
let router = express.Router()

router.use('/scanner', middlewares.requireAuthUser)

router.get('/scanner/all', middlewares.guardRoute(['read_all_scanner', 'read_scanner']), async (req, res, next) => {
    try {
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', 10))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = parseInt(lodash.get(req, 'query.customSort'))

        let query = {}
        let projection = {}

        // Pagination
        let totalDocs = await db.main.Scanner.countDocuments(query)
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/scanner/all',
            req.query
        )

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        console.log(query, projection, options, sort)

        let scanners = await db.main.Scanner.find(query, projection, options).sort(sort).lean()

        let users = []
        scanners.forEach((scanner) => {
            users.push(db.main.User.findById(scanner.userId))
        })
        users = await Promise.all(users)
        scanners.forEach((scanner, i) => {
            scanner.user = users[i]
        })

        res.render('scanner/all.html', {
            flash: flash.get(req, 'scanner'),
            scanners: scanners,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/scanner/create', middlewares.guardRoute(['create_scanner']), async (req, res, next) => {
    try {

        res.render('scanner/create.html', {
            flash: flash.get(req, 'scanner'),
        });
    } catch (err) {
        next(err);
    }
});
router.post('/scanner/create', middlewares.guardRoute(['create_scanner']), async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}

        let user = await db.main.Employee.findById(body.userId);
        if (user) {
            throw new Error("Sorry, user not found.")
        }

        lodash.set(patch, 'name', lodash.get(body, 'name'))
        lodash.set(patch, 'campus', lodash.get(body, 'campus'))
        lodash.set(patch, 'userId', lodash.get(body, 'userId'))


        let scanner = new db.main.Scanner(patch)
        await scanner.save()

        flash.ok(req, 'scanner', `Added ${scanner.name}.`)
        res.redirect(`/scanner/${scanner._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/scanner/:scannerId', middlewares.guardRoute(['read_scanner']), middlewares.getScanner, async (req, res, next) => {
    try {
        let scanner = res.scanner.toObject()
        scanner.user = await db.main.User.findById(scanner.userId)

        res.render('scanner/read.html', {
            flash: flash.get(req, 'scanner'),
            scanner: scanner
        });
    } catch (err) {
        next(err);
    }
});

// Scanner front page
router.get('/scanner/:scannerUid/scan', middlewares.guardRoute(['use_scanner']), middlewares.getScanner, middlewares.requireAssignedScanner, async (req, res, next) => {
    let scanner = res.scanner.toObject()

    try {

        res.render('scanner/scan.html', {
            scanner: scanner
        })
    } catch (err) {
        res.render('scanner/error.html',{
            error: err.message,
            scanner: scanner,
        })
    }
});

// Decide on what to do with QR code
router.get('/scanner/:scannerUid/find', middlewares.guardRoute(['use_scanner']), middlewares.getScanner, middlewares.requireAssignedScanner, async (req, res, next) => {
    let scanner = res.scanner.toObject()

    try {


        let code = lodash.get(req, 'query.code')

        let splits = code.split('_')
        if (splits[0] === 'healthdec') {
            code = splits[1]
            // return res.send('health dec for ' + splits[1])
        }

        // return res.send(code)
        let employee = await db.main.Employee.findOne({
            uid: code
        })
        if (!employee) {
            throw new Error('Employee not found.')
        }
        //
        // Today attendance
        let attendance = await db.main.Attendance.findOne({
            employeeId: employee._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        })
        if (attendance && attendance.inAM && attendance.outAM && attendance.inPM && attendance.outPM) {
            throw new Error(`Attendance for "${employee.firstName} ${employee.lastName}" already completed for today. `)
        } 

        return res.redirect(`/scanner/${scanner.uid}/verify?code=${code}`)
    } catch (err) {
        res.render('scanner/error.html',{
            error: err.message,
            scanner: scanner,
        })
    }
});
router.get('/scanner/:scannerUid/verify', middlewares.guardRoute(['use_scanner']), middlewares.getScanner, middlewares.requireAssignedScanner, async (req, res, next) => {
    let scanner = res.scanner.toObject()

    try {

        let code = lodash.get(req, 'query.code')

        let splits = code.split('_')
        if (splits[0] === 'healthdec') {
            code = splits[1]
            // return res.send('health dec for ' + splits[1])
        }

        // return res.send(code)
        let employee = await db.main.Employee.findOne({
            uid: code
        })
        if (!employee) {
            throw new Error('Employee not found.')
        }

        return res.render('scanner/verify.html', {
            scanner: scanner,
            employee: employee,
        })
    } catch (err) {
        res.render('scanner/error.html',{
            error: err.message,
            scanner: scanner,
        })
    }
});

router.post('/scanner/:scannerUid/verify', middlewares.guardRoute(['use_scanner']), middlewares.getScanner, middlewares.requireAssignedScanner, async (req, res, next) => {
    let scanner = res.scanner.toObject()

    try {


        let code = lodash.get(req, 'body.code')

        // return res.send(code)
        let employee = await db.main.Employee.findOne({
            uid: code
        })
        if (!employee) {
            throw new Error('Employee not found.')
        }

        // Today attendance
        let attendance = await db.main.Attendance.findOne({
            employeeId: employee._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        })
        if (!attendance) {
            attendance = new db.main.Attendance({
                employeeId: employee._id,
                scannerId: scanner._id,
                inAM: moment().toDate(),
            })
        } else {
            if (!attendance.outAM) {
                attendance.outAM = new Date()
            } else if (!attendance.inPM) {
                attendance.inPM = new Date()
            } else if (!attendance.outPM) {
                attendance.outPM = new Date()
            }
        }
        await attendance.save()
        // return res.send(attendance)

        return res.redirect(`/scanner/${scanner.uid}/check-in?code=${code}`)
    } catch (err) {
        res.render('scanner/error.html',{
            error: err.message,
            scanner: scanner,
        })
    }
});

router.get('/scanner/:scannerUid/check-in', middlewares.guardRoute(['use_scanner']), middlewares.getScanner, middlewares.requireAssignedScanner, async (req, res, next) => {
    let scanner = res.scanner.toObject()

    try {

        let code = lodash.get(req, 'query.code')

        let splits = code.split('_')
        if (splits[0] === 'healthdec') {
            code = splits[1]
            // return res.send('health dec for ' + splits[1])
        }

        // return res.send(code)
        let employee = await db.main.Employee.findOne({
            uid: code
        })
        if (!employee) {
            throw new Error('Employee not found.')
        }

        return res.render('scanner/check-in.html', {
            scanner: scanner,
            employee: employee,
        })
    } catch (err) {
        res.render('scanner/error.html',{
            error: err.message,
            scanner: scanner,
        })
    }
});

module.exports = router;