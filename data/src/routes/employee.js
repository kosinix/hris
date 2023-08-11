//// Core modules
const fs = require('fs')
const util = require('util')

//// External modules
const ExcelJS = require('exceljs');
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const address = require('../address');
const excelGen = require('../excel-gen');
const mailer = require('../mailer');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const passwordMan = require('../password-man');
const s3 = require('../aws-s3');
const uploader = require('../uploader');

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
        if(req.query.campus){
            employmentsFilters.push({
                'campus': `${req.query.campus}`.toLowerCase()
            })
            lodash.set(query, 'employments.$elemMatch.$and', employmentsFilters)
        }

        if(req.query.gender){
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
        let patch = {}
        lodash.set(patch, 'firstName', lodash.get(body, 'firstName'))
        lodash.set(patch, 'middleName', lodash.get(body, 'middleName'))
        lodash.set(patch, 'lastName', lodash.get(body, 'lastName'))
        lodash.set(patch, 'suffix', lodash.get(body, 'suffix'))
        lodash.set(patch, 'birthDate', lodash.get(body, 'birthDate'))
        lodash.set(patch, 'gender', lodash.get(body, 'gender'))
        lodash.set(patch, 'civilStatus', lodash.get(body, 'civilStatus'))
        lodash.set(patch, 'speechSynthesisName', lodash.get(body, 'speechSynthesisName'))
        lodash.set(patch, 'personal.agencyEmployeeNumber', lodash.get(body, 'agencyEmployeeNumber'))

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

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
router.get('/employee/:employeeId/employment/:employmentId/update', middlewares.guardRoute(['read_employee', 'update_employee']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
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


        workSchedules = workSchedules.map((w) => {
            return {
                value: w._id,
                text: w.name
            }
        })

        // return res.send(workSchedules)
        res.render('employee/employment/update.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            employment: employment.toObject(),
            workSchedules: workSchedules,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/employment/:employmentId/update', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
    try {
        let employee = res.employee
        let employment = res.employment
        let body = req.body
        let patch = employment.toObject()

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
        lodash.set(patch, `active`, lodash.get(body, 'active'))

        await req.app.locals.db.main.Employment.updateOne({ _id: employment._id }, patch)

        flash.ok(req, 'employee', `Updated employment "${employment.position}".`)
        res.redirect(`/employee/${employee._id}/employment`)

    } catch (err) {
        next(err);
    }
});
// D
router.get('/employee/:employeeId/employment/:employmentId/delete', middlewares.guardRoute(['delete_employee']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
    try {
        let employee = res.employee
        let employment = res.employment.toObject()

        res.render('employee/employment/delete.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            employment: employment,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/employment/:employmentId/delete', middlewares.guardRoute(['delete_employee']), middlewares.antiCsrfCheck, middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
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
        await employment.remove()

        flash.ok(req, 'employee', `Deleted "${employee.firstName} ${employee.lastName}'s" employment.`)
        res.redirect(`/employee/${employee._id}/employment`)
    } catch (err) {
        next(err);
    }
});

// Promote
// C
router.get('/employee/:employeeId/employment/:employmentId/promote', middlewares.guardRoute(['read_employee', 'update_employee']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
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
            employment: employment.toObject(),
            workSchedules: workSchedules,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/employment/:employmentId/promote', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
    try {
        let employee = res.employee
        let employment = res.employment
        let body = req.body

        // Deactivate employment
        await req.app.locals.db.main.Employment.updateOne({ _id: employment._id }, {
            active: false,
            employmentEnd: moment(lodash.get(body, 'employmentStart')).subtract(1, 'day').endOf('day').toDate()
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
        let patch = {}

        if (!body.psgc0) {
            throw new Error('Invalid address.')
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

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

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
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'
        let photo = employee.profilePhoto
        if (photo) {
            await s3.deleteObjects({
                Bucket: bucketName,
                Delete: {
                    Objects: [
                        { Key: `${bucketKeyPrefix}${photo}` },
                        { Key: `${bucketKeyPrefix}tiny-${photo}` },
                        { Key: `${bucketKeyPrefix}small-${photo}` },
                        { Key: `${bucketKeyPrefix}medium-${photo}` },
                        { Key: `${bucketKeyPrefix}large-${photo}` },
                    ]
                }
            }).promise()
        }

        let patch = {
            profilePhoto: lodash.get(req, 'saveList.photo[0]')
        }
        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)
        flash.ok(req, 'employee', `Updated ${employee.firstName} ${employee.lastName} photo.`)
        res.redirect(`/employee/${employee._id}/personal`);
    } catch (err) {
        next(err);
    }
});
router.get('/employee/:employeeId/photo/delete', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee


        // Delete files on AWS S3
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'

        let promises = []

        let photo = employee.profilePhoto
        if (photo) {
            let promise = s3.deleteObjects({
                Bucket: bucketName,
                Delete: {
                    Objects: [
                        { Key: `${bucketKeyPrefix}${photo}` },
                        { Key: `${bucketKeyPrefix}tiny-${photo}` },
                        { Key: `${bucketKeyPrefix}small-${photo}` },
                        { Key: `${bucketKeyPrefix}medium-${photo}` },
                        { Key: `${bucketKeyPrefix}large-${photo}` },
                        { Key: `${bucketKeyPrefix}xlarge-${photo}` },
                        { Key: `${bucketKeyPrefix}orig-${photo}` },
                    ]
                }
            }).promise()

            promises.push(promise)
        }

        await Promise.all(promises)
        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, { profilePhoto: '' })

        flash.ok(req, 'employee', `"${employee.firstName} ${employee.lastName}" photo deleted.`)
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
        let password = passwordMan.genPassword()

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
            let patch = {
                userId: employeeUser._id
            }
            await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)
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
        let password = passwordMan.genPassword()

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
        if(!onlineAccount){
            flash.error(req, 'employee', `Need to create an online account.`)
            return res.redirect(`/employee/${employee._id}/user`)
        }
        if(!onlineAccount?.createdBy){
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
        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

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
            let resx = await s3.deleteObjects({
                Bucket: bucketName,
                Delete: {
                    Objects: [
                        { Key: `${bucketKeyPrefix}${objectKey}` },
                        { Key: `${bucketKeyPrefix}tiny-${objectKey}` },
                        { Key: `${bucketKeyPrefix}small-${objectKey}` },
                        { Key: `${bucketKeyPrefix}medium-${objectKey}` },
                        { Key: `${bucketKeyPrefix}large-${objectKey}` },
                    ]
                }
            }).promise()
            // console.log(resx)
        }

        let documents = employee.documents.filter(o => {
            return o._id.toString() !== documentId
        })
        await req.app.locals.db.main.Employee.updateOne({
            _id: employee._id
        }, {
            documents: documents
        })

        flash.ok(req, 'employee', `Deleted document "${document.name} - ${document.docType}".`)
        res.redirect(`/employee/${employee._id}/document/all`);
    } catch (err) {
        next(err);
    }
});

// Delete employee
router.get('/employee/delete/:employeeId', middlewares.guardRoute(['delete_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        // Delete files on AWS S3
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'

        let promises = []

        let photo = employee.profilePhoto
        if (photo) {
            let promise = s3.deleteObjects({
                Bucket: bucketName,
                Delete: {
                    Objects: [
                        { Key: `${bucketKeyPrefix}${photo}` },
                        { Key: `${bucketKeyPrefix}tiny-${photo}` },
                        { Key: `${bucketKeyPrefix}small-${photo}` },
                        { Key: `${bucketKeyPrefix}medium-${photo}` },
                        { Key: `${bucketKeyPrefix}large-${photo}` },
                        { Key: `${bucketKeyPrefix}xlarge-${photo}` },
                        { Key: `${bucketKeyPrefix}orig-${photo}` },
                    ]
                }
            }).promise()

            promises.push(promise)
        }

        // Requirements
        lodash.each(employee.documents, (document) => {
            lodash.each(document.files, (deadFile) => {
                let bucketKey = deadFile
                let promise = s3.deleteObjects({
                    Bucket: bucketName,
                    Delete: {
                        Objects: [
                            { Key: `${bucketKeyPrefix}${bucketKey}` },
                            { Key: `${bucketKeyPrefix}tiny-${bucketKey}` },
                            { Key: `${bucketKeyPrefix}small-${bucketKey}` },
                            { Key: `${bucketKeyPrefix}medium-${bucketKey}` },
                            { Key: `${bucketKeyPrefix}large-${bucketKey}` },
                            { Key: `${bucketKeyPrefix}xlarge-${bucketKey}` },
                            { Key: `${bucketKeyPrefix}orig-${bucketKey}` },
                        ]
                    }
                }).promise()

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


// List
router.get('/employee/list', middlewares.guardRoute(['read_all_employee', 'read_employee']), async (req, res, next) => {
    try {
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = lodash.get(req, 'query.customSort')
        let customFilter = lodash.get(req, 'query.customFilter')
        let customFilterValue = lodash.get(req, 'query.customFilterValue')
        lodash.set(req, 'session.pagination.perPage', perPage)

        let query = {}
        let projection = {}


        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)
        if (['name', 'count'].includes(sortBy)) {
            // sort[`employments.0.${sortBy}`] = sortOrder
        }

        // console.log(query, projection, options, sort)

        let aggr = []
        aggr.push({ $match: query })
        aggr.push({ $sort: sort })

        // Pagination
        let countDocuments = await req.app.locals.db.main.Employee.aggregate(aggr)
        let totalDocs = countDocuments.length
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/employee/list',
            req.query
        )

        if (!isNaN(perPage)) {
            aggr.push({ $skip: options.skip })
            aggr.push({ $limit: options.limit })
        }
        let employeeLists = await req.app.locals.db.main.EmployeeList.aggregate(aggr)

        // console.log(util.inspect(aggr, false, null, true))

        // return res.send(employees)

        res.render('employee/employee-list.html', {
            flash: flash.get(req, 'employee'),
            employeeLists: employeeLists,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});
// C
router.post('/employee/list', middlewares.guardRoute(['read_all_employee', 'read_employee']), async (req, res, next) => {
    try {
        let name = lodash.get(req, 'body.name')
        let employeeList = await req.app.locals.db.main.EmployeeList.create({
            name: name
        })
        flash.ok(req, 'employee', `Created ${name}.`)
        res.redirect(`/employee/list/${employeeList._id}`)
    } catch (err) {
        next(err);
    }
});
// RU
router.get('/employee/list/:employeeListId', middlewares.guardRoute(['read_all_employee', 'read_employee']), middlewares.getEmployeeList, async (req, res, next) => {
    try {
        let employeeList = res.employeeList.toObject()
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))

        if (['lastName', 'position'].includes(sortBy)) {
            employeeList.members.sort(function (a, b) {
                console.log(a, typeof a['_id'])
                var nameA = a[sortBy].toUpperCase(); // ignore upper and lowercase
                var nameB = b[sortBy].toUpperCase(); // ignore upper and lowercase
                if (nameA < nameB) {
                    return sortOrder * -1;
                }
                if (nameA > nameB) {
                    return sortOrder * 1;
                }
                // names must be equal
                return 0;
            });
        }


        let refresh = lodash.get(req, 'query.refresh', false)
        if (refresh) { // Rebuild list

            let promises = []
            promises = employeeList.members.map((m) => {
                return req.app.locals.db.main.Employment.findById(m.employmentId).lean()
            })
            employeeList.members = await Promise.all(promises)

            promises = []
            promises = employeeList.members.map((m) => {
                return req.app.locals.db.main.Employee.findById(m.employeeId).lean()
            })
            let employees = await Promise.all(promises)
            employeeList.members = employeeList.members.map((m, i) => {
                return {
                    employeeId: m.employeeId,
                    employmentId: m._id,
                    firstName: employees[i].firstName,
                    middleName: employees[i].middleName,
                    lastName: employees[i].lastName,
                    suffix: employees[i].suffix,
                    position: m.position,
                }
            })
            await req.app.locals.db.main.EmployeeList.updateOne({ _id: employeeList._id }, employeeList)
        }


        // return res.send(employeeList)

        res.render('employee/employee-list-read.html', {
            flash: flash.get(req, 'employee'),
            employeeList: employeeList,
            pagination: {},
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});
// U
router.get('/employee/list/:employeeListId/update', middlewares.guardRoute(['read_all_employee', 'update_employee']), middlewares.getEmployeeList, async (req, res, next) => {
    try {
        let employeeList = res.employeeList.toObject()

        // return res.send(employeeList)

        res.render('employee/employee-list-update.html', {
            flash: flash.get(req, 'employee'),
            employeeList: employeeList,
            pagination: {},
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/list/:employeeListId/update', middlewares.guardRoute(['read_all_employee', 'update_employee']), middlewares.getEmployeeList, async (req, res, next) => {
    try {
        let employeeList = res.employeeList.toObject()


        employeeList.name = lodash.get(req, 'body.name')
        employeeList.tags = lodash.get(req, 'body.tags', [])
        if (!employeeList.tags) {
            employeeList.tags = []
        } else {
            employeeList.tags = employeeList.tags.split(',')
        }

        await req.app.locals.db.main.EmployeeList.updateOne({ _id: employeeList._id }, employeeList)

        flash.ok(req, 'employee', `Updated ${employeeList.name}.`)
        res.redirect(`/employee/list/${employeeList._id}`)
    } catch (err) {
        next(err);
    }
});
// D
router.delete('/employee/list/:employeeListId', middlewares.guardRoute(['delete_employee']), middlewares.getEmployeeList, async (req, res, next) => {
    try {
        let employeeList = res.employeeList.toObject()

        await req.app.locals.db.main.EmployeeList.remove({ _id: employeeList._id })

        flash.ok(req, 'employee', `Deleted ${employeeList.name}.`)
        res.send('Deleted.')
    } catch (err) {
        next(err);
    }
});

// C
router.post('/employee/list/:employeeListId/member', middlewares.guardRoute(['create_employee']), middlewares.getEmployeeList, async (req, res, next) => {
    try {
        let employeeList = res.employeeList.toObject()

        let employmentId = lodash.get(req, 'body.employmentId')

        let matches = await req.app.locals.db.main.EmployeeList.find({
            _id: employeeList._id,
            members: {
                $elemMatch: {
                    employmentId: employmentId
                }
            }
        })
        if (matches.length > 0) {
            flash.error(req, 'employee', `Duplicate entry.`)
            return res.redirect(`/employee/list/${employeeList._id}`)
        }

        let employment = await req.app.locals.db.main.Employment.findById(employmentId)
        if (!employment) {
            throw new Error('Employment not found.')
        }
        let employee = await req.app.locals.db.main.Employee.findById(employment.employeeId)
        if (!employee) {
            throw new Error('Employee not found.')

        }

        employeeList.members.push({
            employeeId: employee._id,
            employmentId: employment._id,
            firstName: employee.firstName,
            middleName: employee.middleName,
            lastName: employee.lastName,
            suffix: employee.suffix,
            position: employment.position,
        })

        await req.app.locals.db.main.EmployeeList.updateOne({ _id: employeeList._id }, employeeList)


        flash.ok(req, 'employee', `Added ${employee.firstName} ${employee.lastName}.`)
        res.redirect(`/employee/list/${employeeList._id}`)
    } catch (err) {
        next(err);
    }
});
// D
router.delete('/employee/list/:employeeListId/member/:memberId', middlewares.guardRoute(['delete_employee']), middlewares.getEmployeeList, async (req, res, next) => {
    try {
        let employeeList = res.employeeList.toObject()

        let memberId = lodash.get(req, 'params.memberId')

        let index = employeeList.members.findIndex(e => e._id.toString() === memberId)
        if (index <= -1) {
            throw new Error("Member not found.")
        }

        let deleted = employeeList.members.splice(index, 1)

        await req.app.locals.db.main.EmployeeList.updateOne({ _id: employeeList._id }, employeeList)

        flash.ok(req, 'employee', `Deleted ${deleted[0].firstName} ${deleted[0].lastName}.`)
        res.send('Deleted.')
    } catch (err) {
        next(err);
    }
});


module.exports = router;