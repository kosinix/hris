//// Core modules
const fs = require('fs')
const util = require('util')

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const phAddress = require('ph-address')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const db = require('../db');
const excelGen = require('../excel-gen');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const passwordMan = require('../password-man');
const s3 = require('../aws-s3');

// Router
let router = express.Router()

router.use('/employee', middlewares.requireAuthUser)

router.get('/employee/all', middlewares.guardRoute(['read_all_employee', 'read_employee']), async (req, res, next) => {
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

        if (['department', 'employmentType', 'group', 'position', 'campus'].includes(customFilter)) {
            query[`employments.0.${customFilter}`] = customFilterValue
        }

        if (['permanent-faculty'].includes(customFilter)) {
            query[`employments.0.employmentType`] = 'permanent'
            query[`employments.0.group`] = 'faculty'
        }
        if (['permanent-staff'].includes(customFilter)) {
            query[`employments.0.employmentType`] = 'permanent'
            query[`employments.0.group`] = 'staff'
        }
        if (['cos-teaching'].includes(customFilter)) {
            query[`employments.0.employmentType`] = 'cos'
            query[`employments.0.group`] = 'faculty'
        }
        if (['cos-staff'].includes(customFilter)) {
            query[`employments.0.employmentType`] = 'cos'
            query[`employments.0.group`] = 'staff'
        }
        if (['part-time'].includes(customFilter)) {
            query[`employments.0.employmentType`] = 'part-time'
            query[`employments.0.group`] = 'faculty'
        }

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)
        if (['department', 'employmentType', 'group', 'position', 'campus'].includes(sortBy)) {
            sort[`employments.0.${sortBy}`] = sortOrder
        }

        // console.log(query, projection, options, sort)

        // let employees = await db.main.Employee.find(query, projection, options).sort(sort)
        let aggr = []

        aggr.push({
            $lookup:
            {
                from: "employments",
                localField: "_id",
                foreignField: "employeeId",
                as: "employments"
            }
        })
        aggr.push({ $match: query })
        aggr.push({ $sort: sort })

        // Pagination
        let countDocuments = await db.main.Employee.aggregate(aggr)
        let totalDocs = countDocuments.length
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/employee/all',
            req.query
        )

        if (!isNaN(perPage)) {
            aggr.push({ $skip: options.skip })
            aggr.push({ $limit: options.limit })
        }
        let employees = await db.main.Employee.aggregate(aggr)

        // console.log(util.inspect(aggr, false, null, true))

        // return res.send(employees)
        if (req.query.csv == 1) {
            let csv = employees.map((i) => {
                return `${i.lastName}, ${i.firstName}, ${i.middleName}, ${lodash.get(i, 'employments[0].position')}`
            })
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
            return res.render('employee/qr-codes.html', {
                flash: flash.get(req, 'employee'),
                employees: employees,
                pagination: pagination,
                query: req.query,
            });
        }
        res.render('employee/all.html', {
            flash: flash.get(req, 'employee'),
            employees: employees,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/employee/create', middlewares.guardRoute(['create_employee']), async (req, res, next) => {
    try {

        res.render('employee/create.html', {
        });
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

        // TODO: Check duplicate
        let matches = await db.main.Employee.find({
            firstName: patch.firstName,
            middleName: patch.middleName,
            lastName: patch.lastName,
        })
        if (matches.length > 0) {
            throw new Error("Duplicate entry")
        }

        let employee = new db.main.Employee(patch)
        await employee.save()
        flash.ok(req, 'employee', `Added ${employee.firstName} ${employee.lastName}.`)
        res.redirect(`/employee/employment/${employee._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/employee/personal/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
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
router.post('/employee/personal/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
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

        await db.main.Employee.updateOne({ _id: employee._id }, patch)

        flash.ok(req, 'employee', `Updated ${employee.firstName} ${employee.lastName}'s personal info.`)
        res.redirect(`/employee/personal/${employee._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/employee/employment/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentIndex = employee.employments.length

        res.render('employee/employment.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            employment: employee.employments[employmentIndex],
            employmentIndex: employmentIndex
        });
    } catch (err) {
        next(err);
    }
});

router.get('/employee/employment/:employeeId/create', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let workSchedules = await db.main.WorkSchedule.find().lean()
        workSchedules = workSchedules.map((w)=>{
            return {
                value: w._id,
                text: w.name
            }
        })

        res.render('employee/employment-create.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            workSchedules: workSchedules,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/employment/:employeeId/create', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
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
        lodash.set(patch, `salary`, lodash.get(body, 'salary').replace(/,/g, ''))
        lodash.set(patch, `salaryType`, lodash.get(body, 'salaryType'))
        lodash.set(patch, `fundSource`, lodash.get(body, 'fundSource'))
        lodash.set(patch, `sssDeduction`, lodash.get(body, 'sssDeduction'))
        lodash.set(patch, `workScheduleId`, lodash.get(body, 'workScheduleId'))

        let employment = new db.main.Employment(patch)
        await employment.save()

        flash.ok(req, 'employee', `Added to "${employee.firstName} ${employee.lastName}'s" employment.`)
        res.redirect(`/employee/employment/${employee._id}`)

    } catch (err) {
        next(err);
    }
});

router.get('/employee/employment/:employeeId/:employmentId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment

        let workSchedules = await db.main.WorkSchedule.find().lean()
        workSchedules = workSchedules.map((w)=>{
            return {
                value: w._id,
                text: w.name
            }
        })

        // return res.send(workSchedules)
        res.render('employee/employment-update.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            employment: employment.toObject(),
            workSchedules: workSchedules,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/employment/:employeeId/:employmentId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
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
        lodash.set(patch, `salary`, lodash.get(body, 'salary').replace(/,/g, ''))
        lodash.set(patch, `salaryType`, lodash.get(body, 'salaryType'))
        lodash.set(patch, `fundSource`, lodash.get(body, 'fundSource'))
        lodash.set(patch, `sssDeduction`, lodash.get(body, 'sssDeduction'))
        lodash.set(patch, `workScheduleId`, lodash.get(body, 'workScheduleId'))

        await db.main.Employment.updateOne({ _id: employment._id }, patch)

        flash.ok(req, 'employee', `Updated "${employee.firstName} ${employee.lastName}'s" employment.`)
        res.redirect(`/employee/employment/${employee._id}`)

    } catch (err) {
        next(err);
    }
});

router.get('/employee/employment/:employeeId/:employmentId/delete', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
    try {
        let employee = res.employee
        let employment = res.employment

        await employment.remove()

        flash.ok(req, 'employee', `Deleted "${employee.firstName} ${employee.lastName}'s" employment.`)
        res.redirect(`/employee/employment/${employee._id}`)
    } catch (err) {
        next(err);
    }
});


router.get('/employee/address/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        employee.address = await db.main.Address.findOneFullAddress({
            code: employee.addressPsgc
        })
        res.render('employee/address.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/address/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let body = req.body
        let patch = {}

        if (!body.psgc0) {
            throw new Error('Invalid address.')
        }

        // TODO: Should generate new id every save??
        lodash.set(patch, 'addresses.0._id', db.mongoose.Types.ObjectId())
        lodash.set(patch, 'addresses.0.unit', lodash.get(body, 'unit0'))
        lodash.set(patch, 'addresses.0.street', lodash.get(body, 'street0'))
        lodash.set(patch, 'addresses.0.village', lodash.get(body, 'village0'))
        lodash.set(patch, 'addresses.0.psgc', lodash.get(body, 'psgc0'))
        lodash.set(patch, 'addresses.0.zipCode', lodash.get(body, 'zipCode0'))
        lodash.set(patch, 'addressPermanent', lodash.get(patch, 'addresses.0._id'))
        let address0 = await db.main.Address.findOne({
            code: lodash.get(body, 'psgc0', '')
        })
        if (address0) {
            let full = res.employee.buildAddress(
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
        lodash.set(patch, 'addresses.1._id', db.mongoose.Types.ObjectId())
        lodash.set(patch, 'addresses.1.unit', lodash.get(body, 'unit1'))
        lodash.set(patch, 'addresses.1.street', lodash.get(body, 'street1'))
        lodash.set(patch, 'addresses.1.village', lodash.get(body, 'village1'))
        lodash.set(patch, 'addresses.1.psgc', lodash.get(body, 'psgc1'))
        lodash.set(patch, 'addresses.1.zipCode', lodash.get(body, 'zipCode1'))
        lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.1._id'))
        let address1 = await db.main.Address.findOne({
            code: lodash.get(body, 'psgc1', '')
        })
        if (address1) {
            let full = res.employee.buildAddress(
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

        await db.main.Employee.updateOne({ _id: employee._id }, patch)

        flash.ok(req, 'employee', `Updated ${employee.firstName} ${employee.lastName} address.`)
        res.redirect(`/employee/address/${employee._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/employee/passes/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        res.render('employee/passes.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/passes/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let body = req.body
        let passes = lodash.get(employee, 'passes', [])

        let pass = {
            type: body.type,
            createdAt: moment().toDate(),
            expiredAt: moment().add(1, 'days').toDate(),
        }
        passes.push(pass)
        employee.passes = passes
        await employee.save()
        flash.ok(req, 'employee', `Issued pass.`)
        res.redirect(`/employee/passes/${employee._id}`)
    } catch (err) {
        next(err);
    }
});


router.get('/employee/photo/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('employee/photo.html', {
            employee: employee
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/photo/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, fileUpload(), middlewares.handleExpressUploadMagic, async (req, res, next) => {
    try {
        let employee = res.employee

        employee.profilePhoto = lodash.get(req, 'saveList.photo[0]')
        await employee.save()
        flash.ok(req, 'employee', `Updated ${employee.firstName} ${employee.lastName} photo.`)
        res.redirect(`/employee/personal/${employee._id}`);
    } catch (err) {
        next(err);
    }
});
router.get('/employee/photo/:employeeId/delete', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()


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
        await db.main.Employee.updateOne({ _id: employee._id }, { profilePhoto: '' })

        flash.ok(req, 'employee', `"${employee.firstName} ${employee.lastName}" photo deleted.`)
        res.redirect(`/employee/photo/${employee._id}`);
    } catch (err) {
        next(err);
    }
});


router.get('/employee/id-card/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let qrCodeSvg = qr.imageSync(employee.uid, { size: 3, type: 'svg' })
        res.render('employee/id-card.html', {
            employee: employee,
            qrCodeSvg: qrCodeSvg,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/employee/find', middlewares.guardRoute(['create_employee', 'update_employee']), async (req, res, next) => {
    try {
        let code = req.query.code
        let employee = await db.main.Employee.findOne({
            uid: code
        })
        if (!employee) {
            throw new Error('Not found')
        }
        res.redirect(`/employee/personal/${employee._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/employee/user/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        employee.user = await db.main.User.findById(employee.userId)

        let username = passwordMan.genUsername(employee.firstName, employee.lastName)
        let password = passwordMan.randomString(8)

        res.render('employee/web-access.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            username: username,
            password: password,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/user/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        let body = req.body
        body.username = lodash.trim(lodash.get(body, 'username'))
        body.password = lodash.trim(lodash.get(body, 'password'))

        let salt = passwordMan.randomString(16)
        let passwordHash = passwordMan.hashPassword(body.password, salt)

        let employeeUser = await db.main.User.findById(employee.userId)
        if (employeeUser) { // Assoc user
            // Check username avail
            let found = await db.main.User.findOne({
                username: body.username,
                _id: {
                    $ne: employeeUser._id
                }
            })
            if (found) {
                flash.error(req, 'employee', `Username "${body.username}" already exists. Please choose a different one.`)
                return res.redirect(`/employee/user/${employee._id}`)
            }

            employeeUser.username = body.username
            employeeUser.salt = salt
            employeeUser.passwordHash = passwordHash
            await employeeUser.save()

        } else { // No assoc user

            // Check username avail
            let found = await db.main.User.findOne({
                username: body.username,
            })
            if (found) {
                flash.error(req, 'employee', `Username "${body.username}" already exists. Please choose a different one.`)
                return res.redirect(`/employee/user/${employee._id}`)
            }

            employeeUser = new db.main.User({
                passwordHash: passwordHash,
                salt: salt,
                roles: ["employee"],
                firstName: employee.firstName,
                middleName: employee.middleName,
                lastName: employee.lastName,
                username: body.username,
                active: true,
                permissions: [],
            });
            await employeeUser.save()
            employee.userId = employeeUser._id
            await employee.save()
        }

        flash.ok(req, 'employee', `Web access account created with username "${body.username}" and password "${body.password}".`)
        res.redirect(`/employee/user/${employee._id}`)

    } catch (err) {
        next(err);
    }
});

router.get('/employee/e201/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()


        res.render('employee/e201.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});
router.get('/employee/e201/:employeeId/pds', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let workbook = await excelGen.templatePds(employee)
        let buffer = await workbook.xlsx.writeBuffer();
        res.set('Content-Disposition', `attachment; filename="${employee.lastName}-PDS.xlsx"`)
        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.send(buffer)
    } catch (err) {
        next(err);
    }
});


router.post('/employee/user/:employeeId/password', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employeeUser = await db.main.User.findById(employee.userId)

        if (employeeUser) { // Assoc user
            let password = passwordMan.randomString(8)
            let passwordHash = passwordMan.hashPassword(password, employeeUser.salt)

            employeeUser.passwordHash = passwordHash
            await employeeUser.save()

            flash.ok(req, 'employee', `New password is "${password}". Please save as you will only see this once.`)

        } else { // No assoc user

            flash.error(req, 'employee', `No associated user.`)

        }

        res.redirect(`/employee/user/${employee._id}`)

    } catch (err) {
        next(err);
    }
});

router.get('/employee/delete/:employeeId', middlewares.guardRoute(['delete_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let employeePlain = employee.toObject()


        // Delete files on AWS S3
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'

        let promises = []

        let photo = employeePlain.profilePhoto
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
        lodash.each(employeePlain.documents, (document) => {
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

        await employee.remove()

        flash.ok(req, 'employee', `"${employeePlain.firstName} ${employeePlain.lastName}" deleted.`)
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
        let countDocuments = await db.main.Employee.aggregate(aggr)
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
        let employeeLists = await db.main.EmployeeList.aggregate(aggr)

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
        let employeeList = await db.main.EmployeeList.create({
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
                return db.main.Employment.findById(m.employmentId).lean()
            })
            employeeList.members = await Promise.all(promises)

            promises = []
            promises = employeeList.members.map((m) => {
                return db.main.Employee.findById(m.employeeId).lean()
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
            await db.main.EmployeeList.updateOne({ _id: employeeList._id }, employeeList)
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

        await db.main.EmployeeList.updateOne({ _id: employeeList._id }, employeeList)

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

        await db.main.EmployeeList.remove({ _id: employeeList._id })

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

        let matches = await db.main.EmployeeList.find({
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

        let employment = await db.main.Employment.findById(employmentId)
        if (!employment) {
            throw new Error('Employment not found.')
        }
        let employee = await db.main.Employee.findById(employment.employeeId)
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

        await db.main.EmployeeList.updateOne({ _id: employeeList._id }, employeeList)


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

        await db.main.EmployeeList.updateOne({ _id: employeeList._id }, employeeList)

        flash.ok(req, 'employee', `Deleted ${deleted[0].firstName} ${deleted[0].lastName}.`)
        res.send('Deleted.')
    } catch (err) {
        next(err);
    }
});


module.exports = router;