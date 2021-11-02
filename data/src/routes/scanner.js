//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const AppError = require('../errors').AppError
const db = require('../db');
const dtrHelper = require('../dtr-helper');
const middlewares = require('../middlewares');
const paginator = require('../paginator');

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

        // console.log(query, projection, options, sort)

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
            scanningDeviceList: CONFIG.scanners.scanningDeviceList,
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
        lodash.set(patch, 'device', lodash.get(body, 'device'))
        lodash.set(patch, 'userId', lodash.get(body, 'userId'))


        let scanner = await db.main.Scanner.create(patch)

        flash.ok(req, 'scanner', `Added scanner "${scanner.name}".`)
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
router.get('/scanner/:scannerId/edit', middlewares.guardRoute(['read_scanner', 'update_scanner']), middlewares.getScanner, async (req, res, next) => {
    try {
        let scanner = res.scanner.toObject()
        scanner.user = await db.main.User.findById(scanner.userId)

        res.render('scanner/edit.html', {
            flash: flash.get(req, 'scanner'),
            scanner: scanner,
            scanningDeviceList: CONFIG.scanners.scanningDeviceList,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/scanner/:scannerId/edit', middlewares.guardRoute(['read_scanner', 'update_scanner']), middlewares.getScanner, async (req, res, next) => {
    try {
        let scanner = res.scanner.toObject()
        let body = req.body
        let patch = scanner

        let user = await db.main.Employee.findById(body.userId);
        if (user) {
            throw new Error("Sorry, user not found.")
        }

        lodash.set(patch, 'name', lodash.get(body, 'name'))
        lodash.set(patch, 'campus', lodash.get(body, 'campus'))
        lodash.set(patch, 'device', lodash.get(body, 'device'))
        lodash.set(patch, 'userId', lodash.get(body, 'userId'))
        lodash.set(patch, 'active', lodash.get(body, 'active'))
        lodash.set(patch, 'verification', lodash.get(body, 'verification'))


        await db.main.Scanner.updateOne({ _id: scanner._id }, patch)

        flash.ok(req, 'scanner', `Updated scanner "${scanner.name}".`)
        res.redirect(`/scanner/${scanner._id}`)
    } catch (err) {
        next(err);
    }
});

// Scanner front page
router.get('/scanner/:scannerUid/scan', middlewares.guardRoute(['use_scanner']), middlewares.getScanner, middlewares.requireAssignedScanner, async (req, res, next) => {
    let scanner = res.scanner.toObject()

    try {
        if (!scanner.active) {
            throw new Error('Scanner has been disabled.')
        }

        let qrData = `WIFI:S:HRIS Hotspot Smart;T:WPA;P:gsc-mis-hris`
        qrData = qr.imageSync(qrData, { size: 5, type: 'png' }).toString('base64')

        let template = 'scanner/scan.html'
        if (scanner.device === 'qrCodeDevice' || scanner.device === 'rfid') {
            template = 'scanner/scan-device.html'
        }
        res.render(template, {
            qrData: qrData,
            scanner: scanner,
        })
    } catch (err) {
        res.render('scanner/error.html', {
            error: err.message,
            scanner: scanner,
        })
    }
});
router.get('/scanner/:scannerUid/capture', middlewares.guardRoute(['use_scanner']), middlewares.getScanner, middlewares.requireAssignedScanner, async (req, res, next) => {
    let scanner = res.scanner.toObject()

    try {
        if (!scanner.active) {
            throw new Error('Scanner has been disabled.')
        }
        let template = 'scanner/capture.html'
        // if (scanner.device === 'qrCodeDevice' || scanner.device === 'rfid') {
        //     template = 'scanner/scan-device.html'
        // }
        res.render(template, {
            scanner: scanner
        })
    } catch (err) {
        res.render('scanner/error.html', {
            error: err.message,
            scanner: scanner,
        })
    }
});
// Decide on what to do with QR code
router.post('/scanner/:scannerUid/scan', middlewares.guardRoute(['use_scanner']), middlewares.getScanner, middlewares.requireAssignedScanner, middlewares.expandScanData, async (req, res, next) => {
    let scanner = res.scanner.toObject()

    try {
        let scanData = res.scanData

        if (scanData.dataType === 'rfid') {

            let log = null
            try {
                log = await dtrHelper.logAttendance(db, scanData.employee, scanData.employment, scanner._id)
            } catch (err) {
                throw new AppError(err.message) // Format for xhr
            }

            if (scanData.employee.profilePhoto) {
                scanData.employee.profilePhoto = `/file-getter/${CONFIG.aws.bucket1.name}/${CONFIG.aws.bucket1.prefix}/small-${scanData.employee.profilePhoto}`
            }
            // setTimeout(function () {
            res.send({
                scanner: scanner,
                log: log,
                employee: scanData.employee,
                employment: scanData.employment,
                code: scanData.code
            })
            // }, 1000)

        } else if(scanData.dataType === 'qr') {

            let log = null
            try {
                log = await dtrHelper.logAttendance(db, scanData.employee, scanData.employment, scanner._id)
            } catch (err) {
                throw new AppError(err.message) // Format for xhr
            }

            if (scanData.employee.profilePhoto) {
                scanData.employee.profilePhoto = `/file-getter/${CONFIG.aws.bucket1.name}/${CONFIG.aws.bucket1.prefix}/small-${scanData.employee.profilePhoto}`
            }
            // setTimeout(function () {
            res.send({
                scanner: scanner,
                log: log,
                employee: scanData.employee,
                employment: scanData.employment,
                code: scanData.code
            })
        } else {
            throw new AppError(`Invalid scan data type.`)
        }


    } catch (err) {
        next(err)
    }
});

router.post('/scanner/:scannerUid/verify', middlewares.guardRoute(['use_scanner']), middlewares.getScanner, middlewares.requireAssignedScanner, middlewares.expandScanData, async (req, res, next) => {
    let scanner = res.scanner.toObject()

    try {
        let scanData = res.scanData

        // Today attendance
        let attendance = await db.main.Attendance.findOne({
            employeeId: scanData.employee._id,
            employmentId: scanData.employment._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        })
        if (!attendance) {
            attendance = new db.main.Attendance({
                employeeId: scanData.employee._id,
                employmentId: scanData.employment._id,
                onTravel: false,
                logs: [
                    {
                        scannerId: scanner._id,
                        dateTime: moment().toDate(),
                        mode: 1 // in
                    }
                ]
            })
        } else {
            if (!attendance.logs.length) {
                throw new Error('Bad attendance data.') // should have at least 1 log
            }
            let lastLog = attendance.logs[attendance.logs.length - 1]

            // Throttle to avoid double scan
            let waitTime = 5
            let diff = moment().diff(moment(lastLog.dateTime), 'minutes')
            if (diff < waitTime) {
                throw new Error(`You have already logged. Please wait ${5 - diff} minute(s) and try again.`)
            }

            let mode = lastLog.mode === 1 ? 0 : 1 // Toggle 1 or 0

            attendance.logs.push({
                scannerId: scanner._id,
                dateTime: moment().toDate(),
                mode: mode
            })
        }
        await attendance.save()

        return res.redirect(`/scanner/${scanner.uid}/check-in?code=${scanData.code}`)
    } catch (err) {
        res.render('scanner/error.html', {
            error: err.message,
            scanner: scanner,
        })
    }
});
router.get('/scanner/:scannerUid/no-verify', middlewares.guardRoute(['use_scanner']), middlewares.getScanner, middlewares.requireAssignedScanner, middlewares.expandScanData, async (req, res, next) => {
    let scanner = res.scanner.toObject()

    try {
        let scanData = res.scanData

        try {
            await dtrHelper.logAttendance(db, scanData.employee, scanData.employment, scanner._id)
        } catch (err) {
            throw new AppError(err.message) // Format for xhr
        }

        return res.redirect(`/scanner/${scanner.uid}/check-in?code=${scanData.code}`)
    } catch (err) {
        res.render('scanner/error.html', {
            error: err.message,
            scanner: scanner,
        })
    }
});

router.post('/scanner/:scannerUid/verify-hdf', middlewares.guardRoute(['use_scanner']), middlewares.getScanner, middlewares.requireAssignedScanner, middlewares.expandScanData, async (req, res, next) => {
    let scanner = res.scanner.toObject()

    try {
        let scanData = res.scanData

        // return res.send(code)
        let employee = scanData.employee

        // Today attendance
        let hd = await db.main.HealthDeclaration.findOne({
            employeeId: employee._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        })
        if (hd) {
            throw new Error('Already submitted today.')
        } else {

            hd = new db.main.HealthDeclaration({
                employeeId: employee._id,
                data: scanData.qrData.frm
            })
            await hd.save()
        }
        // return res.send(hd)

        return res.redirect(`/scanner/${scanner.uid}/check-in?code=${scanData.code}`)
    } catch (err) {
        res.render('scanner/error.html', {
            error: err.message,
            scanner: scanner,
        })
    }
});

router.get('/scanner/:scannerUid/check-in', middlewares.guardRoute(['use_scanner']), middlewares.getScanner, middlewares.requireAssignedScanner, middlewares.expandScanData, async (req, res, next) => {
    let scanner = res.scanner.toObject()

    try {

        let scanData = res.scanData

        let employee = scanData.employee
        let message = 'Attendance logged successfully.'

        if (scanData.dataType === 'qr') {
            if (scanData.qrData.type == 3) {
                message = 'Health declaration submitted successfully.'
            }
        }

        return res.render('scanner/check-in.html', {
            scanner: scanner,
            message: message,
            employee: employee,
        })
    } catch (err) {
        res.render('scanner/error.html', {
            error: err.message,
            scanner: scanner,
        })
    }
});

router.get('/scanner/:scannerUid/pause', middlewares.guardRoute(['use_scanner']), middlewares.getScanner, middlewares.requireAssignedScanner, async (req, res, next) => {
    let scanner = res.scanner.toObject()

    try {

        return res.render('scanner/pause.html', {
            scanner: scanner,
        })
    } catch (err) {
        res.render('scanner/error.html', {
            error: err.message,
            scanner: scanner,
        })
    }
});

module.exports = router;