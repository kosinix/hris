//// Core modules
const fs = require('fs')
const util = require('util')

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const middlewares = require('../middlewares');

// Router
let router = express.Router()

router.use('/department', middlewares.requireAuthUser)

// List
router.get('/department/all', middlewares.guardRoute(['read_all_employee', 'read_employee']), async (req, res, next) => {
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

        const departments = await req.app.locals.db.main.Department.aggregate([
            {
                $sort: {
                    _id: 1
                }
            },
            {
                $match: criteria
            },
        ])

        res.render('department/all.html', {
            flash: flash.get(req, 'department'),
            departments: departments,
        });
    } catch (err) {
        next(err);
    }
});
// C
router.get('/department/create', middlewares.guardRoute(['read_all_employee', 'read_employee']), async (req, res, next) => {
    try {
        let data = {

        }
        res.render(`department/create.html`, data)
    } catch (err) {
        next(err);
    }
});
router.post('/department/create', middlewares.guardRoute(['read_all_employee', 'read_employee']), async (req, res, next) => {
    try {
        let name = lodash.get(req, 'body.name')
        let acronym = lodash.get(req, 'body.acronym')
        let department = await req.app.locals.db.main.Department.create({
            name: name,
            acronym: acronym,
        })
        flash.ok(req, 'department', `Created ${name}.`)
        res.redirect(`/department/read/${department._id}`)
    } catch (err) {
        next(err);
    }
});

// RU
router.get('/department/read/:departmentId', middlewares.guardRoute(['read_all_employee', 'read_employee']), async (req, res, next) => {
    try {
        let departmentId = lodash.get(req, 'params.departmentId')
        let department = await req.app.locals.db.main.Department.findById(departmentId)
        if (!department) {
            throw new Error('Department not found.')
        }


        // return res.send(department)
        res.render('department/read.html', {
            flash: flash.get(req, 'department'),
            department: department,
        });
    } catch (err) {
        next(err);
    }
});
// U
router.get('/department/update/:departmentId', middlewares.guardRoute(['read_all_employee', 'update_employee']), async (req, res, next) => {
    try {
        let departmentId = lodash.get(req, 'params.departmentId')
        let department = await req.app.locals.db.main.Department.findById(departmentId)
        if (!department) {
            throw new Error('Department not found.')
        }

        // return res.send(department)

        res.render('department/department-list-update.html', {
            flash: flash.get(req, 'department'),
            department: department,
            pagination: {},
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/department/update/:departmentId', middlewares.guardRoute(['read_all_employee', 'update_employee']), async (req, res, next) => {
    try {
        let departmentId = lodash.get(req, 'params.departmentId')
        let department = await req.app.locals.db.main.Department.findById(departmentId)
        if (!department) {
            throw new Error('Department not found.')
        }


        department.name = lodash.get(req, 'body.name')
        department.tags = lodash.get(req, 'body.tags', [])
        if (!department.tags) {
            department.tags = []
        } else {
            department.tags = department.tags.split(',')
        }

        await req.app.locals.db.main.Department.updateOne({ _id: department._id }, department)

        flash.ok(req, 'department', `Updated ${department.name}.`)
        res.redirect(`/department/list/${department._id}`)
    } catch (err) {
        next(err);
    }
});
// D
router.delete('/department/delete/:departmentId', middlewares.guardRoute(['delete_employee']), async (req, res, next) => {
    try {
        let departmentId = lodash.get(req, 'params.departmentId')
        let department = await req.app.locals.db.main.Department.findById(departmentId)
        if (!department) {
            throw new Error('Department not found.')
        }

        await req.app.locals.db.main.Department.remove({ _id: department._id })

        res.send(`Deleted ${department.name}.`)
    } catch (err) {
        next(err);
    }
});



// Members Management
router.post('/department/members/:departmentId/add', middlewares.guardRoute(['create_employee']), async (req, res, next) => {
    try {
        let departmentId = lodash.get(req, 'params.departmentId')
        let department = await req.app.locals.db.main.Department.findById(departmentId).lean() // Plain obj
        if (!department) {
            throw new Error('Department not found.')
        }

        let employmentId = lodash.get(req, 'body.employmentId')
        let role = lodash.get(req, 'body.role', '')

        let matches = await req.app.locals.db.main.Department.find({
            _id: department._id,
            members: {
                $elemMatch: {
                    employmentId: employmentId
                }
            }
        })
        if (matches.length > 0) {
            throw new Error(`Duplicate entry.`)
        }

        let employment = await req.app.locals.db.main.Employment.findById(employmentId)
        if (!employment) {
            throw new Error('Employment not found.')
        }
        let employee = await req.app.locals.db.main.Employee.findById(employment.employeeId)
        if (!employee) {
            throw new Error('Employee not found.')

        }

        let payload = {
            _id: req.app.locals.db.mongoose.Types.ObjectId(),
            employeeId: employee._id,
            employmentId: employment._id,
            firstName: employee.firstName,
            middleName: employee.middleName,
            lastName: employee.lastName,
            suffix: employee.suffix,
            position: employment.position,
            role: role,
        }
        department.members.push(payload)

        await req.app.locals.db.main.Department.updateOne({ _id: department._id }, department)

        res.json(payload)
    } catch (err) {
        next(err);
    }
});
// D
router.delete('/department/members/:departmentId/delete/:memberId', middlewares.guardRoute(['create_employee']), async (req, res, next) => {
    try {
        let departmentId = lodash.get(req, 'params.departmentId')
        let department = await req.app.locals.db.main.Department.findById(departmentId).lean() // Plain obj
        if (!department) {
            throw new Error('Department not found.')
        }

        let memberId = lodash.get(req, 'params.memberId')

        let index = department.members.findIndex(e => e._id.toString() === memberId)
        if (index <= -1) {
            throw new Error("Member not found.")
        }

        let deleted = department.members.splice(index, 1)

        await req.app.locals.db.main.Department.updateOne({ _id: department._id }, department)

        console.log(`Deleted ${deleted[0].firstName} ${deleted[0].lastName}.`)
        res.send(deleted[0])
    } catch (err) {
        next(err);
    }
});
module.exports = router;