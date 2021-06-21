//// Core modules
const fs = require('fs')

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
const middlewares = require('../middlewares');
const paginator = require('../paginator');
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

        if (['department', 'employmentType', 'group'].includes(customFilter)) {
            query[`employments.0.${customFilter}`] = customFilterValue
        }
        
        // Pagination
        let totalDocs = await db.main.Employee.countDocuments(query)
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/employee/all',
            req.query
        )

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)
        if (['department', 'employmentType', 'group'].includes(sortBy)) {
            sort[`employments.0.${sortBy}`] = sortOrder
        }
        

        console.log(query, projection, options, sort)

        let employees = await db.main.Employee.find(query, projection, options).sort(sort)

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
            throw new Error("Dupe")
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

        lodash.merge(employee, patch)
        await employee.save()
        flash.ok(req, 'employee', `Updated ${employee.firstName} ${employee.lastName}'s personal info.`)
        res.redirect(`/employee/employment/${employee._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/employee/employment/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('employee/employment.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/employment/:employeeId', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        let body = req.body
        let patch = {}

        lodash.set(patch, 'employments.0._id', db.mongoose.Types.ObjectId())
        lodash.set(patch, 'employments.0.campus', lodash.get(body, 'campus'))
        lodash.set(patch, 'employments.0.group', lodash.get(body, 'group'))
        lodash.set(patch, 'employments.0.position', lodash.get(body, 'position'))
        lodash.set(patch, 'employments.0.department', lodash.get(body, 'department'))
        lodash.set(patch, 'employments.0.employmentType', lodash.get(body, 'employmentType'))
        lodash.set(patch, 'employments.0.salary', lodash.get(body, 'salary').replace(/,/g, ''))
        lodash.set(patch, 'employments.0.salaryType', lodash.get(body, 'salaryType'))
        lodash.set(patch, 'employments.0.fundSource', lodash.get(body, 'fundSource'))
        lodash.set(patch, 'employments.0.sssDeduction', lodash.get(body, 'sssDeduction'))

        lodash.merge(employee, patch)
        await employee.save()
        flash.ok(req, 'employee', `Updated "${employee.firstName} ${employee.lastName}'s" employment.`)
        res.redirect(`/employee/address/${employee._id}`)

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

        if (!body.psgc) {
            throw new Error('Invalid address.')
        }


        lodash.set(patch, 'addresses.0._id', db.mongoose.Types.ObjectId())
        lodash.set(patch, 'addresses.0.unit', lodash.get(body, 'unit'))
        lodash.set(patch, 'addresses.0.psgc', lodash.get(body, 'psgc'))
        lodash.set(patch, 'addressPermanent', lodash.get(patch, 'addresses.0._id'))
        let address = await db.main.Address.findOne({
            code: lodash.get(body, 'psgc', '')
        })
        if (address) {
            lodash.set(patch, 'addresses.0.full', lodash.get(address, 'full'))
            lodash.set(patch, 'address', lodash.get(address, 'full'))
        }

        lodash.merge(employee, patch)
        await employee.save()
        flash.ok(req, 'employee', `Updated ${employee.firstName} ${employee.lastName} address.`)
        res.redirect(`/employee/id-card/${employee._id}`)
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

module.exports = router;