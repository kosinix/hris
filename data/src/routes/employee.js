//// Core modules
const fs = require('fs')
const util = require('util')

//// External modules
const ExcelJS = require('exceljs')
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const address = require('../address')
const excelGen = require('../excel-gen')
const countries = require('../countries')
const mailer = require('../mailer')
const middlewares = require('../middlewares')
const paginator = require('../paginator')
const passwordMan = require('../password-man')
const suffixes = require('../suffixes')
const uploader = require('../uploader')
const { noCaps } = require('../utils')
const S3_CLIENT = require('../aws-s3-client')  // V3 SDK
const { patchHistory } = require('../historian')  // V3 SDK

// Router
let router = express.Router()

router.use('/employee', middlewares.requireAuthUser)

router.get(['/employee/all', '/employee/all.csv', '/employee/all.json', '/employee/active'], middlewares.guardRoute(['read_all_employee', 'read_employee']), async (req, res, next) => {
    try {
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = lodash.get(req, 'query.customSort')
        let customFilter = lodash.get(req, 'query.customFilter')
        let customFilterValue = lodash.get(req, 'query.customFilterValue')
        lodash.set(req, 'session.pagination.perPage', perPage)

        let search = lodash.get(req, 'query.s', '')

        // console.log(customFilter)
        // let u = new URLSearchParams(customFilter.map(s=>['customFilter',s]))
        // console.log(u.toString())

        let query = {}
        let projection = {}

        query[`employments`] = {
            $elemMatch: {
                'active': true
            }
        }

        if (['inactive'].includes(customFilter)) {
            query[`employments`] = {
                $elemMatch: {
                    'active': false
                }
            }
        } else if (['permanent-faculty'].includes(customFilter)) {
            query[`employments`] = {
                $elemMatch: {
                    $and: [
                        {
                            'employmentType': 'permanent'
                        },
                        {
                            'group': 'faculty'
                        },
                        {
                            'active': true
                        }
                    ]
                }
            }
        } else if (['permanent-staff'].includes(customFilter)) {
            query[`employments`] = {
                $elemMatch: {
                    $and: [
                        {
                            'employmentType': 'permanent'
                        },
                        {
                            'group': 'staff'
                        },
                        {
                            'active': true
                        }
                    ]
                }
            }
        } else if (['cos-teaching'].includes(customFilter)) {
            query[`employments`] = {
                $elemMatch: {
                    $and: [
                        {
                            'employmentType': 'cos'
                        },
                        {
                            'group': 'faculty'
                        },
                        {
                            'active': true
                        }
                    ]
                }
            }
        } else if (['cos-staff'].includes(customFilter)) {
            query[`employments`] = {
                $elemMatch: {
                    $and: [
                        {
                            'employmentType': 'cos'
                        },
                        {
                            'group': 'staff'
                        },
                        {
                            'active': true
                        }
                    ]
                }
            }
        } else if (['part-time'].includes(customFilter)) {
            query[`employments`] = {
                $elemMatch: {
                    $and: [
                        {
                            'employmentType': 'part-time'
                        },
                        {
                            'group': 'faculty'
                        },
                        {
                            'active': true
                        }
                    ]
                }
            }
        } else if (['casual'].includes(customFilter)) {
            query[`employments`] = {
                $elemMatch: {
                    $and: [
                        {
                            'employmentType': 'casual'
                        },
                        {
                            'group': 'staff'
                        },
                        {
                            'active': true
                        }
                    ]
                }
            }
        } else if (['pwd'].includes(customFilter)) {
            query[`personal.pwd`] = 'Yes'
        }

        let employmentsFilters = lodash.get(query, 'employments.$elemMatch.$and', [])
        if (req.query.campus) {
            employmentsFilters.push({
                'campus': `${req.query.campus}`.toLowerCase()
            })
            lodash.set(query, 'employments.$elemMatch.$and', employmentsFilters)
        }

        if (req.query.gender) {
            lodash.set(query, 'gender', req.query.gender)
        }

        // Filters
        // let employmentTypes = CONFIG.employmentTypes.map(o => o.value)
        // let filterEmploymentType = lodash.get(req, 'query.filterEmploymentType')
        // filterEmploymentType = (filterEmploymentType) ? filterEmploymentType.split(',').map(f => new String(f).trim()).filter(f => employmentTypes.includes(f)) : []
        // if (filterEmploymentType.length > 0) {
        //     query[`employments`] = {
        //         $elemMatch: {
        //             'employmentType': {
        //                 $in: filterEmploymentType
        //             }
        //         }
        //     }
        // }
        // console.log('filterEmploymentType', filterEmploymentType)
        // let query2 = {}
        // let filterEmploymentStatus = lodash.get(req, 'query.filterEmploymentStatus')
        // filterEmploymentStatus = (filterEmploymentStatus) ? filterEmploymentStatus.split(',').map(f => parseInt(f)).filter(f => [0, 1].includes(f)).map(f => (f === 0) ? false : true) : []
        // if (filterEmploymentStatus.length > 0) {
        //     query2[`employments`] = {
        //         $elemMatch: {
        //             'active': {
        //                 $in: filterEmploymentStatus
        //             }
        //         }
        //     }
        // }
        // console.log('filterEmploymentStatus', filterEmploymentStatus)

        // let filterEmploymentGroup = lodash.get(req, 'query.filterEmploymentGroup')
        // filterEmploymentGroup = (filterEmploymentGroup) ? filterEmploymentGroup.split(',').filter(f => ['staff', 'faculty'].includes(f)) : []
        // if (filterEmploymentGroup.length > 0) {
        //     query[`employments`] = {
        //         $elemMatch: {
        //             'group': {
        //                 $in: filterEmploymentGroup
        //             }
        //         }
        //     }
        // }
        // console.log('filterEmploymentGroup', filterEmploymentGroup)

        // let filterGender = lodash.get(req, 'query.filterGender')
        // filterGender = (filterGender) ? filterGender.split(',').filter(f => ['F', 'M'].includes(f)) : []
        // if (filterGender.length > 0) {
        //     query[`gender`] = {
        //         $in: filterGender
        //     }
        // }
        // console.log('filterGender', filterGender)



        if (search) {
            query = {}

            let words = search.split(' ')
            words = lodash.map(words, (o) => {
                o = lodash.trim(o)
                return new RegExp(o, "i")
            })

            query['$and'] = []

            // 1 word
            if (words.length === 1) {
                query['$and'].push({
                    $or: [
                        {
                            'firstName': words[0]
                        },
                        {
                            'lastName': words[0]
                        },
                    ],
                })
            } else if (words.length > 1) { // 2 or more words
                query['$and'].push({
                    $or: [
                        {
                            'firstName': words[0]
                        },
                        {
                            'lastName': words[1]
                        },
                        {
                            'firstName': words[1]
                        },
                        {
                            'lastName': words[0]
                        },
                    ],
                })
            }
        }

        if (req?.query?.letter) {
            let letter = req?.query?.letter
            if (!query['$and']) {
                query['$and'] = []
            }
            query['$and'].push({
                lastName: RegExp(`^${letter.at(0)}`, "i")
            })
            perPage = 1000
        }

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)
        if (['department', 'employmentType', 'group', 'position', 'campus'].includes(sortBy)) {
            sort[`employments.0.${sortBy}`] = sortOrder
        }

        if (req?.query?.letter) {
            sort = {}

            sort['lastName'] = 1
        }

        // console.log(query, projection, options, sort)

        // let employees = await req.app.locals.db.main.Employee.find(query, projection, options).sort(sort)
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
        aggr.push({
            $project:
            {
                lastName: 1,
                firstName: 1,
                middleName: 1,
                gender: 1,
                profilePhoto: 1,
                email: 1,
                mobileNumber: 1,
                personal: {
                    pwd: 1,
                    pwdDetails: 1
                },
                employments: 1,
                // Remove employees with 1 or more inactive employments
                // employments: {
                //     $filter:
                //     {
                //         input: "$employments",
                //         as: "employment",
                //         cond: { $eq: ["$$employment.active", true] }
                //     }
                // }
            }
        })
        // aggr.push({
        //     $match: {
        //         'employments.0': {
        //             $exists: true
        //         }
        //     }
        // })
        aggr.push({ $match: query })
        aggr.push({ $sort: sort })

        // Pagination
        let countDocuments = await req.app.locals.db.main.Employee.aggregate(aggr)
        let totalDocs = countDocuments.length
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/employee/all',
            req.query
        )

        if (!isNaN(perPage) && !req.originalUrl.includes('.csv')) { // No limit if perPage is invalid or when downloading CSV
            aggr.push({ $skip: options.skip })
            aggr.push({ $limit: options.limit })
        }
        let employees = await req.app.locals.db.main.Employee.aggregate(aggr)

        // console.log(util.inspect(aggr, false, null, true))

        if (customFilter === 'inactive') {
            employees = employees.filter((e, i) => {
                let active = e.employments.map(e => e.active).reduce((prev, current) => {
                    console.log(i, prev, current, (prev || current))
                    return prev || current
                }, false)
                return !active
            })
        }
        // return res.send(employees)
        let data = {
            flash: flash.get(req, 'employee'),
            employees: employees,
            pagination: pagination,
            query: req.query,
            s: search,
        }
        if (req.originalUrl.includes('.json') || req.xhr) {
            return res.json(data)
        }
        if (req.originalUrl.includes('.csv')) {

            let csv = employees.map((i, index) => {
                let lastName = i.lastName || ''
                let firstName = i.firstName || ''
                let middleName = i.middleName || ''
                let gender = i.gender || ''
                let email = i.email || ''
                let mobileNumber = i.mobileNumber || ''
                let pwdDetails = lodash.get(i, 'personal.pwdDetails', '') ?? ''
                let position = lodash.get(i, 'employments[0].position', '')
                let department = lodash.get(i, 'employments[0].department', '')
                let campus = lodash.get(i, 'employments[0].campus', '')
                let employmentType = lodash.capitalize(lodash.get(i, 'employments[0].employmentType', '')).replace(/^jo$/i, 'Job Order').replace(/^cos$/i, 'COS')
                let group = lodash.capitalize(lodash.get(i, 'employments[0].group', ''))
                mobileNumber = mobileNumber.replace(/^0/, '+63').replace(',', '')
                return `${index + 1}, ${lastName}, ${firstName}, ${middleName}, ${gender}, ${position}, ${department}, ${campus}, ${employmentType}, ${group}, ${email}, "${mobileNumber}", "${pwdDetails}"`
            })
            csv.unshift(`#, Last Name, First Name, Middle, Gender, Position, Department, Campus, Employment Type, Group, Email, Mobile Number, PWD ID`)
            res.set('Content-Type', 'text/csv')
            return res.send(csv.join("\n"))
        } else if (req.query.qr == 1) {
            let count = 0
            employees.forEach((employee, a) => {
                employee.employments.forEach((employment, b) => {
                    let qrData = {
                        type: 2,
                        employeeId: employee._id,
                        employmentId: employment._id
                    }
                    qrData = Buffer.from(JSON.stringify(qrData)).toString('base64')
                    // console.log(qrData)

                    qrData = qr.imageSync(qrData, { size: 4, type: 'png' }).toString('base64')

                    employees[a].employments[b].qrCode = {
                        count: ++count,
                        data: qrData,
                        employment: employment,
                        title: employment.position || 'Employment',
                    }
                })
            })
            return res.render('employee/qr-codes.html', data);
        }
        res.render('employee/all.html', data);
    } catch (err) {
        next(err);
    }
});

router.get('/employee/create', middlewares.guardRoute(['create_employee']), async (req, res, next) => {
    try {
        res.render('employee/create.html');
    } catch (err) {
        next(err);
    }
});
router.post('/employee/create', middlewares.guardRoute(['create_employee']), async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        lodash.set(patch, 'firstName', lodash.get(body, 'firstName'))
        lodash.set(patch, 'middleName', lodash.get(body, 'middleName'))
        lodash.set(patch, 'lastName', lodash.get(body, 'lastName'))
        lodash.set(patch, 'suffix', lodash.get(body, 'suffix'))
        lodash.set(patch, 'birthDate', lodash.get(body, 'birthDate'))
        lodash.set(patch, 'gender', lodash.get(body, 'gender'))
        lodash.set(patch, 'civilStatus', lodash.get(body, 'civilStatus'))
        lodash.set(patch, 'personal.agencyEmployeeNumber', lodash.get(body, 'agencyEmployeeNumber'))

        let matches = await req.app.locals.db.main.Employee.find({
            firstName: new RegExp(`^${lodash.trim(patch.firstName)}$`, "i"),
            lastName: new RegExp(`^${lodash.trim(patch.lastName)}$`, "i"),
        })
        if (matches.length > 0) {
            throw new Error(`Possible duplicate entry. There is already an employee with a name of "${patch.firstName} ${patch.lastName}"`)
        }

        let employee = new req.app.locals.db.main.Employee(patch)
        employee.createdBy = res.user._id
        await employee.save()

        await req.app.locals.db.main.EmployeeHistory.create({
            employeeId: employee._id,
            description: `Employee "${employee.lastName}, ${employee.firstName}" created by "${res.user.username}".`,
            alert: `text-success`,
            userId: res.user._id,
            username: res.user.username,
            op: 'c',
        })

        flash.ok(req, 'employee', `Added ${employee.firstName} ${employee.lastName}.`)
        res.redirect(`/employee/${employee._id}/employment`)
    } catch (err) {
        next(err);
    }
});

router.get('/employee/:employeeId/delete', middlewares.guardRoute(['delete_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        let data = {
            employee: employee,
        }
        res.render('employee/delete.html', data);
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/delete', middlewares.guardRoute(['delete_employee']), middlewares.antiCsrfCheck, middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        let r = await req.app.locals.db.main.Employee.findByIdAndDelete(employee._id)

        flash.ok(req, 'employee', `Deleted "${r.firstName} ${r.lastName}".`)

        res.redirect(`/employee/all`)
    } catch (err) {
        next(err);
    }
});

router.get('/employee/:employeeId/history', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        const history = await req.app.locals.db.main.EmployeeHistory.find({
            employeeId: employee._id
        })
        res.render('employee/history.html', {
            employee: employee,
            history: history,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/employee/history/all', middlewares.guardRoute(['read_employee']), async (req, res, next) => {
    try {
        const lastId = req.query?.lastId
        let criteria = {}
        if (lastId) {
            criteria = {
                _id: {
                    $lt: req.app.locals.db.mongoose.Types.ObjectId(lastId)
                }
            }
        }

        const history = await req.app.locals.db.main.EmployeeHistory.aggregate([
            {
                $sort: {
                    _id: -1
                }
            },
            {
                $match: criteria
            },
            {
                $limit: 10
            },
        ])

        res.render('employee/history/all.html', {
            history: history,
        });
    } catch (err) {
        next(err);
    }
});

// Personal
router.get('/employee/:employeeId/personal', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/personal.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/personal', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let body = req.body
        let patch = {
            firstName: lodash.get(body, 'firstName'),
            middleName: lodash.get(body, 'middleName'),
            lastName: lodash.get(body, 'lastName'),
            suffix: lodash.get(body, 'suffix'),
            birthDate: lodash.get(body, 'birthDate'),
            gender: lodash.get(body, 'gender'),
            civilStatus: lodash.get(body, 'civilStatus'),
            speechSynthesisName: lodash.get(body, 'speechSynthesisName'),
            'personal.agencyEmployeeNumber': lodash.get(body, 'agencyEmployeeNumber'),
        }

        let histories = patchHistory(patch, employee, res.user.username)

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: patch
        })
        if (histories.length) {
            await req.app.locals.db.main.EmployeeHistory.create({
                employeeId: employee._id,
                description: histories.join(', '),
                alert: `text-success`,
                userId: res.user._id,
                username: res.user.username,
                op: 'c',
            })
        }

        flash.ok(req, 'employee', `Updated employee's info.`)
        res.redirect(`/employee/${employee._id}/personal`)
    } catch (err) {
        next(err);
    }
});

// Employment
router.get('/employee/:employeeId/employment', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/employment/all.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            employments: employee.employments,
        });
    } catch (err) {
        next(err);
    }
});
// C
router.get('/employee/:employeeId/employment/create', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        let workSchedules = await req.app.locals.db.main.WorkSchedule.find().lean()
        workSchedules = workSchedules.map((w) => {
            return {
                value: w._id,
                text: w.name
            }
        })

        res.render('employee/employment/create.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            workSchedules: workSchedules,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/employment/create', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let body = req.body
        let patch = {}

        lodash.set(patch, `employeeId`, employee._id)
        lodash.set(patch, `campus`, lodash.get(body, 'campus'))
        lodash.set(patch, `group`, lodash.get(body, 'group'))
        lodash.set(patch, `position`, lodash.get(body, 'position'))
        lodash.set(patch, `department`, lodash.get(body, 'department'))
        lodash.set(patch, `employmentType`, lodash.get(body, 'employmentType'))
        lodash.set(patch, `employmentStart`, lodash.get(body, 'employmentStart'))
        lodash.set(patch, `salary`, lodash.get(body, 'salary').replace(/,/g, ''))
        lodash.set(patch, `salaryType`, lodash.get(body, 'salaryType'))
        lodash.set(patch, `fundSource`, lodash.get(body, 'fundSource'))
        lodash.set(patch, `sssDeduction`, lodash.get(body, 'sssDeduction'))
        lodash.set(patch, `workScheduleId`, lodash.get(body, 'workScheduleId'))

        let employment = new req.app.locals.db.main.Employment(patch)
        employment.createdBy = res.user._id
        await employment.save()

        await req.app.locals.db.main.EmployeeHistory.create({
            employeeId: employee._id,
            employmentId: employment._id,
            description: `Employment "${employment.position}" for "${employee.firstName} ${employee.lastName}" created by "${res.user.username}".`,
            alert: 'text-success',
            userId: res.user._id,
            username: res.user.username,
            op: 'c'
        })

        flash.ok(req, 'employee', `Added to "${employee.firstName} ${employee.lastName}'s" employment.`)
        res.redirect(`/employee/${employee._id}/employment`)

    } catch (err) {
        next(err);
    }
});
// RU
router.get('/employee/:employeeId/employment/:employmentId/update', middlewares.guardRoute(['read_employee', 'update_employee']), middlewares.getEmployee, middlewares.getEmploymentLean, async (req, res, next) => {
    try {
        let employee = res.employee
        let employment = res.employment

        let workSchedules = await req.app.locals.db.main.WorkSchedule.aggregate([
            {
                $match: {
                    $or: [
                        {
                            'members': {
                                $elemMatch: {
                                    'objectId': employment._id
                                }
                            }
                        },
                        {
                            'members': []
                        }
                    ]
                }
            },
        ])

        // Format for vue autocomplete
        workSchedules = workSchedules.map((w) => {
            return {
                id: w._id,
                name: w.name
            }
        })


        let data = {
            flash: flash.get(req, 'employee'),
            employee: employee,
            employment: employment,
            workSchedules: workSchedules,
        }
        // return res.send(data)
        res.render('employee/employment/update.html', data);
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/employment/:employmentId/update', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, middlewares.getEmploymentLean, async (req, res, next) => {
    try {
        let employee = res.employee
        let employment = res.employment
        let body = req.body

        let patch = {
            campus: lodash.get(body, 'campus'),
            group: lodash.get(body, 'group'),
            position: lodash.get(body, 'position'),
            department: lodash.get(body, 'department'),
            employmentType: lodash.get(body, 'employmentType'),
            employmentStart: lodash.get(body, 'employmentStart') || null,
            salary: parseFloat(lodash.get(body, 'salary').replace(/,/g, '')),
            salaryType: lodash.get(body, 'salaryType'),
            fundSource: lodash.get(body, 'fundSource'),
            sssDeduction: lodash.get(body, 'sssDeduction', null),
            workScheduleId: lodash.get(body, 'workScheduleId'),
            active: lodash.get(body, 'active') === 'true' ? true : false,
        }

        let histories = patchHistory(patch, employment, res.user.username)

        // return res.send(histories)
        await req.app.locals.db.main.Employment.updateOne({ _id: employment._id }, {
            $set: patch
        })
        if (histories.length) {
            await req.app.locals.db.main.EmployeeHistory.create({
                employeeId: employee._id,
                description: histories.join(', '),
                alert: `text-success`,
                userId: res.user._id,
                username: res.user.username,
                op: 'c',
            })
            flash.ok(req, 'employee', `Updated employment "${employment.position}".`)
        }

        res.redirect(`/employee/${employee._id}/employment`)

    } catch (err) {
        next(err);
    }
});
// D
router.get('/employee/:employeeId/employment/:employmentId/delete', middlewares.guardRoute(['delete_employee']), middlewares.getEmployee, middlewares.getEmploymentLean, async (req, res, next) => {
    try {
        let employee = res.employee
        let employment = res.employment

        res.render('employee/employment/delete.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            employment: employment,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/employment/:employmentId/delete', middlewares.guardRoute(['delete_employee']), middlewares.antiCsrfCheck, middlewares.getEmployee, middlewares.getEmploymentLean, async (req, res, next) => {
    try {
        let employee = res.employee
        let employment = res.employment

        await req.app.locals.db.main.EmployeeHistory.create({
            employeeId: employee._id,
            description: `Employment "${employment.position}" for "${employee.firstName} ${employee.lastName}" deleted by "${res.user.username}".`,
            alert: 'text-danger',
            userId: res.user._id,
            username: res.user.username,
            op: 'd',
        })
        await req.app.locals.db.main.Employment.deleteOne({
            _id: employment._id
        })

        flash.ok(req, 'employee', `Deleted "${employee.firstName} ${employee.lastName}'s" employment.`)
        res.redirect(`/employee/${employee._id}/employment`)
    } catch (err) {
        next(err);
    }
});

// Promote
// C
router.get('/employee/:employeeId/employment/:employmentId/promote', middlewares.guardRoute(['read_employee', 'update_employee']), middlewares.getEmployee, middlewares.getEmploymentLean, async (req, res, next) => {
    try {
        let employee = res.employee
        let employment = res.employment

        let workSchedules = await req.app.locals.db.main.WorkSchedule.find().lean()
        workSchedules = workSchedules.map((w) => {
            return {
                value: w._id,
                text: w.name
            }
        })

        // return res.send(workSchedules)
        res.render('employee/employment/promote.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            employment: employment,
            workSchedules: workSchedules,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/employment/:employmentId/promote', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, middlewares.getEmploymentLean, async (req, res, next) => {
    try {
        let employee = res.employee
        let employment = res.employment
        let body = req.body

        // Deactivate employment
        await req.app.locals.db.main.Employment.updateOne({ _id: employment._id }, {
            $set: {
                active: false,
                employmentEnd: moment(lodash.get(body, 'employmentStart')).subtract(1, 'day').endOf('day').toDate()
            }
        })


        // Create new
        let patch = {}
        lodash.set(patch, `employeeId`, employee._id)
        lodash.set(patch, `campus`, lodash.get(body, 'campus'))
        lodash.set(patch, `group`, lodash.get(body, 'group'))
        lodash.set(patch, `position`, lodash.get(body, 'position'))
        lodash.set(patch, `department`, lodash.get(body, 'department'))
        lodash.set(patch, `employmentType`, lodash.get(body, 'employmentType'))
        lodash.set(patch, `employmentStart`, lodash.get(body, 'employmentStart'))
        lodash.set(patch, `salary`, lodash.get(body, 'salary').replace(/,/g, ''))
        lodash.set(patch, `salaryType`, lodash.get(body, 'salaryType'))
        lodash.set(patch, `fundSource`, lodash.get(body, 'fundSource'))
        lodash.set(patch, `sssDeduction`, lodash.get(body, 'sssDeduction'))
        lodash.set(patch, `workScheduleId`, lodash.get(body, 'workScheduleId'))
        lodash.set(patch, `active`, true)

        await req.app.locals.db.main.Employment.create(patch)

        await req.app.locals.db.main.EmployeeHistory.create({
            employeeId: employee._id,
            employmentId: employment._id,
            description: `Employment "${patch.position}" for "${employee.firstName} ${employee.lastName}" created by "${res.user.username}".`,
            alert: 'text-success',
            userId: res.user._id,
            username: res.user.username,
            op: 'c',
        })

        flash.ok(req, 'employee', `Promoted "${employee.firstName} ${employee.lastName}'s" employment.`)
        res.redirect(`/employee/${employee._id}/employment`)

    } catch (err) {
        next(err);
    }
});

// Address
router.get('/employee/:employeeId/address', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/address.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/address', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = await req.app.locals.db.main.Employee.findById(res.employee._id)
        let body = req.body


        if (!body.psgc0) {
            throw new Error('Invalid address.')
        }

        let address0 = await req.app.locals.db.main.Address.findOne({
            code: lodash.get(body, 'psgc0', '')
        })
        let full = ''
        if (address0) {
            full = address.build(
                lodash.get(address0, 'unit'),
                lodash.get(address0, 'street'),
                lodash.get(address0, 'village'),
                lodash.get(address0, 'full'),
            )
        }

        let address1 = await req.app.locals.db.main.Address.findOne({
            code: lodash.get(body, 'psgc1', '')
        })
        if (address1) {
            full = address.build(
                lodash.get(address1, 'unit'),
                lodash.get(address1, 'street'),
                lodash.get(address1, 'village'),
                lodash.get(address1, 'full'),
            )
        }

        let id0 = lodash.get(employee, 'addresses.0._id')
        if (!id0) {
            id0 = req.app.locals.db.mongoose.Types.ObjectId()
        }
        let id1 = lodash.get(employee, 'addresses.1._id')
        if (!id1) {
            id1 = req.app.locals.db.mongoose.Types.ObjectId()
        }
        let patch = {
            'address': full,

            'addressPermanent': id0,
            'addresses.0._id': id0,
            'addresses.0.unit': lodash.get(body, 'unit0'),
            'addresses.0.street': lodash.get(body, 'street0'),
            'addresses.0.village': lodash.get(body, 'village0'),
            'addresses.0.psgc': lodash.get(body, 'psgc0'),
            'addresses.0.zipCode': lodash.get(body, 'zipCode0'),
            'addresses.0.full': lodash.get(address0, 'full'),
            'addresses.0.brgy': address0.name,
            'addresses.0.cityMun': address0.cityMunName,
            'addresses.0.province': address0.provName,

            'addressPresent': id1,
            'addresses.1._id': id1,
            'addresses.1.unit': lodash.get(body, 'unit1'),
            'addresses.1.street': lodash.get(body, 'street1'),
            'addresses.1.village': lodash.get(body, 'village1'),
            'addresses.1.psgc': lodash.get(body, 'psgc1'),
            'addresses.1.zipCode': lodash.get(body, 'zipCode1'),
            'addresses.1.full': address1?.full,
            'addresses.1.brgy': address1?.name,
            'addresses.1.cityMun': address1?.cityMunName,
            'addresses.1.province': address1?.provName,
        }

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: patch
        })

        flash.ok(req, 'employee', `Updated ${employee.firstName} ${employee.lastName} address.`)
        res.redirect(`/employee/${employee._id}/address`)
    } catch (err) {
        next(err);
    }
});

// Photo
router.get('/employee/:employeeId/photo', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/photo.html', {
            flash: flash.get(req, 'employee'),
            employee: employee
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/photo', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, middlewares.dataUrlToReqFiles(['photo']), middlewares.handleUpload({ allowedMimes: ["image/jpeg", "image/png"] }), async (req, res, next) => {
    try {
        let employee = res.employee

        // Delete files on AWS S3
        // because they are being replaced
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'
        let photo = employee.profilePhoto
        if (photo) {
            let objects = [
                { Key: `${bucketKeyPrefix}${photo}` },
                { Key: `${bucketKeyPrefix}tiny-${photo}` },
                { Key: `${bucketKeyPrefix}small-${photo}` },
                { Key: `${bucketKeyPrefix}medium-${photo}` },
                { Key: `${bucketKeyPrefix}large-${photo}` },
                { Key: `${bucketKeyPrefix}xlarge-${photo}` },
                { Key: `${bucketKeyPrefix}orig-${photo}` },
            ]
            await S3_CLIENT.deleteObjects(bucketName, objects)
        }

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                profilePhoto: lodash.get(req, 'saveList.photo[0]')
            }
        })

        flash.ok(req, 'employee', `Updated ${employee.firstName} ${employee.lastName} photo.`)
        res.redirect(`/employee/${employee._id}/personal`);
    } catch (err) {
        next(err);
    }
});

router.get('/employee/:employeeId/photo/delete', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/photo-delete-confirm.html', {
            flash: flash.get(req, 'employee'),
            employee: employee
        });
    } catch (err) {
        next(err);
    }
});

router.post('/employee/:employeeId/photo/delete', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, middlewares.antiCsrfCheck, async (req, res, next) => {
    try {
        let employee = res.employee

        // Delete files on AWS S3
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'

        let photo = employee.profilePhoto
        if (photo) {
            let objects = [
                { Key: `${bucketKeyPrefix}${photo}` },
                { Key: `${bucketKeyPrefix}tiny-${photo}` },
                { Key: `${bucketKeyPrefix}small-${photo}` },
                { Key: `${bucketKeyPrefix}medium-${photo}` },
                { Key: `${bucketKeyPrefix}large-${photo}` },
                { Key: `${bucketKeyPrefix}xlarge-${photo}` },
                { Key: `${bucketKeyPrefix}orig-${photo}` },
            ]
            await S3_CLIENT.deleteObjects(bucketName, objects)

            await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
                $set: {
                    profilePhoto: ''
                }
            })
            flash.ok(req, 'employee', `"${employee.firstName} ${employee.lastName}" photo deleted.`)

        }

        res.redirect(`/employee/${employee._id}/photo`);
    } catch (err) {
        next(err);
    }
});


router.get('/employee/find', middlewares.guardRoute(['create_employee', 'update_employee']), async (req, res, next) => {
    try {
        let code = req.query.code
        let employee = await req.app.locals.db.main.Employee.findOne({
            uid: code
        })
        if (!employee) {
            throw new Error('Not found')
        }
        res.redirect(`/employee/${employee._id}/personal`)
    } catch (err) {
        next(err);
    }
});

// User
router.get('/employee/:employeeId/user', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let onlineAccount = await req.app.locals.db.main.User.findById(employee.userId)

        let username = passwordMan.genUsername(employee.firstName, employee.lastName)
        let password = passwordMan.randomString(8)

        res.render('employee/online-account/all.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            onlineAccount: onlineAccount,
            username: username,
            password: password,
        });
    } catch (err) {
        next(err);
    }
});
router.get('/employee/:employeeId/user/create', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let onlineAccount = await req.app.locals.db.main.User.findById(employee.userId)
        if (onlineAccount) {
            flash.error(req, 'employee', 'Already have an account.')
            return res.redirect(`/employee/${employee._id}/user`)
        }

        let username = passwordMan.genUsername(employee.firstName, employee.lastName)
        let password = passwordMan.genPassphrase(3)

        res.render('employee/online-account/create.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            onlineAccount: onlineAccount,
            username: username,
            password: password,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/user/create', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        let body = req.body
        body.username = lodash.trim(lodash.get(body, 'username'))
        body.password = lodash.trim(lodash.get(body, 'password'))
        body.email = lodash.trim(lodash.get(body, 'email'))

        let salt = passwordMan.randomString(16)
        let passwordHash = passwordMan.hashPassword(body.password, salt)

        let employeeUser = await req.app.locals.db.main.User.findById(employee.userId)
        if (employeeUser) { // Associated user
            // Check username availability
            let found = await req.app.locals.db.main.User.findOne({
                username: body.username,
                _id: {
                    $ne: employeeUser._id
                }
            })
            if (found) {
                flash.error(req, 'employee', `Username "${body.username}" already exists. Please choose a different one.`)
                return res.redirect(`/employee/${employee._id}/user/create`)
            }

            // Check email availability
            let existingEmail = await req.app.locals.db.main.User.findOne({
                email: body.email,
                _id: {
                    $ne: employeeUser._id
                }
            })
            if (existingEmail) {
                flash.error(req, 'employee', `Email "${body.email}" already exists. Please choose a different one.`)
                return res.redirect(`/employee/${employee._id}/user/create`)
            }

            employeeUser.username = body.username
            employeeUser.salt = salt
            employeeUser.passwordHash = passwordHash
            employeeUser.createdBy = res.user._id
            await employeeUser.save()

        } else { // No associated user

            // Check username avail
            let found = await req.app.locals.db.main.User.findOne({
                username: body.username,
            })
            if (found) {
                flash.error(req, 'employee', `Username "${body.username}" already exists. Please choose a different one.`)
                return res.redirect(`/employee/${employee._id}/user/create`)
            }

            // Check email availability
            let existingEmail = await req.app.locals.db.main.User.findOne({
                email: body.email
            })
            if (existingEmail) {
                flash.error(req, 'employee', `Email "${body.email}" already exists. Please choose a different one.`)
                return res.redirect(`/employee/${employee._id}/user/create`)
            }

            employeeUser = new req.app.locals.db.main.User({
                passwordHash: passwordHash,
                salt: salt,
                roles: ["employee"],
                firstName: employee.firstName,
                middleName: employee.middleName,
                lastName: employee.lastName,
                username: body.username,
                email: body.email,
                active: true,
                permissions: [],
                createdBy: res.user._id,
            });
            await employeeUser.save()
            employee.userId = employeeUser._id

            await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
                $set: {
                    userId: employeeUser._id
                }
            })
        }
        let data = {
            to: employeeUser.email,
            firstName: employee.firstName,
            username: employeeUser.username,
            password: body.password,
            // loginUrl: `${CONFIG.app.url}/login?username=${employeeUser.username}`
        }

        await req.app.locals.db.main.EmployeeHistory.create({
            employeeId: employee._id,
            description: `User "${employeeUser.username}" created by "${res.user.username}".`,
            alert: `text-success`,
            userId: res.user._id,
            username: res.user.username,
            op: 'c',
        })

        let info = await mailer.send('verified.html', data)

        flash.ok(req, 'employee', `Account created with username "${body.username}" and password "${body.password}".`)
        res.redirect(`/employee/${employee._id}/receipt`)

    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/user/password', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let employeeUser = await req.app.locals.db.main.User.findById(employee.userId)

        if (employeeUser) { // Assoc user
            let password = passwordMan.randomString(8)
            let passwordHash = passwordMan.hashPassword(password, employeeUser.salt)

            employeeUser.passwordHash = passwordHash
            await employeeUser.save()

            flash.ok(req, 'employee', `New password is "${password}". Please save as you will only see this once.`)

        } else { // No assoc user

            flash.error(req, 'employee', `No associated user.`)

        }

        res.redirect(`/employee/${employee._id}/user`)

    } catch (err) {
        next(err);
    }
});
router.get('/employee/:employeeId/user/delete', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        employee.user = await req.app.locals.db.main.User.findById(employee.userId)

        res.render('employee/online-account/delete.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/user/delete', middlewares.guardRoute(['update_employee']), middlewares.antiCsrfCheck, middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let deleted = await req.app.locals.db.main.User.findByIdAndDelete(employee.userId)

        await req.app.locals.db.main.EmployeeHistory.create({
            employeeId: employee._id,
            description: `User "${deleted.username}" deleted by "${res.user.username}".`,
            alert: 'text-danger',
            userId: res.user._id,
            username: res.user.username,
            op: 'd',
        })

        flash.ok(req, 'employee', `Account "${deleted.username}" deleted.`)
        res.redirect(`/employee/${employee._id}/user`)

    } catch (err) {
        next(err);
    }
});

router.get('/employee/:employeeId/user/:userId/update', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let onlineAccount = await req.app.locals.db.main.User.findById(employee.userId)
        if (!onlineAccount) {
            flash.error(req, 'employee', 'Account do not exist.')
            return res.redirect(`/employee/${employee._id}/user`)
        }
        let username = passwordMan.genUsername(employee.firstName, employee.lastName)
        let password = passwordMan.randomString(8)

        res.render('employee/online-account/update.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            onlineAccount: onlineAccount,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/user/:userId/update', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let employeeUser = await req.app.locals.db.main.User.findById(employee.userId)
        if (!employeeUser) {
            flash.error(req, 'employee', 'Account do not exist.')
            return res.redirect(`/employee/${employee._id}/user`)
        }
        let body = req.body
        body.username = lodash.trim(lodash.get(body, 'username'))
        body.password = lodash.trim(lodash.get(body, 'password'))
        body.email = lodash.trim(lodash.get(body, 'email'))


        // Check username availability
        let existingUsername = await req.app.locals.db.main.User.findOne({
            username: body.username,
            _id: {
                $ne: employeeUser._id
            }
        })
        if (existingUsername) {
            let error = new Error(`Username "${body.username}" already exists. Please choose a different one.`)
            flash.error(req, 'employee', error.message)
            error.type = 'flash'
            error.redirect = `/employee/${employee._id}/user/${employeeUser._id}/update`
            throw error
        }

        // Check email availability
        let existingEmail = await req.app.locals.db.main.User.findOne({
            email: body.email,
            _id: {
                $ne: employeeUser._id
            }
        })
        if (existingEmail) {
            let error = new Error(`Email "${body.email}" already exists. Please choose a different one.`)
            flash.error(req, 'employee', error.message)
            error.type = 'flash'
            error.redirect = `/employee/${employee._id}/user/${employeeUser._id}/update`
            throw error
        }

        let messages = []
        if (employeeUser.username !== body.username) {
            messages.push('username')
            employeeUser.username = body.username
        }
        if (body.password) {
            messages.push('password')
            employeeUser.passwordHash = passwordMan.hashPassword(body.password, employeeUser.salt)
        }
        if (employeeUser.email !== body.email) {
            messages.push('email')
            employeeUser.email = body.email
        }
        await employeeUser.save()

        if (messages.length > 0) {
            flash.ok(req, 'employee', `Account ${messages.join(', ')} updated.`)
        } else {
            flash.ok(req, 'employee', `No changes.`)
        }
        res.redirect(`/employee/${employee._id}/user/${employeeUser._id}/update`)
    } catch (err) {
        next(err);
    }
});

// 
router.get('/employee/:employeeId/user/password-reset', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let onlineAccount = await req.app.locals.db.main.User.findById(employee.userId)
        if (!onlineAccount) {
            flash.error(req, 'employee', 'No user account.')
            return res.redirect(`/employee/${employee._id}/user`)
        }

        let username = passwordMan.genUsername(employee.firstName, employee.lastName)
        let password = passwordMan.genPassphrase(3)

        res.render('employee/online-account/password-reset.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            onlineAccount: onlineAccount,
            username: username,
            password: password,
        });
    } catch (err) {
        next(err);
    }
});
// check email look
router.get('/employee/:employeeId/user/password-reset-email-preview', middlewares.guardRoute(['read_employee']), async (req, res, next) => {
    try {
        let firstName = lodash.get(req, 'query.firstName', 'Juan')
        let email = lodash.get(req, 'query.email', 'juan@example.com')
        let username = lodash.get(req, 'query.username', 'juan.cruz')
        let password = lodash.get(req, 'query.password', passwordMan.genPassword(10))
        let loginUrl = lodash.get(req, 'query.loginUrl', `${CONFIG.app.url}/login`)
        res.render('emails/password-reset.html', {
            to: email,
            firstName: firstName,
            username: username,
            password: password,
            appUrl: `${CONFIG.app.url}`,
            loginUrl: loginUrl,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/user/password-reset', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        let body = req.body
        body.password = lodash.trim(lodash.get(body, 'password'))
        body.send = lodash.trim(lodash.get(body, 'send', ''))

        let salt = passwordMan.randomString(16)
        let passwordHash = passwordMan.hashPassword(body.password, salt)

        let employeeUser = await req.app.locals.db.main.User.findById(employee.userId)
        if (!employeeUser) { // Associated user
            throw new Error('User not found.')
        }

        employeeUser.salt = salt
        employeeUser.passwordHash = passwordHash
        let emailedLog = ``
        if (body.send === 'on') {
            emailedLog = `emailed to "${employeeUser.email}"`
            let data = {
                to: employeeUser.email,
                firstName: employee.firstName,
                username: employeeUser.username,
                password: body.password,
                loginUrl: `${CONFIG.app.url}/login?username=${employeeUser.username}`,
                previewText: `Greetings ${employee.firstName}! This is your HRIS username and password login...`,
            }
            let info = await mailer.send('password-reset.html', data)
            // console.log(info)
            flash.ok(req, 'employee', `Employee password updated and an email was sent to "${employeeUser.email}" with messageId: ${info.messageId}`)
        } else {
            flash.ok(req, 'employee', `Employee password updated.`)
        }
        await employeeUser.save()
        await req.app.locals.db.main.EmployeeHistory.create({
            employeeId: employee._id,
            description: `User "${employeeUser.username}" password ${emailedLog} updated by "${res.user.username}".`,
            alert: `text-info`,
            userId: res.user._id,
            username: res.user.username,
            op: 'u',
        })
        res.redirect(`/employee/${employee._id}/user`)
    } catch (err) {
        next(err);
    }
});

//
router.get('/employee/:employeeId/receipt', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let employments = await req.app.locals.db.main.Employment.find({
            employeeId: employee._id
        }).lean()

        let employment = employments.at(-1)


        let onlineAccount = await req.app.locals.db.main.User.findById(employee.userId)
        if (!onlineAccount) {
            flash.error(req, 'employee', `Need to create an online account.`)
            return res.redirect(`/employee/${employee._id}/user`)
        }
        if (!onlineAccount?.createdBy) {
            flash.error(req, 'employee', `Could not view receipt. Could not identify the user who created the employee account.`)
            return res.redirect(`/employee/${employee._id}/user`)
        }

        let createdBy = await req.app.locals.db.main.User.findById(onlineAccount.createdBy).lean()

        res.render('employee/online-account/receipt.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            employment: employment,
            onlineAccount: onlineAccount,
            title: `Employee ${employee.firstName} ${employee.lastName} Transaction Receipt`,
            createdBy: createdBy,
        });
    } catch (err) {
        next(err);
    }
});

// Documents
router.get('/employee/:employeeId/document/all', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/document/all.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});
// DL
router.get('/employee/:employeeId/document/pds', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        let workbook = await excelGen.templatePds(employee)
        let buffer = await workbook.xlsx.writeBuffer();
        res.set('Content-Disposition', `attachment; filename="${employee.lastName}-PDS.xlsx"`)
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.send(buffer)
    } catch (err) {
        next(err);
    }
});
// C
router.get('/employee/:employeeId/document/create', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        let data = {
            flash: flash.get(req, 'employee'),
            employee: employee,
        }
        res.render('employee/document/create.html', data);
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/document/create', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, fileUpload(), middlewares.handleUpload({ allowedMimes: ["image/jpeg", "image/png", "application/pdf", 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'] }), async (req, res, next) => {
    try {
        let employee = res.employee

        let name = lodash.get(req, 'body.name')
        let docType = lodash.get(req, 'body.docType')
        let patch = {
            documents: lodash.get(employee, 'documents', [])
        }
        patch.documents.push({
            name: name,
            key: lodash.get(req, 'saveList.document[0]'),
            mimeType: '',
            docType: docType,
        })
        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: patch
        })

        flash.ok(req, 'employee', `Uploaded document "${name} - ${docType}".`)
        res.redirect(`/employee/${employee._id}/document/all`);
    } catch (err) {
        next(err);
    }
});
// D
router.get('/employee/:employeeId/document/:documentId/delete', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, fileUpload(), middlewares.handleUpload({ allowedMimes: ["image/jpeg", "image/png"] }), async (req, res, next) => {
    try {
        let employee = res.employee
        let documentId = req.params.documentId

        let document = employee.documents.find(o => {
            return o._id.toString() === documentId
        })
        if (!document) {
            throw new Error('Document not found.')
        }
        // Delete files on AWS S3
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'
        let objectKey = document.key
        if (objectKey) {
            let objects = [
                { Key: `${bucketKeyPrefix}${objectKey}` },
                { Key: `${bucketKeyPrefix}tiny-${objectKey}` },
                { Key: `${bucketKeyPrefix}small-${objectKey}` },
                { Key: `${bucketKeyPrefix}medium-${objectKey}` },
                { Key: `${bucketKeyPrefix}large-${objectKey}` },
                { Key: `${bucketKeyPrefix}xlarge-${objectKey}` },
                { Key: `${bucketKeyPrefix}orig-${objectKey}` },
            ]
            await S3_CLIENT.deleteObjects(bucketName, objects)
        }

        let documents = employee.documents.filter(o => {
            return o._id.toString() !== documentId
        })

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                documents: documents
            }
        })

        flash.ok(req, 'employee', `Deleted document "${document.name} - ${document.docType}".`)
        res.redirect(`/employee/${employee._id}/document/all`);
    } catch (err) {
        next(err);
    }
});

// PDS
// NOTE: Make sure to also sync changes to routes/pds and view/e/pds
// PDS 1
router.get('/employee/:employeeId/pds/personal-info', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/pds/personal-info.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Personal Information`,
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        })
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/pds/personal-info', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let body = lodash.get(req, 'body')
        // return res.send(body)

        let patch = {
            firstName: lodash.get(body, 'firstName'),
            middleName: lodash.get(body, 'middleName'),
            lastName: lodash.get(body, 'lastName'),
            suffix: lodash.get(body, 'suffix'),
            birthDate: lodash.get(body, 'birthDate'),
            gender: lodash.get(body, 'gender'),
            civilStatus: lodash.get(body, 'civilStatus'),
            mobileNumber: lodash.get(body, 'mobileNumber'),
            phoneNumber: lodash.get(body, 'phoneNumber'),
            email: lodash.get(body, 'email'),

            'personal.birthPlace': noCaps(lodash.get(body, 'birthPlace')),
            'personal.height': lodash.get(body, 'height'),
            'personal.weight': lodash.get(body, 'weight'),
            'personal.bloodType': lodash.get(body, 'bloodType'),
            'personal.gsis': lodash.get(body, 'gsis'),
            'personal.sss': lodash.get(body, 'sss'),
            'personal.philHealth': lodash.get(body, 'philHealth'),
            'personal.tin': lodash.get(body, 'tin'),
            'personal.pagibig': lodash.get(body, 'pagibig'),
            'personal.agencyEmployeeNumber': lodash.get(body, 'agencyEmployeeNumber'),
            'personal.citizenship': lodash.get(body, 'citizenship', []),
            'personal.citizenshipCountry': lodash.get(body, 'citizenshipCountry', ''),
            'personal.citizenshipSource': lodash.get(body, 'citizenshipSource', [])
        }

        // TODO: Should generate new id every save??
        lodash.set(patch, 'addresses.0._id', req.app.locals.db.mongoose.Types.ObjectId())
        lodash.set(patch, 'addresses.0.unit', lodash.get(body, 'unit0'))
        lodash.set(patch, 'addresses.0.street', lodash.get(body, 'street0'))
        lodash.set(patch, 'addresses.0.village', lodash.get(body, 'village0'))
        lodash.set(patch, 'addresses.0.psgc', lodash.get(body, 'psgc0'))
        lodash.set(patch, 'addresses.0.zipCode', lodash.get(body, 'zipCode0'))
        lodash.set(patch, 'addressPermanent', lodash.get(patch, 'addresses.0._id'))
        let address0 = await req.app.locals.db.main.Address.findOne({
            code: lodash.get(body, 'psgc0', '')
        })
        if (address0) {
            let full = address.build(
                lodash.get(patch, 'addresses.0.unit'),
                lodash.get(patch, 'addresses.0.street'),
                lodash.get(patch, 'addresses.0.village'),
                lodash.get(address0, 'full'),
            )

            lodash.set(patch, 'address', full)
            lodash.set(patch, 'addresses.0.full', lodash.get(address0, 'full'))
            lodash.set(patch, 'addresses.0.brgy', address0.name)
            lodash.set(patch, 'addresses.0.cityMun', address0.cityMunName)
            lodash.set(patch, 'addresses.0.province', address0.provName)
        }

        // TODO: Should generate new id every save??
        lodash.set(patch, 'addresses.1._id', req.app.locals.db.mongoose.Types.ObjectId())
        lodash.set(patch, 'addresses.1.unit', lodash.get(body, 'unit1'))
        lodash.set(patch, 'addresses.1.street', lodash.get(body, 'street1'))
        lodash.set(patch, 'addresses.1.village', lodash.get(body, 'village1'))
        lodash.set(patch, 'addresses.1.psgc', lodash.get(body, 'psgc1'))
        lodash.set(patch, 'addresses.1.zipCode', lodash.get(body, 'zipCode1'))
        lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.1._id'))
        let address1 = await req.app.locals.db.main.Address.findOne({
            code: lodash.get(body, 'psgc1', '')
        })
        if (address1) {
            let full = address.build(
                lodash.get(patch, 'addresses.1.unit'),
                lodash.get(patch, 'addresses.1.street'),
                lodash.get(patch, 'addresses.1.village'),
                lodash.get(address1, 'full'),
            )
            lodash.set(patch, 'address', full)
            lodash.set(patch, 'addresses.1.full', lodash.get(address1, 'full'))
            lodash.set(patch, 'addresses.1.brgy', address1.name)
            lodash.set(patch, 'addresses.1.cityMun', address1.cityMunName)
            lodash.set(patch, 'addresses.1.province', address1.provName)
        }

        // return res.send(patch)
        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: patch
        })

        flash.ok(req, 'employee', `Personal Information updated..`)
        res.redirect(`/employee/${employee._id}/pds/family-background`)
    } catch (err) {
        next(err);
    }
});
// PDS 2
router.get('/employee/:employeeId/pds/family-background', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/pds/family-background.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Family Background`,
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        })
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/pds/family-background/children', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {

        let employee = res.employee
        let body = lodash.get(req, 'body')
        // return res.send(body)

        let children = lodash.get(body, 'children', [])
        children = children.map(o => {
            o.name = noCaps(o.name)
            return o
        })

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.children': children
            }
        })

        res.send(children)
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/pds/family-background/spouse', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let patch = lodash.get(req, 'body.spouse')

        patch.firstName = noCaps(patch.firstName)
        patch.middleName = noCaps(patch.middleName)
        patch.lastName = noCaps(patch.lastName)
        patch.occupation = noCaps(patch.occupation)

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.spouse': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/pds/family-background/father', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let patch = lodash.get(req, 'body.father')

        patch.firstName = noCaps(patch.firstName)
        patch.middleName = noCaps(patch.middleName)
        patch.lastName = noCaps(patch.lastName)

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.father': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/pds/family-background/mother', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let patch = lodash.get(req, 'body.mother')

        patch.firstName = noCaps(patch.firstName)
        patch.middleName = noCaps(patch.middleName)
        patch.lastName = noCaps(patch.lastName)

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.mother': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});
// PDS 3
router.get('/employee/:employeeId/pds/educational-background', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/pds/educational-background.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Educational Background`,
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        })
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/pds/educational-background', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let patch = lodash.get(req, 'body.schools', [])

        patch = patch.sort((a, b) => {
            try {
                let aFrom = parseInt(a.periodFrom)
                let bFrom = parseInt(b.periodFrom)
                if (aFrom > bFrom) {
                    return 1;
                }
                if (aFrom < bFrom) {
                    return -1;
                }
                return 0;
            } catch (err) {
                return 0
            }
        })

        patch = patch.map(o => {
            o.name = noCaps(o.name)
            o.course = noCaps(o.course)
            o.unitsEarned = noCaps(o.unitsEarned)
            o.honors = noCaps(o.honors)
            return o
        })

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.schools': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});

router.get('/employee/:employeeId/pds/csc-eligibility', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/pds/csc-eligibility.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - CSC Eligibility`,
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        });

    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/pds/csc-eligibility', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let patch = lodash.get(req, 'body.eligibilities', [])

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.eligibilities': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});

router.get('/employee/:employeeId/pds/work-experience', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/pds/work-experience.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Work Experience`,
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        });

    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/pds/work-experience', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let patch = lodash.get(req, 'body.workExperiences', [])

        patch = patch.sort((a, b) => {
            try {
                let aFrom = moment(a.fromDate).unix()
                let bFrom = moment(b.fromDate).unix()
                if (aFrom < bFrom) {
                    return 1;
                }
                if (aFrom > bFrom) {
                    return -1;
                }
                return 0;
            } catch (err) {
                return 0
            }
        })

        patch = patch.map(o => {
            o.positionTitle = noCaps(o.positionTitle)
            o.department = noCaps(o.department)
            o.appointmentStatus = noCaps(o.appointmentStatus)
            o.payGrade = noCaps(o.payGrade)
            return o
        })

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.workExperiences': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});

router.get('/employee/:employeeId/pds/voluntary-work', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/pds/voluntary-work.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Voluntary Work`,
            employee: employee,
            momentNow: moment(),
        })
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/pds/voluntary-work', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let patch = lodash.get(req, 'body.voluntaryWorks')

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.voluntaryWorks': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});

router.get('/employee/:employeeId/pds/learning-development', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/pds/learning-development.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Learning and Development`,
            employee: employee,
            momentNow: moment(),
        })
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/pds/learning-development', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let patch = lodash.get(req, 'body.trainings', [])

        patch = patch.sort((a, b) => {
            try {
                let aFrom = moment(a.fromDate).unix()
                let bFrom = moment(b.fromDate).unix()
                if (aFrom < bFrom) {
                    return 1;
                }
                if (aFrom > bFrom) {
                    return -1;
                }
                return 0;
            } catch (err) {
                return 0
            }
        })

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.trainings': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});

router.get('/employee/:employeeId/pds/other-info', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/pds/other-info.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Other Info`,
            employee: employee,
            momentNow: moment(),
        })
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/pds/other-info', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let patch = lodash.get(req, 'body.extraCurriculars', [])

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: {
                'personal.extraCurriculars': patch
            }
        })

        res.send(patch)
    } catch (err) {
        next(err);
    }
});

router.get('/employee/:employeeId/pds/more-info', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/pds/more-info.html', {
            flash: flash.get(req, 'employee'),
            title: `${res.locals.title} - Other Info`,
            employee: employee,
            momentNow: moment(),
        })
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/pds/more-info', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let body = lodash.get(req, 'body')
        // return res.send(body)

        let patch = {
            'personal.relatedThirdDegree': lodash.get(body, 'relatedThirdDegree'),
            'personal.relatedFourthDegree': lodash.get(body, 'relatedFourthDegree'),
            'personal.relatedFourthDegreeDetails': lodash.get(body, 'relatedFourthDegreeDetails'),
            'personal.guiltyAdmin': lodash.get(body, 'guiltyAdmin'),
            'personal.guiltyAdminDetails': lodash.get(body, 'guiltyAdminDetails'),
            'personal.criminalCharge': lodash.get(body, 'criminalCharge'),
            'personal.criminalChargeDetails': lodash.get(body, 'criminalChargeDetails'),
            'personal.criminalChargeDate': lodash.get(body, 'criminalChargeDate'),
            'personal.convicted': lodash.get(body, 'convicted'),
            'personal.convictedDetails': lodash.get(body, 'convictedDetails'),
            'personal.problematicHistory': lodash.get(body, 'problematicHistory'),
            'personal.problematicHistoryDetails': lodash.get(body, 'problematicHistoryDetails'),
            'personal.electionCandidate': lodash.get(body, 'electionCandidate'),
            'personal.electionCandidateDetails': lodash.get(body, 'electionCandidateDetails'),
            'personal.electionResigned': lodash.get(body, 'electionResigned'),
            'personal.electionResignedDetails': lodash.get(body, 'electionResignedDetails'),
            'personal.dualCitizen': lodash.get(body, 'dualCitizen'),
            'personal.dualCitizenDetails': lodash.get(body, 'dualCitizenDetails'),
            'personal.indigenousGroup': lodash.get(body, 'indigenousGroup'),
            'personal.indigenousGroupDetails': lodash.get(body, 'indigenousGroupDetails'),
            'personal.pwd': lodash.get(body, 'pwd'),
            'personal.pwdDetails': lodash.get(body, 'pwdDetails'),
            'personal.soloParent': lodash.get(body, 'soloParent'),
            'personal.soloParentDetails': lodash.get(body, 'soloParentDetails'),
            'personal.references': lodash.get(body, 'references', []),
            'personal.governmentId': lodash.get(body, 'governmentId'),
            'personal.governmentIdNumber': lodash.get(body, 'governmentIdNumber'),
            'personal.governmentIdDatePlace': lodash.get(body, 'governmentIdDatePlace'),
            'personal.datePdsFilled': lodash.get(body, 'datePdsFilled'),
            'personal.personAdministeringOath': lodash.get(body, 'personAdministeringOath'),
        }
        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, {
            $set: patch
        })

        flash.ok(req, 'employee', `PDS updated.`)

        res.redirect(`/employee/${employee._id}/pds/more-info`)
    } catch (err) {
        next(err);
    }
});
// EOF PDS

// Delete employee
router.get('/employee/delete/:employeeId', middlewares.guardRoute(['delete_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        // Delete files on AWS S3
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'

        let promises = []

        // Delete photo
        let photo = employee.profilePhoto
        if (photo) {
            let objects = [
                { Key: `${bucketKeyPrefix}${photo}` },
                { Key: `${bucketKeyPrefix}tiny-${photo}` },
                { Key: `${bucketKeyPrefix}small-${photo}` },
                { Key: `${bucketKeyPrefix}medium-${photo}` },
                { Key: `${bucketKeyPrefix}large-${photo}` },
                { Key: `${bucketKeyPrefix}xlarge-${photo}` },
                { Key: `${bucketKeyPrefix}orig-${photo}` },
            ]
            let promise = S3_CLIENT.deleteObjects(bucketName, objects)
            promises.push(promise)
        }

        // Requirements
        lodash.each(employee.documents, (document) => {
            lodash.each(document.files, (objectKey) => {
                let objects = [
                    { Key: `${bucketKeyPrefix}${objectKey}` },
                    { Key: `${bucketKeyPrefix}tiny-${objectKey}` },
                    { Key: `${bucketKeyPrefix}small-${objectKey}` },
                    { Key: `${bucketKeyPrefix}medium-${objectKey}` },
                    { Key: `${bucketKeyPrefix}large-${objectKey}` },
                    { Key: `${bucketKeyPrefix}xlarge-${objectKey}` },
                    { Key: `${bucketKeyPrefix}orig-${objectKey}` },
                ]
                let promise = S3_CLIENT.deleteObjects(bucketName, objects)

                promises.push(promise)
            })
        })

        await Promise.all(promises)

        let deleted = await req.app.locals.db.main.Employee.findByIdAndDelete(employee._id)

        flash.ok(req, 'employee', `"${deleted.firstName} ${deleted.lastName}" deleted.`)
        res.redirect(`/employee/all`);
    } catch (err) {
        next(err);
    }
});

module.exports = router;