
//// Core modules
let { timingSafeEqual } = require('crypto')

//// External modules
const access = require('acrb')
const flash = require('kisapmata')
const jwt = require('jsonwebtoken')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const AppError = require('./errors').AppError
const passwordMan = require('./password-man')
const uploader = require('./uploader')

let allowIp = async (req, res, next) => {
    try {
        if (CONFIG.ipCheck === false) {
            return next();
        }

        let ips = await req.app.locals.db.main.AllowedIP.find(); // Get from db
        let allowed = lodash.map(ips, (ip) => { // Simplify
            return ip.address;
        })

        if (allowed.length <= 0) { // If none from db, get from config
            allowed = CONFIG.ip.allowed;
        }
        let ip = req.headers['x-real-ip'] || req.connection.remoteAddress;

        if (allowed.includes(ip) || allowed.length <= 0) {
            return next();
        }
        res.setHeader('X-IP', ip);
        res.status(400).send('Access denied from ' + ip)
    } catch (err) {
        next(err);
    }
}

let antiCsrfCheck = async (req, res, next) => {
    try {
        let acsrf = lodash.get(req, 'body.acsrf')

        if (lodash.get(req, 'session.acsrf') === acsrf) {
            return next();
        }
        throw new Error(`Anti-CSRF error detected.`)
    } catch (err) {
        next(err);
    }
}

let dataUrlToReqFiles = (names = []) => {
    return async (req, res, next) => {
        try {

            names.forEach((fieldName) => {
                lodash.set(req, `files.${fieldName}`, [
                    uploader.toReqFile(lodash.get(req, `body.${fieldName}`))
                ])
            })

            next()
        } catch (err) {
            next(err)
        }
    }
}

let handleExpressUploadMagic = async (req, res, next) => {
    try {
        let files = lodash.get(req, 'files', [])
        let localFiles = await uploader.handleExpressUploadLocalAsync(files, CONFIG.app.dirs.upload)
        let imageVariants = await uploader.resizeImagesAsync(localFiles, null, CONFIG.app.dirs.upload); // Resize uploaded images

        let uploadList = uploader.generateUploadList(imageVariants, localFiles)
        let saveList = uploader.generateSaveList(imageVariants, localFiles)
        await uploader.uploadToS3Async(uploadList)
        await uploader.deleteUploadsAsync(localFiles, imageVariants)
        req.localFiles = localFiles
        req.imageVariants = imageVariants
        req.saveList = saveList
        next()
    } catch (err) {
        next(err)
    }
}

let requireAuthScanner = async (req, res, next) => {
    try {
        let authScannerId = lodash.get(req, 'session.authScannerId');
        if (!authScannerId) {
            return res.redirect('/scanner-app/login')
        }
        let authScanner = await req.app.locals.db.main.Scanner.findById(authScannerId);
        if (!authScanner) {
            return res.redirect('/scanner-app/login')
        }
        res.authScanner = authScanner;
        next();
    } catch (err) {
        next(err)
    }
}


module.exports = {
    api: {
        getAuthApp: async (req, res, next) => {
            try {
                await new Promise(resolve => setTimeout(resolve, 5000)) // Rate limit 

                // Uses Basic Auth for mambu compat
                let authorization = lodash.get(req, 'headers.authorization', '').replace('Basic', '').replace(' ', '')
                let decoded = Buffer.from(authorization, 'base64').toString();
                let split = decoded.split(':')
                let username = lodash.get(split, '0', '')
                let password = lodash.get(split, '1', '')

                if (!username || !password) {
                    throw new Error('Invalid credentials.')
                }

                // Find admin
                let user = await req.app.locals.db.main.User.findOne({ username: username });
                if (!user) {
                    throw new Error('Incorrect username.')
                }

                if (!user.active) {
                    throw new Error('Your account is deactivated.');
                }

                // Check password
                let passwordHash = passwordMan.hashPassword(password, user.salt);
                if (!timingSafeEqual(Buffer.from(passwordHash, 'utf8'), Buffer.from(user.passwordHash, 'utf8'))) {
                    throw new Error('Incorrect password.');
                }

                res.user = user;

                next();
            } catch (err) {
                next(err);
            }
        },
        requireJwt: async (req, res, next) => {
            let authorization = ''
            try {
                authorization = lodash.get(req, 'headers.authorization', '').replace('Bearer', '').replace(' ', '')
        
                res.jwt = authorization
                res.jwtDecoded = jwt.verify(authorization, CRED.jwt.secret)
        
                next()
            } catch (err) {
                next(err)
            }
        },
        requireApiKey: async (req, res, next) => {
            try {
                if (req.query.key !== CRED.api.secret) {
                    throw new Error('Not allowed. API keys dont match.')
                }
        
                next()
            } catch (err) {
                next(err)
            }
        },
        expandScanData: async (req, res, next) => {
            try {
                let jwtDecoded = res.jwtDecoded
                let scanner = jwtDecoded.scanner
                let code = (req.body.code + '') || ''
                if (!code) {
                    throw new AppError('Sorry, invalid scan data.', {
                        scanner: scanner,
                        timeOut: 10
                    })
                }
                code = code.trim()
                // console.log(code, code.length)
                if (code.length !== 10) { // Plain number
                    throw new AppError('Sorry, invalid RFID number.', {
                        scanner: scanner,
                        timeOut: 10
                    })
                }
    
                let photo = lodash.get(req, 'body.photo', '')
    
                let employee = await req.app.locals.db.main.Employee.findOne({
                    uid: code
                }).lean()
                if (!employee) {
                    throw new AppError('Sorry, ID card is not registered.', {
                        scanner: scanner,
                        timeOut: 10
                    })
                }
    
                // TODO: Allow choose employment for rfid
                let employment = await req.app.locals.db.main.Employment.findOne({
                    employeeId: employee._id
                }).lean()
                if (!employment) {
                    throw new AppError('Employment not found from RFID.', {
                        scanner: scanner,
                        timeOut: 10
                    })
                }
    
                res.scanData = {
                    dataType: 'rfid',
                    code: code,
                    photo: photo,
                    employee: employee,
                    employment: employment,
                }
    
                next();
            } catch (err) {
                next(err);
            }
        },
        rateLimit: async (req, res, next) => {
            try {
                if (ENV !== 'dev') await new Promise(resolve => setTimeout(resolve, 5000)) // Rate limit if on live 
                next();
            } catch (err) {
                next(err)
            }
        },
    },
    allowIp: allowIp,
    antiCsrfCheck: antiCsrfCheck,
    guardRoute: (permissions, condition = 'and') => {
        return async (req, res, next) => {
            try {
                let user = res.user
                let rolesList = await req.app.locals.db.main.Role.find()
                if (condition === 'or') {
                    if (!access.or(user, permissions, rolesList)) {
                        return res.render('error.html', {
                            error: `Access denied. Must have one of these permissions: ${permissions.join(', ')}.`
                        })
                    }
                } else {
                    if (!access.and(user, permissions, rolesList)) {
                        return res.render('error.html', {
                            error: `Access denied. Required all these permissions: ${permissions.join(', ')}.`
                        })
                    }
                }
                next()
            } catch (err) {
                next(err)
            }
        }
    },
    getPayroll: async (req, res, next) => {
        try {
            let payrollId = req.params.payrollId || ''
            let payroll = await req.app.locals.db.main.Payroll.findById(payrollId);
            if (!payroll) {
                return res.render('error.html', { error: "Sorry, payroll not found." })
            }
            res.payroll = payroll
            next();
        } catch (err) {
            next(err);
        }
    },
    lockPayroll: async (req, res, next) => {
        try {

            let payroll = res.payroll.toObject()
            let user = res.user.toObject()

            if (payroll.assignedTo) {
                if (payroll.assignedTo._id.toString() !== user._id.toString()) {
                    flash.error(req, 'payroll', `Payroll locked. Currently edited by user "${payroll.assignedTo.username}".`)
                    return res.redirect('/payroll/all')
                }
            } else {
                payroll.assignedTo = user
                await req.app.locals.db.main.Payroll.updateOne({ _id: payroll._id }, payroll)
            }
            next();
        } catch (err) {
            next(err);
        }
    },
    getMemo: async (req, res, next) => {
        try {
            let memoId = req.params.memoId || ''
            let memo = await req.app.locals.db.main.Memo.findById(memoId);
            if (!memo) {
                return res.render('error.html', { error: "Sorry, memo not found." })
            }
            res.memo = memo
            next();
        } catch (err) {
            next(err);
        }
    },
    getScanner: async (req, res, next) => {
        try {
            let scannerId = req.params.scannerId || ''
            let scannerUid = req.params.scannerUid || ''
            let scanner = null
            if (scannerId) {
                scanner = await req.app.locals.db.main.Scanner.findById(scannerId)
            } else if (scannerUid) {
                scanner = await req.app.locals.db.main.Scanner.findOne({
                    uid: scannerUid
                })
            }
            if (!scanner) {
                return res.render('error.html', { error: "Sorry, scanner not found." })
            }
            res.scanner = scanner
            next();
        } catch (err) {
            next(err);
        }
    },
    qrDecode: async (req, res, next) => {
        try {
            let code = req.query.code || ''
            if (!code) {
                code = req.body.code || ''
            }
            if (!code) {
                return res.render('error.html', { error: "Sorry, QR not found." })
            }
            let qrData = Buffer.from(code, 'base64').toString('utf8')
            try {
                qrData = JSON.parse(qrData)
            } catch (errr) {
                throw new Error('Invalid QR code.')
            }
            res.qrCode = code
            res.qrData = qrData
            next();
        } catch (err) {
            next(err);
        }
    },
    getEmployee: async (req, res, next) => {
        try {
            let employeeId = req.params.employeeId || ''
            let employee = await req.app.locals.db.main.Employee.findById(employeeId);
            if (!employee) {
                return res.render('error.html', { error: "Sorry, employee not found." })
            }
            employee.employments = await req.app.locals.db.main.Employment.find({
                employeeId: employeeId
            });

            res.employee = employee
            next();
        } catch (err) {
            next(err);
        }
    },
    getRegistration: async (req, res, next) => {
        try {
            let registrationId = req.params.registrationId || ''
            let registration = await req.app.locals.db.main.RegistrationForm.findById(registrationId).lean()
            if (!registration) {
                throw new Error("Sorry, registration not found.")
            }

            let employment = await req.app.locals.db.main.Employment.findById(registration.employmentId).lean()
            if (!employment) {
                throw new Error("Sorry, employment not found.")
            }

            let employee = await req.app.locals.db.main.Employee.findById(employment.employeeId).lean()
            if (!employee) {
                throw new Error("Sorry, employee not found.")
            }

            let userAccount = await req.app.locals.db.main.User.findById(employee.userId).lean()
            if (!userAccount) {
                throw new Error('You dont have an user account.')
            }



            registration.employment = employment
            registration.employee = employee
            registration.userAccount = userAccount

            res.registration = registration
            next();
        } catch (err) {
            next(err);
        }
    },
    getEmployment: async (req, res, next) => {
        try {
            let employmentId = req.params.employmentId || ''
            let employment = await req.app.locals.db.main.Employment.findById(employmentId);
            if (!employment) {
                return res.render('error.html', { error: "Sorry, employment not found." })
            }
            res.employment = employment
            next();
        } catch (err) {
            next(err);
        }
    },
    getEmploymentIndex: async (req, res, next) => {
        try {
            if (!res.employee) {
                return res.render('error.html', { error: "Sorry, employee not found." })
            }
            let employmentId = req.params.employmentId || ''
            let employmentIndex = res.employee.employments.findIndex((e) => {
                return e._id.toString() === employmentId
            })
            if (employmentIndex === -1) {
                return res.render('error.html', { error: "Sorry, employment not found." })
            }
            res.employmentIndex = employmentIndex
            next();
        } catch (err) {
            next(err);
        }
    },
    getAttendance: async (req, res, next) => {
        try {
            let attendanceId = req.params.attendanceId || ''
            let attendance = await req.app.locals.db.main.Attendance.findById(attendanceId);
            if (!attendance) {
                return res.render('error.html', { error: "Sorry, attendance not found." })
            }
            res.attendance = attendance
            next();
        } catch (err) {
            next(err);
        }
    },
    getApplication: async (req, res, next) => {
        try {
            let applicationId = req.params.applicationId || ''
            let application = await req.app.locals.db.main.Application.findById(applicationId);
            if (!application) {
                return res.render('error.html', { error: "Sorry, application not found." })
            }
            res.application = application
            next();
        } catch (err) {
            next(err);
        }
    },
    getUser: async (req, res, next) => {
        try {
            let userId = req.params.userId || ''
            let user = await req.app.locals.db.main.User.findById(userId);
            if (!user) {
                return res.render('error.html', { error: "Sorry, user not found." })
            }
            res.user = user
            next();
        } catch (err) {
            next(err);
        }
    },
    dataUrlToReqFiles: dataUrlToReqFiles,
    handleExpressUploadMagic: handleExpressUploadMagic,
    handleUpload: (o) => {
        return async (req, res, next) => {
            try {
                let files = lodash.get(req, 'files', [])
                let localFiles = await uploader.handleExpressUploadLocalAsync(files, CONFIG.app.dirs.upload, o.allowedMimes)
                let imageVariants = await uploader.resizeImagesAsync(localFiles, null, CONFIG.app.dirs.upload); // Resize uploaded images

                let uploadList = uploader.generateUploadList(imageVariants, localFiles)
                let saveList = uploader.generateSaveList(imageVariants, localFiles)
                await uploader.uploadToS3Async(uploadList)
                await uploader.deleteUploadsAsync(localFiles, imageVariants)
                req.localFiles = localFiles
                req.imageVariants = imageVariants
                req.saveList = saveList
                next()
            } catch (err) {
                next(err)
            }
        }
    },
    requireAuthUser: async (req, res, next) => {
        try {
            let authUserId = lodash.get(req, 'session.authUserId');
            if (!authUserId) {
                return res.redirect('/login')
            }
            let user = await req.app.locals.db.main.User.findById(authUserId);
            if (!user) {
                return res.redirect('/logout') // Prevent redirect loop when user is null
            }
            if (!user.active) {
                return res.redirect('/logout')
            }
            res.user = user;
            next();
        } catch (err) {
            next(err)
        }
    },
    requireAuthScanner: requireAuthScanner, // TODO: @deprecated
    requireAssignedScanner: async (req, res, next) => {
        try {
            let scanner = res.scanner.toObject()
            let user = res.user.toObject()

            if (scanner.userId.toString() !== user._id.toString()) {
                throw new Error('Unauthorized to use the scanner.')
            }

            next();
        } catch (err) {
            next(err)
        }
    },
    requireAssocEmployee: async (req, res, next) => {
        try {
            let employee = await req.app.locals.db.main.Employee.findOne({
                userId: res.user._id
            })
            if (!employee) {
                throw new Error('No employee associated with this user.')
            }
            employee.employments = await req.app.locals.db.main.Employment.find({
                employeeId: employee._id
            }).lean()
            res.employee = employee

            // Data privacy
            res.locals.acceptedDataPrivacy = lodash.get(res, 'employee.acceptedDataPrivacy', false)

            next();
        } catch (err) {
            next(err)
        }
    },
    getEmployeeEmployment: async (req, res, next) => {
        try {
            if (!res.employee) {
                throw new Error('Employee needed.')
            }
            let employee = res.employee.toObject()
            let employmentId = lodash.get(req, 'params.employmentId', '')
            let employment = employee.employments.find((e) => {
                return e._id.toString() === employmentId
            })
            if (!employment) {
                throw new Error('Employment not found.')
            }
            res.employmentId = employmentId
            res.employment = employment

            next();
        } catch (err) {
            next(err)
        }
    },
    getDtrQueries: async (req, res, next) => {
        try {
            // Dependencies
            let employment = res.employment

            let periodMonthYear = lodash.get(req, 'query.periodMonthYear', moment().startOf('month').format('YYYY-MM-DD'))
            let periodSlice = lodash.get(req, 'query.periodSlice')
            let periodWeekDays = lodash.get(req, 'query.periodWeekDays', 'All')
            let showTotalAs = lodash.get(req, 'query.showTotalAs', 'time')
            let countTimeBy = lodash.get(req, 'query.countTimeBy', 'weekdays')

            let momentNow = moment()

            // Validation and defaults
            let periodMonthYearMoment = moment(periodMonthYear)
            if (!periodMonthYearMoment.isValid()) {
                throw new Error(`Invalid period date.`)
            }
            if (!['15th', '30th', 'all'].includes(periodSlice)) {
                if (momentNow.date() <= 15) {
                    periodSlice = '15th'
                } else {
                    periodSlice = '30th'
                }
                if (employment.employmentType === 'permanent') {
                    periodSlice = 'all'
                }
            }
            if (!['Mon-Fri', 'Sat-Sun', 'All'].includes(periodWeekDays)) {
                periodWeekDays = 'Mon-Fri'
            }
            if (!['time', 'undertime'].includes(showTotalAs)) {
                showTotalAs = 'time'
            }
            if (!['weekdays', 'weekends', 'all', 'none'].includes(countTimeBy)) {
                countTimeBy = 'weekdays'
            }

            let startMoment = periodMonthYearMoment.clone().startOf('month')
            let endMoment = periodMonthYearMoment.clone().endOf('month')

            if (periodSlice === '15th') {
                startMoment = startMoment.startOf('day')
                endMoment = endMoment.date(15).endOf('day')
            } else if (periodSlice === '30th') {
                startMoment = startMoment.date(16).startOf('day')
                endMoment = endMoment.endOf('month').endOf('day')
            }

            let showWeekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
            if (periodWeekDays === 'Sat-Sun') {
                showWeekDays = ['Sat', 'Sun']
            }
            if (periodWeekDays === 'All') {
                showWeekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            }

            res.periodMonthYear = periodMonthYearMoment.format('YYYY-MM-DD')
            res.periodSlice = periodSlice
            res.periodWeekDays = periodWeekDays
            res.showTotalAs = showTotalAs
            res.showWeekDays = showWeekDays
            res.startMoment = startMoment
            res.endMoment = endMoment
            res.countTimeBy = countTimeBy

            next();
        } catch (err) {
            next(err)
        }
    },
    getEmployeeList: async (req, res, next) => {
        try {
            let employeeListId = lodash.get(req, 'params.employeeListId')
            let employeeList = await req.app.locals.db.main.EmployeeList.findById(employeeListId)
            if (!employeeList) {
                throw new Error('Employee List not found.')
            }
            res.employeeList = employeeList

            next();
        } catch (err) {
            next(err)
        }
    },
    decodeSharedResource: async (req, res, next) => {
        try {
            let secureKey = lodash.get(req, 'params.secureKey', '')
            if (!secureKey) {
                throw new Error('Invalid link.')
            }
            let share = await req.app.locals.db.main.Share.findOne({
                secureKey: secureKey
            })
            // console.log({
            //     secureKey: secureKey
            // })
            if (!share) {
                throw new Error('Cannot find shared resource.')
            }

            // Delete expired
            let deleted = await req.app.locals.db.main.Share.deleteMany({
                expiredAt: {
                    $lte: moment().toDate()
                }
            })
            // console.log('deleted', deleted)


            if (moment().isSameOrAfter(moment(share.expiredAt))) {
                await share.remove()
                throw new Error('Link has expired.')
            }
            res.payload = share.toObject().payload

            next();
        } catch (err) {
            next(err)
        }
    },
    expandScanData: async (req, res, next) => {
        try {
            let code = req.query.code || ''
            if (!code) {
                code = req.body.code || ''
            }
            if (!code) {
                return res.render('error.html', { error: "Sorry, invalid scan data." })
            }

            let photo = lodash.get(req, 'body.photo', '')

            let employee = null
            let employment = null

            if (code.length === 10) { // Plain number

                employee = await req.app.locals.db.main.Employee.findOne({
                    uid: code
                }).lean()
                if (!employee) {
                    throw new AppError('Sorry, ID card is not registered.', {
                        scanner: res.scanner,
                        timeOut: 10
                    })
                }

                // TODO: Allow choose employment for rfid
                employment = await req.app.locals.db.main.Employment.findOne({
                    employeeId: employee._id,
                    active: true,
                }).lean()
                if (!employment) {
                    throw new AppError('Employment not found from RFID.', {
                        scanner: res.scanner,
                        timeOut: 10
                    })
                }

                res.scanData = {
                    dataType: 'rfid',
                    code: code,
                    photo: photo,
                    employee: employee,
                    employment: employment,
                }

            } else { // QR


                let qrData = Buffer.from(code, 'base64').toString('utf8')
                try {
                    qrData = JSON.parse(qrData)
                } catch (errr) {
                    throw new AppError('Invalid QR code.')
                }

                employee = await req.app.locals.db.main.Employee.findOne({
                    _id: qrData.employeeId
                }).lean()
                if (!employee) {
                    throw new AppError('Employee not found from QR Code.')
                }

                employment = await req.app.locals.db.main.Employment.findOne({
                    _id: qrData.employmentId
                }).lean()
                if (!employment) {
                    throw new AppError('Employment not found from QR Code.')
                }

                res.scanData = {
                    dataType: 'qr',
                    code: code,
                    qrData: qrData,
                    employee: employee,
                    employment: employment,
                }

            }

            next();
        } catch (err) {
            next(err);
        }
    },
    getSchedule: async (req, res, next) => {
        try {
            let scheduleId = lodash.get(req, 'params.scheduleId', '')
            let schedule = await req.app.locals.db.main.WorkSchedule.findById(scheduleId)
            if (!schedule) {
                throw new Error('Schedule not found.')
            }
            res.schedule = schedule

            next();
        } catch (err) {
            next(err)
        }
    },
    getHoliday: async (req, res, next) => {
        try {
            let holidayId = lodash.get(req, 'params.holidayId', '')
            let holiday = await req.app.locals.db.main.Holiday.findById(holidayId)
            if (!holiday) {
                throw new Error('Holiday not found.')
            }
            res.holiday = holiday

            next();
        } catch (err) {
            next(err)
        }
    },
}