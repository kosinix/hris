//// Core modules
const path = require('path')

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const middlewares = require('../middlewares');
const paginator = require('../paginator');

// Router
let router = express.Router()

router.use('/clinic', middlewares.requireAuthUser)

router.get(['/clinic/vax/all', '/clinic/vax/all.csv'], middlewares.guardRoute(['read_all_employee', 'read_employee']), async (req, res, next) => {
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
                    vaccines: 1,
                    pwdDetails: 1,
                },
                employments: 1,
            }
        })
      
        aggr.push({ $match: query })
        aggr.push({ $sort: sort })

        // Pagination
        let countDocuments = await req.app.locals.db.main.Employee.aggregate(aggr)
        let totalDocs = countDocuments.length
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/clinic/vax/all',
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
                let vaccines = lodash.get(i, 'personal.vaccines', []).map((v, a)=>{
                    return `Vaccine #${a+1}: ${v.name}  ${v.date}  ${v.sequence}  ${v.healthFacility}`
                })
                return `${index + 1}, ${lastName}, ${firstName}, ${middleName}, ${vaccines.join(' | ')}"`
            })
            csv.unshift(`#, Last Name, First Name, Middle, Vaccines`)
            res.set('Content-Type', 'text/csv')
            return res.send(csv.join("\n"))
        }
        res.render('clinic/vax/all.html', data);
    } catch (err) {
        next(err);
    }
});

router.use('/e/clinic', middlewares.requireAuthUser)

router.get('/e/clinic/home', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let data = {
            flash: flash.get(req, 'employee'),

            employee: employee,
            momentNow: moment(),
        }
        res.render('e/clinic/home.html', data);
    } catch (err) {
        next(err);
    }
});

router.get('/e/clinic/hdf', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        // Today attendance
        let hd = await req.app.locals.db.main.HealthDeclaration.findOne({
            employeeId: employee._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        })

        let optionsSymptoms1 = [
            'fever',
            'cough',
            'loss of smell/taste',
            'headache',
            'sore throat',
        ]
        let optionsSymptoms2 = [
            'diarrhea',
            'runny nose',
            'vomitting',
            'others'
        ]
        let visitedMedicalFacilityPurposes = [
            'Patient',
            'Employee',
            'Others'
        ]
        res.render('e/clinic/hdf.html', {
            employee: employee,
            hd: hd,
            optionsSymptoms1: optionsSymptoms1,
            optionsSymptoms2: optionsSymptoms2,
            visitedMedicalFacilityPurposes: visitedMedicalFacilityPurposes,
            momentNow: moment(),
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e/clinic/hdf', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        // return res.send(req.body)
        let body = lodash.get(req, 'body')
        let def = { "temperature": "", "lastName": "", "firstName": "", "middleName": "", "age": "", "sex": "", "civilStatus": "", "address": "", "contactNumber": "", "department": "", "symptoms": [], "visitedMedicalFacility": "", "visitedMedicalFacilityPurposes": [], "suspectedCovidPatient": "", "suspectedCovidPatientDetails": "", "sickFamilyMembers": "", "sickFamilyMembersDetails": "" }
        body = lodash.merge(def, body)
        body = lodash.mapKeys(body, (v, key) => {
            if (key === 'temperature') {
                return 'tmp'
            }
            if (key === 'lastName') {
                return 'ln'
            }
            if (key === 'firstName') {
                return 'fn'
            }
            if (key === 'middleName') {
                return 'mn'
            }
            if (key === 'civilStatus') {
                return 'cs'
            }
            if (key === 'address') {
                return 'adr'
            }
            if (key === 'contactNumber') {
                return 'cnt'
            }
            if (key === 'department') {
                return 'dep'
            }
            if (key === 'symptoms') {
                return 'sym'
            }
            if (key === 'visitedMedicalFacility') {
                return 'vmf'
            }
            if (key === 'visitedMedicalFacilityPurposes') {
                return 'vmp'
            }
            if (key === 'suspectedCovidPatient') {
                return 'sus'
            }
            if (key === 'suspectedCovidPatientDetails') {
                return 'sud'
            }
            if (key === 'sickFamilyMembers') {
                return 'sfm'
            }
            if (key === 'sickFamilyMembersDetails') {
                return 'sfd'
            }
            return key
        })
        let qrCodes = []
        //HDF
        let qrData = {
            type: 3,
            employeeId: employee._id,
            frm: body
        }

        let check = false
        if (!check) {
            // Today attendance
            let hd = await req.app.locals.db.main.HealthDeclaration.findOne({
                employeeId: employee._id,
                createdAt: {
                    $gte: moment().startOf('day').toDate(),
                    $lt: moment().endOf('day').toDate(),
                }
            })
            if (hd) {
                throw new Error('You have already submitted a health declaration today.')
            } else {

                hd = new req.app.locals.db.main.HealthDeclaration({
                    employeeId: employee._id,
                    data: body
                })
                await hd.save()
                flash.ok(req, 'employee', 'Health declaration submitted.')
                return res.redirect('/e/clinic/home');
            }
        }

        qrData = Buffer.from(JSON.stringify(qrData)).toString('base64')

        qrData = qr.imageSync(qrData, { size: 5, type: 'png' }).toString('base64')
        qrCodes.push({
            data: qrData,
            employment: '',
            title: 'Health Declaration Form',
        })

        res.render('e/clinic/hdf-qr.html', {
            momentNow: moment(),
            employee: employee,
            qrCodes: qrCodes,
        });
    } catch (err) {
        next(err);
    }
});


router.get('/e/clinic/vax/all', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e/clinic/vax/all.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e/clinic/vax/create', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let body = lodash.get(req, 'body')
        let payload = {
            _id: req.app.locals.db.mongoose.Types.ObjectId(),
            name: body.name,
            date: body.date,
            sequence: body.sequence,
            healthFacility: body.healthFacility,
        }

        if(body.unvaxxed){
            payload = {
                _id: req.app.locals.db.mongoose.Types.ObjectId(),
                unvaxxed: true,
                name: 'Unvaxxed'
            }
        }
        let vaccines = lodash.get(employee, 'personal.vaccines', [])
        vaccines.push(payload)
        lodash.set(employee, 'personal.vaccines', vaccines)


        await req.app.locals.db.main.Employee.updateOne({
            _id: employee._id
        }, employee)

        res.send(payload)
    } catch (err) {
        next(err);
    }
});
router.post('/e/clinic/vax/delete', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let vaxId = lodash.get(req, 'body.vaxId')
        
        let vaccines = lodash.get(employee, 'personal.vaccines', [])
        let index = vaccines.findIndex(v=>{
            return v._id.toString() === vaxId
        })
        vaccines.splice(index, 1)
        lodash.set(employee, 'personal.vaccines', vaccines)

        await req.app.locals.db.main.Employee.updateOne({
            _id: employee._id
        }, employee)

        res.send({})
    } catch (err) {
        next(err);
    }
});
module.exports = router;