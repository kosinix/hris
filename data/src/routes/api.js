/**
 * Currently used by hybrid scanners to connect to server
 */

//// Core modules
const crypto = require('crypto')
const url = require('url')
const { promisify } = require('util')
const execAsync = promisify(require('child_process').exec)
const rmAsync = promisify(require('fs').rm)
const readFileAsync = promisify(require('fs').readFile)

//// External modules
const axios = require('axios')
const express = require('express')
const fileUpload = require('express-fileupload')
const jwt = require('jsonwebtoken')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const AppError = require('../errors').AppError
const dtrHelper = require('../dtr-helper')
const middlewares = require('../middlewares')
const jwtHelper = require('../jwt-helper')
const passwordMan = require('../password-man')
const uploader = require('../uploader')


// Router
let router = express.Router()

// router.use('/api', )

// Status
router.get('/api/status', async (req, res, next) => {
    try {
        res.send('Online')
    } catch (err) {
        next(err)
    }
})

//
// Uses hrsprint (v3) scanner
router.post('/api/scanner/:scannerId/log', middlewares.getScanner, async (req, res, next) => {
    try {
        // Get post body
        let code = lodash.get(req, 'body.code')

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
                speechSynthesisName: employee.speechSynthesisName,
            },
            log: null,
            logs: {}
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

        let momentDate = moment()

        // Log for every active employment
        for (let c = 0; c < employments.length; c++) {
            let source = {
                id: scanner._id,
                type: 'scanner',
            }
            let attendanceChanged = await dtrHelper.logNormal(req.app.locals.db, momentDate, employee, employments[c], source)
            payload.attendances.push(attendanceChanged)
        }

        // Convert to full url
        if (employee.profilePhoto) {
            payload.employee.profilePhoto = `${CONFIG.app.url}/file-getter/${CONFIG.aws.bucket1.name}/${CONFIG.aws.bucket1.prefix}/small-${employee.profilePhoto}`
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

        payload.employmentId = mainEmployment._id
        payload.employment = mainEmployment
        payload.logMade = payload.log.dateTime

        // let room = momentDate.format('YYYY-MM-DD')
        // req.app.locals.io.of("/monitoring").to(room).emit('added', payload)

        res.send(payload)
    } catch (err) {
        next(err)
    }
});

// Public API
router.post('/api/login', middlewares.api.rateLimit, async (req, res, next) => {
    try {

        let post = req.body

        let username = lodash.get(post, 'username', '')
        let password = lodash.trim(lodash.get(post, 'password', ''))

        // Find admin
        let user = await req.app.locals.db.main.User.findOne({ username: username }).lean()
        if (!user) {
            throw new Error('Incorrect username.')
        }
        if (!user.active) {
            throw new Error('Your account is deactivated.')
        }

        // Check password
        let passwordHash = passwordMan.hashPassword(password, user.salt)
        if (!crypto.timingSafeEqual(Buffer.from(passwordHash, 'utf8'), Buffer.from(user.passwordHash, 'utf8'))) {
            throw new Error('Incorrect password.')
        }

        if(!user?.settings?.api){
            throw new Error('API access not allowed.')
        }

        let expiryInHours = 8 // Expire after x hours
        let expiryInSeconds = expiryInHours * 3600 // Convert to seconds
        let payload = jwtHelper.createPayload(user, {}, expiryInSeconds)
        let token = jwt.sign(payload, CRED.jwt.secret)
        res.send(token)
    } catch (err) {
        next(err)
    }
})

// API protected by JWT
router.use('/api/app', middlewares.api.requireJwt)

router.get('/api/app/icto-portal/faculty-list', async (req, res, next) => {
    try {

        let employmentTypes = req.query.employmentTypes
        if (!Array.isArray(employmentTypes)) {
            employmentTypes = [employmentTypes]
        }

        // Clean
        employmentTypes = employmentTypes.filter(e => {
            return ['permanent', 'cos', 'part-time'].includes(e)
        })

        let sort = {}
        sort['lastName'] = 1

        let query = {}
        // query[`lastName`] = ''
        query[`employments`] = {
            $elemMatch: {
                'active': true,
                'employmentType': {
                    $in: employmentTypes.length > 0 ? employmentTypes : ['permanent', 'cos', 'part-time']
                },
                'group': {
                    $in: ['faculty']
                }
            }
        }

        let project = {
            lastName: 1,
            firstName: 1,
            middleName: 1,
            suffix: 1,
            gender: 1,
            profilePhoto: 1,
            email: 1,
            address: 1,
            mobileNumber: 1,
            personal: {
                schools: 1,
                eligibilities: 1,
                workExperiences: 1,
            },
            employments: 1,
        }

        let aggr = []

        aggr.push({
            $lookup:
            {
                localField: "_id",
                foreignField: "employeeId",
                from: "employments",
                as: "employments"
            }
        })

        aggr.push({ $match: query })
        aggr.push({ $project: project })
        aggr.push({ $sort: sort })
        let employees = await req.app.locals.db.main.Employee.aggregate(aggr)


        const initials = (val) => {
            val = new String(val)
            val = val.replace(/(\s)+/, ' ').split(' ')
            val = val.map(word => {
                first = word.at(0)
                if (first === first?.toUpperCase()) {
                    return first
                }
                return ''
            })
            return val.join('.')
        }

        const acronym = (val) => {
            val = new String(val)
            val = val.replace(/(\s)+/,' ').split(' ')
            val = val.map(word => {
                first = word.at(0)
                if (first === first?.toUpperCase()){
                    return first
                }
                return ''
            })
            return val.join('')
        }

        employees = employees.map(e => {

            let schools = e.personal.schools ?? []
            let college = schools.find(o => {
                return o.level === 'College'
            })
            let masters = schools.find(o => {
                let course = o.course.replace(/(\s)+/g, ' ')
                return o.level === 'Graduate Studies' && /^(master)/i.test(course)
            })
            let doctoral = schools.find(o => {
                let course = o.course.replace(/(\s)+/g, ' ')
                return o.level === 'Graduate Studies' && /^(doctor)/i.test(course)
            })

            let employments = e.employments ?? []
            employments = employments.filter(o => {
                return o.active
            })
            let employment = employments.at(-1)

            return {
                key: `${e.firstName}|${e.middleName}|${e.lastName}|${e.suffix}`,
                profile: {
                    qualification: {
                        college: {
                            course_code: acronym(college?.course),
                            course_title: college?.course,
                            year_graduated: college?.yearGraduated
                        },
                        masters: {
                            course_code: acronym(masters?.course),
                            course_title: masters?.course,
                            year_graduated: masters?.yearGraduated
                        },
                        doctoral: {
                            course_code: acronym(doctoral?.course),
                            course_title: doctoral?.course,
                            year_graduated: doctoral?.yearGraduated
                        },
                    },
                    position: {
                        plantilla: (employment?.employmentType === 'permanent'),
                        title: employment?.position,
                        rate: employment?.salary ?? 0
                    },
                    addresses_contact: {
                        address: e.address,
                        email: e.email
                    },
                    id_num: e?.personal?.agencyEmployeeNumber ?? ''
                }
            }
        })

        res.send(employees)
    } catch (err) {
        next(err)
    }
})

router.get('/api/app/jwt/decode', async (req, res, next) => {
    try {
        res.send(res.jwtDecoded)
    } catch (err) {
        next(err)
    }
})

module.exports = router