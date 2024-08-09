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

// Public API
router.post('/api/login', async (req, res, next) => {
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

        if (!user?.settings?.api) {
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
        aggr.push({
            $project: {
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
                employments: {
                    $filter: {
                        input: "$employments",
                        as: "employment",
                        cond: {
                            $and: [
                                { "$eq": ["$$employment.group", 'faculty'] },
                                { "$eq": ["$$employment.active", true] },
                            ]
                        },
                    }
                },
            }
        })
        aggr.push({ $sort: sort })
        let employees = await req.app.locals.db.main.Employee.aggregate(aggr)
        const acronym = (val) => {
            val = new String(val)
            val = val.replace(/(\s)+/, ' ').split(' ')
            val = val.map(word => {
                first = word.at(0)
                if (first === first?.toUpperCase()) {
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
            // Remove schools that have "N/A or na" as year graduated
            schools = schools.filter(o => {
                return !/^(N\/A|na)/i.test(o.yearGraduated)
            })
            let masters = schools.find(o => {
                let course = o.course.replace(/(\s)+/g, ' ')
                return o.level === 'Graduate Studies' && /^(master)/i.test(course)
            })
            let doctoral = schools.find(o => {
                let course = o.course.replace(/(\s)+/g, ' ')
                return o.level === 'Graduate Studies' && /^(doctor)/i.test(course)
            })

            // Get last
            let employments = e.employments ?? []
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

router.post('/api/app/biometric/scans', async (req, res, next) => {
    try {
        let momentNow = moment()

        let logs = req.body

        let todayLogs = logs[momentNow.format('YYYY-MM-DD')]
        if (todayLogs && Array.isArray(todayLogs)) {
            for (let x = 0; x < todayLogs.length; x++) {
                const [bid, date, time] = todayLogs[x]

                let momentThisLog = moment(`${date} ${time}`, 'YYYY-MM-DD hh:mm:ss A')

                // console.log(bid, date, time)

                // Get employee assoc with code
                let employee = await req.app.locals.db.main.Employee.findOne({
                    biometricsId: bid
                }).lean()
                if (!employee) {
                    console.error(`Error, user with biometrics ID ${bid} was not found.`)
                } else {

                    // Get all active employments
                    let employments = await req.app.locals.db.main.Employment.find({
                        employeeId: employee._id,
                        active: true,
                    }).lean()
                    if (employments.length <= 0) {
                        console.error(`Error, user ${employee.lastName} has no active employments.`)
                    } else {

                        // Log for every active employment
                        for (let c = 0; c < employments.length; c++) {
                            let employment = employments[c]

                            let attendance = await req.app.locals.db.main.Attendance.findOne({
                                employeeId: employee._id,
                                employmentId: employment._id,
                                createdAt: {
                                    $gte: momentThisLog.clone().startOf('day').toDate(),
                                    $lt: momentThisLog.clone().endOf('day').toDate(),
                                }
                            }).lean()

                            let logSource = {
                                type: 'biometric',
                            }

                            if (!attendance) {
                                console.log(`BID ${bid} ${employee.lastName} at ${date} ${time} no attendance for employment ${employment.position}... adding attendance`)
                                // console.log(momentThisLog.format('hh:mm:ss A'))

                                let logs = []
                                logs.push({
                                    dateTime: momentThisLog.toDate(),
                                    mode: 1, // 1 = in, 0 = out
                                    type: 'normal', // 'normal', 'wfh', 'travel', 'pass'
                                    source: logSource,
                                    createdAt: momentThisLog.toDate(),
                                })

                                attendance = await req.app.locals.db.main.Attendance.create({
                                    employeeId: employee._id,
                                    employmentId: employment._id,
                                    workScheduleId: employment.workScheduleId,
                                    type: 'normal',
                                    logs: logs,
                                })


                            } else {
                                console.log(`BID ${bid} ${employee.lastName} at ${date} ${time} HAVE attendance for employment ${employment.position}... adding logs`)
                                // console.log(momentThisLog.format('hh:mm:ss A'))


                                attendance.logs = attendance.logs.map(log => {
                                    log.dateTime = moment(log.dateTime).format('YYYY-MM-DD hh:mm:ss A')
                                    return log
                                })

                                // Removing dupes
                                let dupeCount = 0
                                attendance.logs = attendance.logs.filter((log, index, array) => {

                                    // Logic, loop on array
                                    // Find a datetime that is the same 
                                    // Look on all elements after the current element
                                    let i = array.findIndex((a, k) => {
                                        return log.dateTime === a.dateTime && k > index
                                    })
                                    if (i >= 0) {
                                        dupeCount++
                                    }
                                    return i < 0
                                })
                                // console.log(`Removed ${dupeCount} duplicates..`)

                                let found = attendance.logs.find((a, k) => {
                                    return momentThisLog.format('YYYY-MM-DD hh:mm:ss A') === a.dateTime
                                })
                                if (!found) {
                                    let lastLog = attendance.logs.at(-1)
                                    let mode = lastLog?.mode === 1 ? 0 : 1 // Toggle 1 or 0

                                    let log = {
                                        dateTime: momentThisLog.toDate(),
                                        mode: mode,
                                        type: 'normal', // 'normal', 'wfh', 'travel', 'pass'
                                        source: logSource,
                                        createdAt: momentThisLog.toDate(),
                                    }
                                    attendance.logs.push(log)

                                }

                                attendance.logs = attendance.logs.map(log => {
                                    log.dateTime = moment(log.dateTime, 'YYYY-MM-DD hh:mm:ss A').toDate()
                                    return log
                                })

                                // console.log(attendance.logs)

                                let dbOpRes = await req.app.locals.db.main.Attendance.collection.updateOne({
                                    _id: attendance._id
                                }, {
                                    $set: {
                                        logs: attendance.logs
                                    }
                                })

                                // console.log(`DB OP done, modified ${dbOpRes.modifiedCount} with matched count ${dbOpRes.matchedCount}`)

                            }
                        }

                    }
                }
            }
        }
        res.send('Scans uploaded.')
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