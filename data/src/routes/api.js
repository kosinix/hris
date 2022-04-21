/**
 * Currently used by hybrid scanners to connect to server
 */

//// Core modules
const crypto = require('crypto');
const url = require('url');
const { promisify } = require('util');
const execAsync = promisify(require('child_process').exec);
const rmAsync = promisify(require('fs').rm);
const readFileAsync = promisify(require('fs').readFile);

//// External modules
const axios = require('axios')
const express = require('express')
const jwt = require('jsonwebtoken')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const AppError = require('../errors').AppError
const db = require('../db')
const dtrHelper = require('../dtr-helper')
const middlewares = require('../middlewares')
const jwtHelper = require('../jwt-helper')
const passwordMan = require('../password-man')
const uploader = require('../uploader')

// Router
let router = express.Router()

// Public API
router.post('/api/login', middlewares.api.rateLimit, async (req, res, next) => {
    try {

        let post = req.body;

        let username = lodash.get(post, 'username', '');
        let password = lodash.trim(lodash.get(post, 'password', ''))
        let recaptchaToken = lodash.trim(lodash.get(post, 'recaptchaToken', ''))

        // Recaptcha
        let params = new url.URLSearchParams({
            secret: CRED.recaptchav3.secret,
            response: recaptchaToken
        });
        let response = await axios.post(`https://www.google.com/recaptcha/api/siteverify`, params.toString(), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        })

        // console.log(response.config, response.data)
        let score = lodash.get(response, 'data.score', 0.0)
        if (score < 0.5) {
            throw new Error(`Security error.`)
        }

        // Find admin
        let user = await db.main.User.findOne({ username: username }).lean()
        if (!user) {
            throw new Error('Incorrect username.')
        }

        if (!user.active) {
            throw new Error('Your account is deactivated.');
        }

        // Check password
        let passwordHash = passwordMan.hashPassword(password, user.salt);
        if (!crypto.timingSafeEqual(Buffer.from(passwordHash, 'utf8'), Buffer.from(user.passwordHash, 'utf8'))) {
            throw new Error('Incorrect password.');
        }

        let scanner = await db.main.Scanner.findOne({
            userId: user._id
        }).lean()
        if (!scanner) {
            throw new Error('Your account dont have a scanner assigned.');
        }

        let payload = jwtHelper.createPayload(user, scanner)
        let token = jwt.sign(payload, CRED.jwt.secret)
        res.send(token)
    } catch (err) {
        next(err)
    }
});

router.get('/api/export', middlewares.api.rateLimit, async (req, res, next) => {
    try {
        if (req.query.key !== CRED.recaptchav3.secret) {
            throw new Error('Not allowed.')
        }

        let dumpDir = `dbdump`
        let zipFile = `dbdump.zip`

        // Clear old files if present
        let promises = [
            rmAsync(`${CONFIG.app.dirs.upload}/${dumpDir}`, { recursive: true, force: true }),
            rmAsync(`${CONFIG.app.dirs.upload}/${zipFile}`, { recursive: true, force: true })
        ]
        await Promise.all(promises)

        await execAsync(`mongodump --uri="mongodb://${CRED.mongodb.connections.admin.username}:${CRED.mongodb.connections.admin.password}@${CONFIG.mongodb.connections.main.host}/${CONFIG.mongodb.connections.main.db}?authSource=admin" --collection=employees --out=${CONFIG.app.dirs.upload}/${dumpDir} --gzip`,
            {
                cwd: `${CONFIG.mongodb.dir.bin}`
            })
        await execAsync(`mongodump --uri="mongodb://${CRED.mongodb.connections.admin.username}:${CRED.mongodb.connections.admin.password}@${CONFIG.mongodb.connections.main.host}/${CONFIG.mongodb.connections.main.db}?authSource=admin" --collection=employments --out=${CONFIG.app.dirs.upload}/${dumpDir} --gzip`,
            {
                cwd: `${CONFIG.mongodb.dir.bin}`
            })

        if (ENV === 'dev') {
            await execAsync(`powershell.exe Compress-Archive ${CONFIG.app.dirs.upload}/${dumpDir}/* ${CONFIG.app.dirs.upload}/${zipFile} -Force`, {
                cwd: `${CONFIG.app.dirs.upload}`
            })
        } else {
            // Must run sudo apt-get install zip
            await execAsync(`zip -FSr ${zipFile} ${dumpDir}`, {
                cwd: `${CONFIG.app.dirs.upload}`
            })
        }

        // res.send('Ok')
        res.set('Content-Disposition', `attachment; filename="${zipFile}"`)
        res.set('Content-Type', 'application/zip')
        let buffer = await readFileAsync(`${CONFIG.app.dirs.upload}/${zipFile}`)
        res.send(buffer)
    } catch (err) {
        next(err)
    }
});

router.get('/api/count', middlewares.api.rateLimit, async (req, res, next) => {
    try {
        if (req.query.key !== CRED.recaptchav3.secret) {
            throw new Error('Not allowed.')
        }

        let count = {
            employees: 0,
            employeeLastUpdatedAt: 0,
            employments: 0,
            employmentLastUpdatedAt: 0,
            hash: 0,
        }

        count.employees = await db.main.Employee.countDocuments()
        count.employeeLastUpdatedAt = await db.main.Employee.findOne({}, { updatedAt: 1 }).sort({ updatedAt: -1 }).lean()
        count.employeeLastUpdatedAt = JSON.parse(JSON.stringify(count.employeeLastUpdatedAt))
        count.employeeLastUpdatedAt = lodash.get(count.employeeLastUpdatedAt, 'updatedAt', 0)
        count.employments = await db.main.Employment.countDocuments()
        count.employmentLastUpdatedAt = await db.main.Employment.findOne({}, { updatedAt: 1 }).sort({ updatedAt: -1 }).lean()
        count.employmentLastUpdatedAt = JSON.parse(JSON.stringify(count.employmentLastUpdatedAt))
        count.employmentLastUpdatedAt = lodash.get(count.employmentLastUpdatedAt, 'updatedAt', 0)
        count.hash = `${count.employees}-${count.employeeLastUpdatedAt}-${count.employments}-${count.employmentLastUpdatedAt}`

        res.send(count)
    } catch (err) {
        next(err)
    }
});

// API behind JWT
router.use('/api', middlewares.api.requireJwt)

router.get('/api/status', async (req, res, next) => {
    try {
        res.send('online')
    } catch (err) {
        next(err);
    }
});

router.post('/api/scanner/scan', middlewares.api.expandScanData, async (req, res, next) => {
    try {
        let jwtDecoded = res.jwtDecoded
        let scanner = jwtDecoded.scanner
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

                log = await dtrHelper.logAttendance(db, scanData.employee, scanData.employment, scanner._id, undefined, { photo: lodash.get(saveList, 'photos[0]', '') })
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

        } else if (scanData.dataType === 'qr') {

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



module.exports = router;