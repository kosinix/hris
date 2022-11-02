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
        // lodash.set(patch, 'refresh', refresh === 'true' ? true : false)
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

        let scannerPings = await req.app.locals.db.main.ScannerPing.find({
            scannerId: scanner._id
        }).sort({ createdAt: 1 }).lean()

        let timeFr = (seconds) => {
            let hrs = Math.floor(seconds / 60 / 60)
            let mins = Math.floor(seconds / 60 % 60)
            let secs = Math.round(((seconds / 60 % 60) - mins) * 60)
            hrs = (hrs > 0) ? `${hrs}h` : ''
            mins = (mins > 0) ? `${mins}m` : ''
            secs = (secs > 0) ? `${secs}s` : ''
            return `${hrs} ${mins} ${secs}`
        }
        let downTimes = []
        let forDeletion = []
        scannerPings = scannerPings.forEach((ping, index) => {
            let prevPing = scannerPings[index - 1]
            let nextPing = scannerPings[index + 1]
            if (ping.status === 0) {
                let momentStart = moment(ping.createdAt)

                if (nextPing && nextPing.status === 1) {
                    let momentEnd = moment(nextPing.createdAt)
                    let diff = timeFr(momentEnd.diff(momentStart, 'seconds'))
                    downTimes.push(`${momentStart.toISOString()}|${momentEnd.toISOString()}|${diff}`)
                } else {
                    let momentEnd = moment()
                    let diff = timeFr(momentEnd.diff(momentStart, 'seconds'))
                    downTimes.push(`${momentStart.toISOString()}|offline|${diff}`)
                }
            } else if (ping.status === 1) {
                if ((prevPing && prevPing.status === 1) && (nextPing && (nextPing.status === 0 || nextPing.status === 1))) {
                    forDeletion.push(ping._id)
                }
            }
        })

        // Remove dupe 1s
        let rr = await req.app.locals.db.main.ScannerPing.deleteMany({
            scannerId: scanner._id,
            _id: {
                $in: forDeletion
            }
        })

        // return res.send(downTimes)

        res.render('scanner/status.html', {
            flash: flash.get(req, 'scanner'),
            scanner: scanner,
            downTimes: downTimes.map(d => d.split('|')),
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
            template = 'scanner/scan-device3.html'
        }
        res.render(template, {
            qrData: qrData,
            scanner: scanner,
            serverUrl: CONFIG.app.url
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

                for (let c = 0; c < scanData.employments.length; c++) {
                    log = await dtrHelper.logAttendance(req.app.locals.db, scanData.employee, scanData.employments[c], scanner._id, undefined, { photo: lodash.get(saveList, 'photos[0]', '') })
                }
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
                employee: {
                    firstName: scanData.employee.firstName,
                    middleName: scanData.employee.middleName,
                    lastName: scanData.employee.lastName,
                    profilePhoto: scanData.employee.profilePhoto,
                },
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

// Uses hrsprint (v3) scanner
router.post('/scanner/:scannerUid/log', middlewares.guardRoute(['use_scanner']), middlewares.getScanner, middlewares.requireAssignedScanner, async (req, res, next) => {
    try {
        // Get post body
        let code = lodash.get(req, 'body.code')
        let photo = lodash.get(req, 'body.photo', '')

        if (!code) {
            throw new AppError('Sorry, invalid scan.')
        }
        code = String(code) // Convert to string
        if (code.length !== 10) { // RFID numbers are 10 characters
            throw new AppError('Sorry, invalid ID number.')
        }

        // Get scanner
        let scanner = res.scanner.toObject()

        // Get employee assoc with code
        let employee = await req.app.locals.db.main.Employee.findOne({
            uid: code
        }).lean()
        if (!employee) {
            throw new AppError('Sorry, ID card is not registered.', {
                scanner: res.scanner,
                timeOut: 10
            })
        }

        // Get all active employments
        let employments = await req.app.locals.db.main.Employment.find({
            employeeId: employee._id,
            active: true,
        }).lean()
        if (employments.length <= 0) {
            throw new AppError('Sorry, you have no active employments.', {
                scanner: res.scanner,
                timeOut: 10
            })
        }

        let payload = {
            attendances: [],
            employee: {
                firstName: employee.firstName,
                middleName: employee.middleName,
                lastName: employee.lastName,
                gender: employee.gender,
                birthDate: employee.birthDate,
                profilePhoto: employee.profilePhoto,
            },
            log: null,
            logs: {}
        }

        // Cam photo
        let saveList = null
        if (photo) {
            let file = uploader.toReqFile(photo)
            let files = {
                photos: [file]
            }
            let localFiles = await uploader.handleExpressUploadLocalAsync(files, CONFIG.app.dirs.upload)
            let imageVariants = await uploader.resizeImagesAsync(localFiles, null, CONFIG.app.dirs.upload); // Resize uploaded images

            let uploadList = uploader.generateUploadList(imageVariants, localFiles)
            saveList = uploader.generateSaveList(imageVariants, localFiles)
            await uploader.uploadToS3Async(uploadList)
            await uploader.deleteUploadsAsync(localFiles, imageVariants)
        }


        // Order by priority
        let sortPriority = CONFIG.employmentTypes.map(e => e.value)
        // Do not include not found in sort
        employments = employments.filter(e => {
            return sortPriority.includes(e.employmentType)
        })
        employments.sort(function (a, b) {
            return sortPriority.indexOf(a.employmentType) - sortPriority.indexOf(b.employmentType);
        });

        // Log for every active employment
        for (let c = 0; c < employments.length; c++) {
            let source = {
                id: scanner._id,
                type: 'scanner',
                photo: lodash.get(saveList, 'photos[0]', '')
            }
            let attendanceChanged = await dtrHelper.logNormal(req.app.locals.db, moment(), employee, employments[c], source)
            payload.attendances.push(attendanceChanged)
        }

        // Convert to full url
        if (employee.profilePhoto) {
            payload.employee.profilePhoto = `/file-getter/${CONFIG.aws.bucket1.name}/${CONFIG.aws.bucket1.prefix}/small-${employee.profilePhoto}`
        }

        // Display logs on scanner
        let mainAttendance = payload.attendances[0]
        let mainEmployment = employments[0]

        // Normalize Attendance
        let workSchedule = {}
        if (mainAttendance.workScheduleId) {
            workSchedule = await req.app.locals.db.main.WorkSchedule.findById(mainAttendance.workScheduleId).lean()
        } else {
            workSchedule = await req.app.locals.db.main.WorkSchedule.findById(mainEmployment.workScheduleId).lean()
        }
        let workScheduleTimeSegments = dtrHelper.getWorkScheduleTimeSegments(workSchedule, mainAttendance.createdAt)
        mainAttendance = dtrHelper.normalizeAttendance(mainAttendance, employee, workScheduleTimeSegments)

        payload.logs = {
            log0: lodash.get(mainAttendance, 'logs[0]'),
            log1: lodash.get(mainAttendance, 'logs[1]'),
            log2: lodash.get(mainAttendance, 'logs[2]'),
            log3: lodash.get(mainAttendance, 'logs[3]')
        }
        payload.log = mainAttendance.logs.pop()
        payload.logIndex = 0
        payload.logs = lodash.mapValues(payload.logs, (log) => {
            if (lodash.get(log, 'type') === 'travel') {
                payload.logIndex++;
                return 'Travel'
            } else if (lodash.get(log, 'dateTime')) {
                payload.logIndex++;
                return moment(log.dateTime).format('h:mmA')
            }
            return log
        })
        res.send(payload)
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
                let timeUnit = 'minute'
                if (waitTime - diff > 1) {
                    timeUnit = 'minutes'
                }
                throw new Error(`You have just logged. Please wait ${waitTime - diff} ${timeUnit} and try again later.`)
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