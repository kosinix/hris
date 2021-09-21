//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const payrollCalc = require('../payroll-calc');
const payrollTemplate = require('../payroll-template');
const excelGen = require('../excel-gen');
const uid = require('../uid');
const payrollJs = require('../../public/js/payroll');
const dtrHelper = require('../dtr-helper');

// Router
let router = express.Router()

router.use('/payroll', middlewares.requireAuthUser)

router.get('/payroll/all', middlewares.guardRoute(['read_all_payroll', 'read_payroll']), async (req, res, next) => {
    try {
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = parseInt(lodash.get(req, 'query.customSort'))
        lodash.set(req, 'session.pagination.perPage', perPage)

        let query = {}
        let projection = {}

        if (res.user.roles.includes('hrmo')) {
            query = {
                status: 1
            }
        } else if (res.user.roles.includes('accountant')) {
            query = {
                status: 2
            }
        } else if (res.user.roles.includes('cashier')) {
            query = {
                status: {
                    $in: [3, 4]
                }
            }
        }
        // Pagination
        let totalDocs = await db.main.Payroll.countDocuments(query)
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/payroll/all',
            req.query
        )

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        // console.log(query, projection, options, sort)

        let payrolls = await db.main.Payroll.find(query, projection, options).sort(sort).lean()

        let assignedUsers = []
        payrolls.forEach((payroll) => {
            assignedUsers.push(db.main.User.findOne({ _id: payroll.assignedTo }))
        })
        assignedUsers = await Promise.all(assignedUsers)
        // payrolls.forEach((payroll, i) => {
        //     payroll.scanners = scanners[i]
        // })
        payrolls = payrolls.map((payroll, i) => {
            payroll.count = payroll.rows.filter(r => r.type === 1).length
            payroll.assignedUser = assignedUsers[i]
            return payroll
        })

        res.render('payroll/all.html', {
            flash: flash.get(req, 'payroll'),
            payrolls: payrolls,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/payroll/create', middlewares.guardRoute(['create_payroll']), async (req, res, next) => {
    try {

        let employeeLists = await db.main.EmployeeList.find()

        res.render('payroll/create.html', {
            employeeLists: employeeLists.filter(o => o.tags.includes('Fund Source')).map((o) => {
                return {
                    value: o._id,
                    text: o.name
                }
            })
        });
    } catch (err) {
        next(err);
    }
});
router.get('/payroll/generate', middlewares.guardRoute(['create_payroll']), async (req, res, next) => {
    try {

        res.render('payroll/generate.html');
    } catch (err) {
        next(err);
    }
});
router.post('/payroll/create', middlewares.guardRoute(['create_payroll']), async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        lodash.set(patch, 'name', lodash.get(body, 'name'))
        lodash.set(patch, 'template', lodash.get(body, 'template'))
        lodash.set(patch, 'dateStart', lodash.get(body, 'dateStart'))
        lodash.set(patch, 'dateEnd', lodash.get(body, 'dateEnd'))
        lodash.set(patch, 'employeeList', lodash.get(body, 'employeeList'))

        // 1. Get list members
        let list = await db.main.EmployeeList.findOne({
            _id: patch.employeeList
        }, { members: 1 })
        let members = lodash.get(list, 'members', [])

        // 2. From members, get employee and employment
        let employees = []
        let employments = []
        let attendances = []

        members.forEach((member, i) => {
            employees.push(db.main.Employee.findById(member.employeeId).lean())
            employments.push(db.main.Employment.findById(member.employmentId).lean())
            attendances.push(db.main.Attendance.find({
                employmentId: member.employmentId,
                createdAt: {
                    $gte: moment(patch.dateStart).startOf('day').toDate(),
                    $lt: moment(patch.dateEnd).endOf('day').toDate(),
                }
            }).lean())
        })

        employees = await Promise.all(employees)
        employments = await Promise.all(employments)
        attendances = await Promise.all(attendances)

        // 3. Get columns
        let columns = payrollTemplate.getColumns(patch.template)

        // 4. Format rows based on employee, employment, and columns for template, and attendance
        let rows = employees.map((employee, i) => {
            let employment = employments[i]

            // Generate cells
            let cells = columns.filter(o => o.computed === false)
            cells = cells.map(o => {
                return {
                    columnUid: o.uid,
                    value: 0
                }
            })

            // Get attendances based on payroll date range
            _attendances = attendances[i]

            // Attach computed values
            let totalMinutes = 0
            let totalMinutesUnderTime = 0
            let hoursPerDay = 8
            let travelPoints = 480
            for (let a = 0; a < _attendances.length; a++) {
                let attendance = _attendances[a] // daily
                let dtr = dtrHelper.calcDailyAttendance(attendance, hoursPerDay, travelPoints)
                totalMinutes += dtr.totalMinutes
                totalMinutesUnderTime += dtr.underTimeTotalMinutes
                _attendances[a].dtr = dtr
            }

            let timeRecord = dtrHelper.getTimeBreakdown(totalMinutes, totalMinutesUnderTime, hoursPerDay)

            return {
                uid: uid.gen(),
                type: 1,
                employment: employment,
                employee: employee,
                timeRecord: timeRecord,
                cells: cells,
                attendances: _attendances,
            }
        })

        if (patch.template === 'cos_staff') {
            // insert 
            rows.unshift({
                uid: uid.gen(),
                type: 3,
                employment: {},
                employee: {},
                timeRecord: {},
                cells: [],
                name: 'Title',
                attendances: [],
            })
        }

        rows.push({
            uid: uid.gen(),
            type: 4,
            employment: {},
            employee: {},
            timeRecord: {},
            cells: [],
            attendances: [],
        })
        // return res.send(rows)

        let payroll = {
            name: patch.name,
            dateStart: patch.dateStart,
            dateEnd: patch.dateEnd,
            rows: rows,
            columns: columns,
            template: patch.template,
            status: 1
        }

        payroll = await db.main.Payroll.create(payroll)
        // return res.send(payroll)

        flash.ok(req, 'payroll', `Created payroll "${payroll.name}".`)
        res.redirect(`/payroll/${payroll._id}`)
    } catch (err) {
        next(err);
    }
});
router.post('/payroll/generate', middlewares.guardRoute(['create_payroll']), async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        lodash.set(patch, 'name', lodash.get(body, 'name'))
        lodash.set(patch, 'dateStart', lodash.get(body, 'dateStart'))
        lodash.set(patch, 'dateEnd', lodash.get(body, 'dateEnd'))

        let profiles = [
            ['Permanent Faculty and Staff', 'permanent'],
            ['GAA NO ATM', 'cos_staff'],
            ['GAA ATM', 'cos_staff'],
            ['STF', 'cos_staff'],
            ['IGP', 'cos_staff'],
            ['COS Faculty and Part-timers', 'cos_staff'],
        ]
        for (let eIndex = 0; eIndex < profiles.length; ++eIndex) {
            let employeeList = profiles[eIndex][0]
            let template = profiles[eIndex][1]

            // 1. Get list members
            let list = await db.main.EmployeeList.findOne({
                name: employeeList
            }, { members: 1 })
            let members = lodash.get(list, 'members', [])

            // 2. From members, get employee and employment
            let employees = []
            let employments = []
            let attendances = []

            members.forEach((member, i) => {
                employees.push(db.main.Employee.findById(member.employeeId).lean())
                employments.push(db.main.Employment.findById(member.employmentId).lean())
                attendances.push(db.main.Attendance.find({
                    employmentId: member.employmentId,
                    createdAt: {
                        $gte: moment(patch.dateStart).startOf('day').toDate(),
                        $lt: moment(patch.dateEnd).endOf('day').toDate(),
                    }
                }).lean())
            })

            employees = await Promise.all(employees)
            employments = await Promise.all(employments)
            attendances = await Promise.all(attendances)

            // 3. Get columns
            let columns = payrollTemplate.getColumns(template)

            // 4. Format rows based on employee, employment, and columns for template, and attendance
            let rows = employees.map((employee, i) => {
                let employment = employments[i]

                // Generate cells
                let cells = columns.filter(o => o.computed === false)
                cells = cells.map(o => {
                    return {
                        columnUid: o.uid,
                        value: 0
                    }
                })

                // Get attendances based on payroll date range
                _attendances = attendances[i]

                // Attach computed values
                let totalMinutes = 0
                let totalMinutesUnderTime = 0
                let hoursPerDay = 8
                let travelPoints = 480
                for (let a = 0; a < _attendances.length; a++) {
                    let attendance = _attendances[a] // daily
                    let dtr = dtrHelper.calcDailyAttendance(attendance, hoursPerDay, travelPoints)
                    totalMinutes += dtr.totalMinutes
                    totalMinutesUnderTime += dtr.underTimeTotalMinutes
                    _attendances[a].dtr = dtr
                }

                let timeRecord = dtrHelper.getTimeBreakdown(totalMinutes, totalMinutesUnderTime, hoursPerDay)

                return {
                    uid: uid.gen(),
                    type: 1,
                    employment: employment,
                    employee: employee,
                    timeRecord: timeRecord,
                    cells: cells,
                    attendances: _attendances,
                }
            })

            if (template === 'cos_staff') {
                // insert 
                rows.unshift({
                    uid: uid.gen(),
                    type: 3,
                    employment: {},
                    employee: {},
                    timeRecord: {},
                    cells: [],
                    name: 'Title',
                    attendances: [],
                })
            }

            rows.push({
                uid: uid.gen(),
                type: 4,
                employment: {},
                employee: {},
                timeRecord: {},
                cells: [],
                attendances: [],
            })
            // return res.send(rows)

            let payroll = {
                name: `${patch.name} ${employeeList}`,
                dateStart: patch.dateStart,
                dateEnd: patch.dateEnd,
                rows: rows,
                columns: columns,
                template: template,
                status: 1,
            }

            payroll = await db.main.Payroll.create(payroll)
            // return res.send(payroll)

        }

        flash.ok(req, 'payroll', `Generated payroll group "${patch.name}".`)
        res.redirect(`/payroll/all`)
    } catch (err) {
        next(err);
    }
});

router.get(['/payroll/:payrollId', `/payroll/:payrollId/payroll.xlsx`], middlewares.guardRoute(['read_payroll']), middlewares.getPayroll, middlewares.lockPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()

        if (req.originalUrl.includes('.xlsx')) {
            payroll.rows = lodash.map(payroll.rows, (row) => {
                if (row.type === 1) {
                    row.cells = lodash.map(payroll.columns, (column) => {
                        return payrollJs.getCellValue(row, column, payrollJs.formulas[payroll.template])
                    })
                } else if (row.type === 2) {
                    row.cells = row.cells.map((cell) => {
                        let start = lodash.get(cell, 'range[0]', 0)
                        let length = lodash.get(cell, 'range[1]', payroll.rows.length)
                        return payrollJs.getSubTotal(cell.columnUid, [start, length], payroll, payrollJs.formulas)
                    })
                } else if (row.type === 3) {
                    row.cells = [row.name]
                }
                return row
            })
            // return res.send(payroll)

            let workbook = {}

            if (payroll.template === 'permanent') {
                workbook = await excelGen.templatePermanent(payroll)
            } else if (payroll.template === 'cos_staff') {
                workbook = await excelGen.templateCos2(payroll)
            }

            let buffer = await workbook.xlsx.writeBuffer();
            res.set('Content-Disposition', `attachment; filename="payroll.xlsx"`)
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            return res.send(buffer)
        }
        res.render('payroll/read.html', {
            flash: flash.get(req, 'payroll'),
            payroll: payroll,
            payrollJs: payrollJs.formulas[payroll.template],
            dtrHelper: dtrHelper,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/payroll/:payrollId/unlock', middlewares.guardRoute(['read_payroll', 'update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()
        let user = res.user.toObject()

        if (payroll.assignedTo._id.toString() === user._id.toString()) {
            payroll.assignedTo = null
            await db.main.Payroll.updateOne({ _id: payroll._id }, payroll)
            flash.ok(req, 'payroll', `Payroll "${payroll.name}" unlocked.`)

        } else {
            flash.error(req, 'payroll', `Cannot unlock.`)
        }

        res.redirect('/payroll/all')
    } catch (err) {
        next(err);
    }
});

router.get('/payroll/:payrollId/status', middlewares.guardRoute(['read_payroll', 'update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let status = lodash.get(req, 'query.status', 1)
        if ([1, 2, 3, 4].includes(status)) {
            throw new Error(`Invalid status ${status}`)
        }
        let payroll = res.payroll.toObject()
        let user = res.user.toObject()

        if (payroll.assignedTo._id.toString() === user._id.toString()) {
            let text = 'updated'
            if (status > payroll.status) {
                text = 'forwarded'
            } else if (status < payroll.status) {
                text = 'returned'
            }

            let target = ''
            if(status == 1){
                target = ' to HR'
            } else if(status == 2){
                target = ' to Accounting'
            } else if(status == 3){
                target = ' to Cashier'
            } else if(status == 4){
                target = ' set to released'
            }
                
            payroll.assignedTo = null
            payroll.status = status
            await db.main.Payroll.updateOne({ _id: payroll._id }, payroll)

            flash.ok(req, 'payroll', `Payroll "${payroll.name}" ${text}${target}.`)
        } else {
            flash.error(req, 'payroll', `Cannot update.`)
        }

        res.redirect(`/payroll/all`)
    } catch (err) {
        next(err);
    }
});

router.post('/payroll/:payrollId/save', middlewares.guardRoute(['read_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()
        let body = lodash.get(req, 'body')
        let patch = {
            rows: lodash.get(body, 'rows')
        }

        let r = await db.main.Payroll.updateOne({ _id: payroll._id }, patch)

        res.send(`Payroll saved.`)
    } catch (err) {
        next(err);
    }
});

router.get(['/payroll/employees/:payrollId', `/payroll/employees/:payrollId/payroll.xlsx`], middlewares.guardRoute(['read_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()


        // return res.send(payroll)
        if (req.originalUrl.includes('.xlsx')) {
            // payroll.rows = lodash.map(payroll.rows, (row) => {
            //     if (row.type === 1) {
            //         row.cells = lodash.map(payroll.columns, (column) => {
            //             return payrollJs.getCellValue(row, column, payrollJs.formulas[payroll.template])
            //         })
            //     } else if (row.type === 2) {
            //         row.cells = row.cells.map((cell) => {
            //             let start = lodash.get(cell, 'range[0]', 0)
            //             let length = lodash.get(cell, 'range[1]', payroll.rows.length)
            //             return payrollJs.getSubTotal(cell.columnUid, [start, length], payroll, payrollJs.formulas)
            //         })
            //     } else if (row.type === 3) {
            //         row.cells = [row.name]
            //     }
            //     return row
            // })
            // return res.send(payroll)

            let workbook = {}

            if (payroll.template === 'permanent') {
                workbook = await excelGen.templatePermanent(payroll)
            } else if (payroll.template === 'cos_staff') {
                workbook = await excelGen.templateCos(payroll)
            }

            let buffer = await workbook.xlsx.writeBuffer();
            res.set('Content-Disposition', `attachment; filename="payroll.xlsx"`)
            res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            return res.send(buffer)
        }
        res.render('payroll/employees.html', {
            flash: flash.get(req, 'payroll'),
            payroll: payroll,
            payrollJs: payrollJs.formulas[payroll.template],
            dtrHelper: dtrHelper,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/payroll/employees/:payrollId', middlewares.guardRoute(['update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()

        let employmentId = lodash.get(req, 'body.employmentId')

        let row = await payrollCalc.addPayrollRow(payroll, employmentId)

        await db.main.Payroll.updateOne({ _id: payroll._id }, payroll)


        flash.ok(req, 'payroll', `Employee "${row.employee.firstName}" added to payroll "${payroll.name}".`)
        res.redirect(`/payroll/${payroll._id}`)

        // res.render('payroll/employee-add.html', {
        //     flash: flash.get(req, 'payroll'),
        //     payroll: payroll,
        // });
    } catch (err) {
        next(err);
    }
});

router.post('/payroll/:payrollId/sort-rows', middlewares.guardRoute(['update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()

        let body = req.body
        let oldIndex = lodash.get(body, 'oldIndex')
        let newIndex = lodash.get(body, 'newIndex')

        /*{# https://stackoverflow.com/a/6470794/1594918 #}*/
        /* Move array element from old to new index */
        let element = payroll.rows[oldIndex];
        payroll.rows.splice(oldIndex, 1);
        payroll.rows.splice(newIndex, 0, element);

        await db.main.Payroll.updateOne({ _id: payroll._id }, payroll)

        res.send('Sorting saved.')
    } catch (err) {
        next(err);
    }
});

router.post('/payroll/:payrollId/add-row', middlewares.guardRoute(['update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll
        let rowType = lodash.get(req, 'body.type')
        let row = {
            uid: uid.gen(),
            type: rowType,
            name: 'Title'
        }
        if ([2, 4].includes(rowType)) {
            row.cells = []
        }
        payroll.rows.push(row)
        await payroll.save()
        let payrollPlain = payroll.toObject()

        res.send(payrollPlain.rows[payrollPlain.rows.length - 1])
    } catch (err) {
        next(err);
    }
});
router.post('/payroll/:payrollId/delete-row', middlewares.guardRoute(['update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()

        let rowIndex = lodash.get(req, 'body.rowIndex')
        payroll.rows.splice(rowIndex, 1)
        let r = await db.main.Payroll.updateOne({ _id: payroll._id }, payroll)

        res.send(r)
    } catch (err) {
        next(err);
    }
});

router.get('/payroll/incentives/:payrollId', middlewares.guardRoute(['read_payroll', 'update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()

        res.render('payroll/incentives.html', {
            flash: flash.get(req, 'payroll'),
            payroll: payroll,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/payroll/incentives/:payrollId', middlewares.guardRoute(['read_payroll', 'update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll

        let incentive = req.body
        incentive._id = db.mongoose.Types.ObjectId()
        incentive.uid = lodash.camelCase(incentive.name)

        incentive.initialAmount = lodash.get(incentive, 'initialAmount', '0')
        incentive.initialAmount = incentive.initialAmount.replace(/,/g, '')
        incentive.initialAmount = lodash.toNumber(incentive.initialAmount)
        incentive.initialAmount = parseFloat(incentive.initialAmount)

        let result = lodash.find(payroll.incentives, (i) => {
            return i.uid === incentive.uid
        })
        if (result) {
            flash.error(req, 'payroll', `Incentive ${incentive.name} already present.`)
            return res.redirect(`/payroll/incentives/${payroll._id}`)
        }

        payroll.incentives.push(incentive)

        await payroll.save()
        flash.ok(req, 'payroll', `Added incentive to payroll.`)
        res.redirect(`/payroll/incentives/${payroll._id}`)

    } catch (err) {
        next(err);
    }
});

router.get('/payroll/deductions/:payrollId', middlewares.guardRoute(['read_payroll', 'update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll.toObject()

        res.render('payroll/deductions.html', {
            flash: flash.get(req, 'payroll'),
            payroll: payroll,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/payroll/deductions/:payrollId', middlewares.guardRoute(['read_payroll', 'update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll

        let deduction = req.body
        deduction._id = db.mongoose.Types.ObjectId()
        deduction.uid = lodash.camelCase(deduction.name)
        deduction.initialAmount = lodash.get(deduction, 'initialAmount', '0')
        deduction.initialAmount = deduction.initialAmount.replace(/,/g, '')
        deduction.initialAmount = lodash.toNumber(deduction.initialAmount)
        deduction.initialAmount = parseFloat(deduction.initialAmount)

        let result = lodash.find(payroll.deductions, (i) => {
            return i.uid === deduction.uid
        })
        if (result) {
            flash.error(req, 'payroll', `Deduction ${deduction.name} already present.`)
            return res.redirect(`/payroll/deductions/${payroll._id}`)
        }

        payroll.deductions.push(deduction)
        await payroll.save()

        flash.ok(req, 'payroll', `Added deduction to payroll.`)
        res.redirect(`/payroll/deductions/${payroll._id}`)

    } catch (err) {
        next(err);
    }
});

router.get('/payroll/update/:payrollId', middlewares.guardRoute(['read_payroll', 'update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {

        res.render('payroll/update.html', {
            payroll: res.payroll.toObject()
        });
    } catch (err) {
        next(err);
    }
});
router.post('/payroll/update/:payrollId', middlewares.guardRoute(['read_payroll', 'update_payroll']), middlewares.getPayroll, async (req, res, next) => {
    try {
        let payroll = res.payroll

        let body = req.body
        let patch = {}
        lodash.set(patch, 'name', lodash.get(body, 'name'))
        lodash.set(patch, 'dateStart', lodash.get(body, 'dateStart'))
        lodash.set(patch, 'dateEnd', lodash.get(body, 'dateEnd'))
        lodash.set(patch, 'template', lodash.get(body, 'template'))

        lodash.merge(payroll, patch)
        await payroll.save()

        flash.ok(req, 'payroll', `Updated payroll "${payroll.name}".`)
        res.redirect(`/payroll/update/${payroll._id}`)
    } catch (err) {
        next(err);
    }
});

module.exports = router;