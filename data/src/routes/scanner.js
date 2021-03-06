//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const AppError = require('../errors').AppError
const dtrHelper = require('../dtr-helper');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const passwordMan = require('../password-man');
const uploader = require('../uploader');

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
        let totalDocs = await req.app.locals.db.main.Scanner.countDocuments(query)
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

        let scanners = await req.app.locals.db.main.Scanner.find(query, projection, options).sort(sort).lean()

        let users = []
        scanners.forEach((scanner) => {
            users.push(req.app.locals.db.main.User.findById(scanner.userId))
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

        let user = await req.app.locals.db.main.User.findOne({
            username: body.username
        });
        let password = passwordMan.genPassword(12)

        if (!user) {
            let salt = passwordMan.randomString(16)
            let passwordHash = passwordMan.hashPassword(password, salt)
            user = await req.app.locals.db.main.User.create({
                username: body.username,
                email: 'mis+scanner@gsc.edu.ph',
                firstName: body.name,
                lastName: 'Scanner',
                passwordHash: passwordHash,
                salt: salt,
                active: true,
                roles: [
                    'checker'
                ]
            })
        }

        lodash.set(patch, 'name', lodash.get(body, 'name'))
        lodash.set(patch, 'campus', lodash.get(body, 'campus'))
        lodash.set(patch, 'device', lodash.get(body, 'device'))
        lodash.set(patch, 'userId', user._id)

        let scanner = await req.app.locals.db.main.Scanner.create(patch)

        flash.ok(req, 'scanner', `Added scanner "${scanner.name}" with username "${user.username}" and password "${password}". Please take note of the password as you will only see this once.`)
        res.redirect(`/scanner/${scanner._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/scanner/:scannerId', middlewares.guardRoute(['read_scanner']), middlewares.getScanner, async (req, res, next) => {
    try {
        let scanner = res.scanner.toObject()
        scanner.user = await req.app.locals.db.main.User.findById(scanner.userId)

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
        scanner.user = await req.app.locals.db.main.User.findById(scanner.userId)

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
        let patch = {}

        let refresh = lodash.get(body, 'refresh')
        let useCam = lodash.get(body, 'useCam')
        lodash.set(patch, 'name', lodash.get(body, 'name'))
        lodash.set(patch, 'campus', lodash.get(body, 'campus'))
        lodash.set(patch, 'device', lodash.get(body, 'device'))
        lodash.set(patch, 'active', lodash.get(body, 'active'))
        lodash.set(patch, 'refresh', refresh === 'true' ? true : false)
        lodash.set(patch, 'useCam', useCam === 'true' ? true : false)

        // socket io refresh whoa
        req.io.emit('refresh', { scanner: scanner._id })

        await req.app.locals.db.main.Scanner.updateOne({ _id: scanner._id }, patch)

        flash.ok(req, 'scanner', `Updated scanner "${scanner.name}".`)
        res.redirect(`/scanner/${scanner._id}`)
    } catch (err) {
        next(err);
    }
});
router.get('/scanner/:scannerId/status', middlewares.guardRoute(['read_scanner', 'update_scanner']), middlewares.getScanner, async (req, res, next) => {
    try {
        let scanner = res.scanner.toObject()
        scanner.user = await req.app.locals.db.main.User.findById(scanner.userId)

        // Scanner status today
        let momentDate = lodash.get(req, 'query.date')
        if (momentDate) {
            momentDate = moment(momentDate)
        } else {
            momentDate = moment()
        }

        

        // let momentStart = null
        // let threshold = 5 // minutes
        // threshold *= 60 // to secs
        // let downTimes = []
        // scannerPings.forEach((ping, index) => {
        //     momentStart = moment(ping.createdAt)
        //     let nextPing = scannerPings[index + 1]
        //     if (nextPing) {
        //         let momentEnd = moment(nextPing.createdAt)
        //         let diff = momentEnd.diff(momentStart, 'seconds')

        //         if (diff > threshold) {
        //             console.log(diff, 's')
        //             downTimes.push(`${momentStart.toISOString()}|${momentEnd.toISOString()}|${diff}`)
        //         }
        //     }
        // })

        let scannerStatus = await req.app.locals.db.main.ScannerStatus.findOne({
            scannerId: scanner._id,
            createdAt: {
                $gte: momentDate.clone().startOf('day').toDate(),
                $lte: momentDate.clone().endOf('day').toDate(),
            }
        }).lean()

        if (scannerStatus) {
            scannerStatus.downTimes.push(...downTimes)
            scannerStatus.downTimes = lodash.uniq(scannerStatus.downTimes)
            await req.app.locals.db.main.ScannerStatus.updateOne({
                scannerId: scanner._id,
                createdAt: momentDate.clone().startOf('day').toDate(),
            }, scannerStatus)
        } else {
            scannerStatus = await req.app.locals.db.main.ScannerStatus.create({
                scannerId: scanner._id,
                createdAt: momentDate.clone().startOf('day').toDate(),
                downTimes: downTimes
            })
        }

        scannerStatus.downTimes = scannerStatus.downTimes.map((o) => {
            let data = o.split('|')
            let diff = parseInt(data[2])
            let hrs = diff / 3600
            let mins = (hrs - Math.floor(hrs)) * 60

            return {
                date: moment(data[0]).format('MMM DD, YYYY'),
                start: moment(data[0]).format('hh:mm A'),
                end: moment(data[1]).format('hh:mm A'),
                diff: diff,
                hrs: Math.floor(hrs),
                mins: Math.round(mins),
            }
        })
        res.render('scanner/status.html', {
            flash: flash.get(req, 'scanner'),
            scanner: scanner,
            scannerStatus: scannerStatus,
        });
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

                let saveList = null
                if (scanData.photo) {
                    let file = uploader.toReqFile(scanData.photo)
                    let files = {
                        photos: [file]
                    }
                    let localFiles = await uploader.handleExpressUploadLocalAsync(files, CONFIG.app.dirs.upload)
                    let imageVariants = await uploader.resizeImagesAsync(localFiles, null, CONFIG.app.dirs.upload); // Resize uploaded images

                    let uploadList = uploader.generateUploadList(imageVariants, localFiles)
                    saveList = uploader.generateSaveList(imageVariants, localFiles)
                    await uploader.uploadToS3Async(uploadList)
                    await uploader.deleteUploadsAsync(localFiles, imageVariants)
                    req.localFiles = localFiles
                    req.imageVariants = imageVariants
                    req.saveList = saveList

                    // console.log(uploadList, saveList)
                }

                log = await dtrHelper.logAttendance(req.app.locals.db, scanData.employee, scanData.employment, scanner._id, undefined, { photo: lodash.get(saveList, 'photos[0]', '') })
            } catch (err) {
                throw err// Format for xhr
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

        } else if (scanData.dataType === 'qr') {

            let log = null
            try {
                log = await dtrHelper.logAttendance(req.app.locals.db, scanData.employee, scanData.employment, scanner._id)
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
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            employeeId: scanData.employee._id,
            employmentId: scanData.employment._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        })
        if (!attendance) {
            attendance = new req.app.locals.db.main.Attendance({
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
            // TODO: check params used here with params definition
            await dtrHelper.logAttendance(req.app.locals.db, scanData.employee, scanData.employment, scanner._id)
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
        let hd = await req.app.locals.db.main.HealthDeclaration.findOne({
            employeeId: employee._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        })
        if (hd) {
            throw new Error('Already submitted today.')
        } else {

            hd = new req.app.locals.db.main.HealthDeclaration({
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