/**
 * Currently used by hybrid scanners to connect to server
 */

//// Core modules
const crypto = require('crypto')

//// External modules
const express = require('express')
const jwt = require('jsonwebtoken')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const middlewares = require('../middlewares')
const jwtHelper = require('../jwt-helper')
const passwordMan = require('../password-man')


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
        // if (CONFIG.loginDelay > 0) {
        //     await new Promise(resolve => setTimeout(resolve, CONFIG.loginDelay)) // Rate limit 
        // }
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

        let scanner = await req.app.locals.db.main.Scanner.findOne({ userId: user._id }).lean()
        // console.log('scanner', scanner)

        let expiryInHours = 8 // Expire after x hours
        let expiryInSeconds = expiryInHours * 3600 // Convert to seconds
        let payload = jwtHelper.createPayload(user, { scanner: scanner }, expiryInSeconds)
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
        const DATE_TO_PROCESS = (req.query?.date) ? moment(req.query.date) : moment()
        const SCANNER_CAMPUS = res?.jwtDecoded?.payload?.scanner?.campus

        // Employment IDs
        const WATCH_LIST = [
            '61513764e1d53f182a5d7e5d', // Martires Rodney
            '61513763e1d53f182a5d7b7b', // Nico Amarilla
            '61513764e1d53f182a5d7d0a', // Gabiota Mirhjan
        ]

        const SPECIAL_LIST = [
            '61513764e1d53f182a5d7c05', // Cajilig, Benjie
            '61513765e1d53f182a5d7e93', // Natividad, Lyssa
        ]

        let logs = req.body

        let stats = {
            ok: 0,
            skipped: 0,
            error: 0,
            out: []
        }

        let outsole = {
            log: l => stats.out.push(l),
            error: l => stats.out.push(l),
        }

        let employees = await req.app.locals.db.main.Employee.find({
            biometricsId: {
                $ne: null
            }
        }, {
            biometricsId: 1,
            biometricsCampusOverride: 1,
            biometricsCampusSelect: 1,
            lastName: 1,
            firstName: 1,
        }).lean()

        let employments_all = await req.app.locals.db.main.Employment.find({
            active: true,
        }).lean()
        employments_all = lodash.groupBy(employments_all, e => e.employeeId)

        // 

        // Avoid concurrent bugs
        let biometric1 = await req.app.locals.db.main.Option.findOne({
            key: 'biometric1'
        })
        if (!biometric1) {
            biometric1 = await req.app.locals.db.main.Option.create({
                key: 'biometric1',
                value: false
            })
        }
        if (biometric1.value) {
            return res.send('Ignored. Upload still running...')
        }

        const LOGS_TO_PROCESS = logs[DATE_TO_PROCESS.clone().format('YYYY-MM-DD')]
        if (LOGS_TO_PROCESS && Array.isArray(LOGS_TO_PROCESS)) {

            biometric1.value = true
            await biometric1.save()

            for (let x = 0; x < LOGS_TO_PROCESS.length; x++) {
                const [BID, DATE, TIME] = LOGS_TO_PROCESS[x]

                let momentThisLog = moment(`${DATE} ${TIME}`, 'YYYY-MM-DD hh:mm:ss A')

                // Get employee assoc with code
                let employee = employees.find(e => e.biometricsId === parseInt(BID))

                if (!employee) {
                    outsole.error(`${BID}, ______, ______, ${DATE}, ${TIME}, ______, ERROR-NOT_FOUND`)
                    stats.error++

                } else {

                    let EMP_NAME = `${employee.lastName}, ${employee.firstName?.split(' ')?.at(0)}`

                    // Get all active employments
                    let employments = lodash.get(employments_all, employee._id, [])
                    if (employments.length <= 0) {
                        outsole.error(`Error, user ${EMP_NAME} has no active employments.`)
                        stats.error++

                    } else {

                        // Log for every active employment
                        for (let c = 0; c < employments.length; c++) {
                            let employment = employments[c]

                            const BASE_LOG = `${BID}, ${EMP_NAME}, ${DATE}, ${TIME}, ${employment?.position}`

                            // console.log('campus', employment.campus, SCANNER_CAMPUS)
                            let cross_campus = false

                            // Log on other campus
                            if (employment.campus !== SCANNER_CAMPUS) {
                                cross_campus = true
                            }

                            if (employee?.biometricsCampusOverride) {
                                let biometricsCampusSelect = lodash.get(employee, 'biometricsCampusSelect', [])
                                if (biometricsCampusSelect.includes(SCANNER_CAMPUS)) {
                                    cross_campus = false
                                } else {
                                    cross_campus = true
                                }
                            } 
                            console.log(employee?.biometricsCampusOverride, SCANNER_CAMPUS, employee?.biometricsCampusSelect)

                            if (cross_campus) {
                                outsole.log(`${BASE_LOG}, SKIPPED-CROSSCAMPUS, from ${employment.campus} to ${SCANNER_CAMPUS}`)

                            } else {

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
                                    id: res.jwtDecoded.user._id,
                                    campus: SCANNER_CAMPUS
                                }

                                if (!attendance) {
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
                                        createdAt: momentThisLog.toDate(),
                                        updatedAt: momentThisLog.toDate(),
                                    })

                                    outsole.log(`${BASE_LOG}, CREATED-FIRST_LOG`)
                                    stats.ok++

                                    // Restore to data type that Mongo supports
                                    attendance.logs = attendance.logs.map(log => {
                                        log.dateTime = moment(log.dateTime, 'YYYY-MM-DD hh:mm:ss A').toDate()
                                        return log
                                    })

                                    req.app.locals.db.main.Attendance.collection.updateOne({
                                        _id: attendance._id
                                    }, {
                                        $set: {
                                            logs: attendance.logs
                                        }
                                    }).then(() => { }).catch(() => { })

                                } else {
                                    // Change from mongo date data type to string with datetime format
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

                                    let found = attendance.logs.find((a, k) => {
                                        return momentThisLog.format('YYYY-MM-DD hh:mm:ss A') === a.dateTime
                                    })
                                    if (found) {

                                        outsole.log(`${BASE_LOG}, SKIPPED-DUP`)
                                        stats.skipped++

                                    } else {
                                        const MAX_LOGS = 4
                                        if (attendance.logs.length >= MAX_LOGS) {

                                            outsole.log(`${BASE_LOG}, SKIPPED-MAX`)
                                            stats.skipped++

                                        } else {
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
                                            outsole.log(`${BASE_LOG}, CREATED-APPEND_LOG`)
                                            stats.ok++

                                            attendance.logs.sort(function (a, b) {
                                                var timeA = moment(a.dateTime).unix()
                                                var timeB = moment(b.dateTime).unix()
                                                if (timeA < timeB) {
                                                    return -1;
                                                }
                                                if (timeA > timeB) {
                                                    return 1;
                                                }
                                                // Must be equal
                                                return 0;
                                            });

                                            // Restore to data type that Mongo supports
                                            attendance.logs = attendance.logs.map(log => {
                                                log.dateTime = moment(log.dateTime, 'YYYY-MM-DD hh:mm:ss A').toDate()
                                                return log
                                            })



                                            req.app.locals.db.main.Attendance.collection.updateOne({
                                                _id: attendance._id
                                            }, {
                                                $set: {
                                                    logs: attendance.logs
                                                }
                                            }).then(() => { }).catch(() => { })

                                        }

                                    }

                                }
                            }
                        }

                    }
                }
            }
            biometric1.value = false
            await biometric1.save()
            outsole.log(`-------- THANK YOU --------`)
            return res.send(
                `\n-------- UPLOAD DONE | ${moment().format('MMM DD, YYYY hh:mm A')} | CREATED ${stats.ok} | SKIPPED ${stats.skipped} | ERROR ${stats.error} --------\n` +
                `${stats.out.join("\n")}`
            )
        }
        res.send(`${moment().format('MMM-DD-YYYY hh:mmA')}: No logs to upload.`)
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