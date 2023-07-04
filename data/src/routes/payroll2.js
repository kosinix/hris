//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const payrollCalc = require('../payroll-calc');
const payrollTemplate = require('../payroll-template');
const excelGen = require('../excel-gen');
const uid = require('../uid');
const payrollJs = require('../../public/js/payroll');
const dtrHelper = require('../dtr-helper');
const { AppError } = require('../errors');

// Router
let router = express.Router()

router.use('/payroll2', middlewares.requireAuthUser)

router.get('/payroll2/all', middlewares.guardRoute(['read_all_payroll', 'read_payroll']), async (req, res, next) => {
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
        let totalDocs = await req.app.locals.db.main.Payroll2.countDocuments(query)
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/payroll2/all',
            req.query
        )

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        // console.log(query, projection, options, sort)

        let payrolls = await req.app.locals.db.main.Payroll2.find(query, projection, options).sort(sort).lean()

        let assignedUsers = []
        payrolls.forEach((payroll) => {
            assignedUsers.push(req.app.locals.db.main.User.findOne({ _id: payroll.assignedTo }))
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

        res.render('payroll2/all.html', {
            flash: flash.get(req, 'payroll'),
            payrolls: payrolls,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/payroll2/generate', middlewares.guardRoute(['create_payroll']), async (req, res, next) => {
    try {
        return res.redirect('/payroll2/create')
        let workSchedules = await req.app.locals.db.main.WorkSchedule.find().lean()
        let data = {
            workSchedules: workSchedules
        }
        res.render('payroll/generate.html', data);
    } catch (err) {
        next(err);
    }
});

router.get('/payroll2/create', middlewares.guardRoute(['create_payroll']), async (req, res, next) => {
    try {
        let employeeLists = await req.app.locals.db.main.EmployeeList.find()
        res.render('payroll2/create.html', {
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
router.post('/payroll2/create', middlewares.guardRoute(['read_payroll']), async (req, res, next) => {
    try {
        let name = req.body?.name
        let template = req.body?.template
        let dateStart = req.body?.dateStart
        let dateEnd = req.body?.dateEnd
        let employeeListId = req.body?.employeeList

        let employeeList = await req.app.locals.db.main.EmployeeList.findById(employeeListId).lean();
        if (!employeeList) {
            throw new Error(`Employee list not found.`)
        }
        let members = employeeList.members

        let startMoment = moment(dateStart)
        let endMoment = moment(dateEnd)
        // console.log(startMoment)
        let options = {
            padded: true,
            showTotalAs: 'time',
            showWeekDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            periodWeekDays: 'All'
        }
        let rows = []
        for (let x = 0; x < members.length; x++) {
            // for (let x = 0; x < 20; x++) {
            let member = members[x]
            // console.log(member)

            let { days, stats, compute } = await dtrHelper.getDtrByDateRange6(req.app.locals.db, member.employeeId, member.employmentId, startMoment, endMoment, options)
            //throw 'aaa'
            let employments = await req.app.locals.db.main.Employment.aggregate([
                {
                    $match: {
                        _id: member.employmentId
                    }
                },
                {
                    $lookup: {
                        localField: 'employeeId',
                        foreignField: '_id',
                        from: 'employees',
                        as: 'employees'
                    }
                },
                {
                    $addFields: {
                        "employee": {
                            $arrayElemAt: ["$employees", 0]
                        }
                    }
                },
                {
                    $project: {
                        employees: 0,
                        employee: {
                            personal: 0,
                            employments: 0,
                            addresses: 0,
                        }
                    }
                }
            ])
            const precisionRound = (number, precision) => {
                var factor = Math.pow(10, precision);
                return Math.round(number * factor) / factor;
            }
            let employment = employments.at(-1)
            if (employment) {
                let employee = employment?.employee
                let perMinute = 0
                let totalWorkDays = 22
                let perMonth = 0

                let gross = 0.0
                let tardy = 0.0
                let grant = 0.0
                if (employment?.salaryType === 'monthly') {
                    perMinute = precisionRound((employment.salary / totalWorkDays / 8 / 60), 9)
                } else if (employment?.salaryType === 'daily') {
                    perMinute = precisionRound((employment.salary / 8 / 60), 9)
                } else if (employment?.salaryType === 'hourly') {
                    perMinute = precisionRound((employment.salary / 60), 9)
                }

                if (employment.employmentType === 'permanent') {
                    stats.weekdays.renderedDays += stats.holidays.renderedDays
                    stats.weekdays.renderedHours += stats.holidays.renderedHours
                    stats.weekdays.renderedMinutes += stats.holidays.renderedMinutes
                    stats.weekdays.totalMinutes += stats.holidays.totalMinutes
                    stats.weekdays.underTimeTotalMinutes += stats.holidays.underTimeTotalMinutes
                }
                gross = precisionRound(perMinute * stats.weekdays.totalMinutes, 9)
                tardy = precisionRound(perMinute * stats.weekdays.underTimeTotalMinutes, 9)
                grant = gross - tardy

                if (employment.employmentType === 'permanent') {
                    if (employment.salaryType === 'monthly') {
                        perMonth = employment.salary
                    }
                    gross = perMonth - tardy
                }
                rows.push({
                    uid: employment?._id,
                    rtype: 1,
                    sourceOfFund: employment?.department,
                    name: `${employee.lastName}, ${employee.firstName}`,
                    position: employment?.position,
                    wage: employment?.salary,
                    days: stats.weekdays.renderedDays,
                    hours: stats.weekdays.renderedHours,
                    minutes: stats.weekdays.renderedMinutes,
                    gross: gross,
                    tardy: tardy,
                    grant: grant,
                    // stats: stats,
                    // compute: compute,
                })
            }
        }

        // return res.send(rows)
        let payroll2 = await req.app.locals.db.main.Payroll2.create({
            name: name,
            template: template,
            dateStart: dateStart,
            dateEnd: dateEnd,
            employeeListId: employeeListId,
            rows: rows,
        })
        res.redirect(`/payroll2/view/${payroll2._id}`)
    } catch (err) {
        next(err);
    }
});
router.get('/payroll2/view/:payrollId', middlewares.guardRoute(['read_payroll']), async (req, res, next) => {
    try {
        let payroll = await req.app.locals.db.main.Payroll2.findById(req?.params?.payrollId).lean()
        if (!payroll) {
            throw new Error(`Payroll not found.`)
        }
        let counter = 0
        payroll.rows = payroll.rows.map((row) => {
            if (row.rtype === 1) {
                row.count = ++counter

                row.premium5 = row.premium5 ?? 0

                row.tax1 = row.tax1 ?? 0
                row.tax5 = row.tax5 ?? 0
                row.tax10 = row.tax10 ?? 0

                row.sss = row.sss ?? 0
                row.sssEC = row.sssEC ?? 0

                row.igp = row.igp ?? 0

                if(payroll.template === 'permanent'){
                    row.peraAca =  row.peraAca ?? 2000
                    
                    row.emergencyLoan = row.emergencyLoan ?? 0
                    row.eal = row.eal ?? 0
                    row.conso = row.conso ?? 0
                    row.ouliPremium = row.ouliPremium ?? 0
                    row.ouliPolicy = row.ouliPolicy ?? 0
                    row.regularPolicy = row.regularPolicy ?? 0
                    
                    row.gfal = row.gfal ?? 0
                    row.mpl = row.mpl ?? 0
                    row.cpl = row.cpl ?? 0
                    row.help = row.help ?? 0
                    row.medicare = row.medicare ?? 0
                    row.pagibig = row.pagibig ?? 0
                    row.mplLoan = row.mplLoan ?? 0
                    row.calamity = row.calamity ?? 0
                    row.withTax = row.withTax ?? 0

                    row.teachers = row.teachers ?? 0
                    row.ffa = row.ffa ?? 0
                    row.citySavings = row.citySavings ?? 0
                }
            }
            return row
        })
        res.render(`payroll2/table-payroll-${payroll.template}.html`, {
            payroll: payroll
        })
    } catch (err) {
        next(err);
    }
});
router.get('/payroll2/regen/:payrollId', middlewares.guardRoute(['read_payroll']), async (req, res, next) => {
    try {
        let payroll = await req.app.locals.db.main.Payroll2.findById(req?.params?.payrollId).lean()
        if (!payroll) {
            throw new Error(`Payroll not found.`)
        }

        let startMoment = moment(payroll.dateStart)
        let endMoment = moment(payroll.dateEnd)

        let options = {
            padded: true,
            showTotalAs: 'time',
            showWeekDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            periodWeekDays: 'All'
        }
        for (let x = 0; x < payroll.rows.length; x++) {
            let row = payroll.rows[x]

            if (row.rtype === 1) {
                // console.log(member)

                let { days, stats, compute } = await dtrHelper.getDtrByDateRange6(req.app.locals.db, null, row.uid, startMoment, endMoment, options)
                //throw 'aaa'
                let employments = await req.app.locals.db.main.Employment.aggregate([
                    {
                        $match: {
                            _id: row.uid
                        }
                    },
                    {
                        $lookup: {
                            localField: 'employeeId',
                            foreignField: '_id',
                            from: 'employees',
                            as: 'employees'
                        }
                    },
                    {
                        $addFields: {
                            "employee": {
                                $arrayElemAt: ["$employees", 0]
                            }
                        }
                    },
                    {
                        $project: {
                            employees: 0,
                            employee: {
                                personal: 0,
                                employments: 0,
                                addresses: 0,
                            }
                        }
                    }
                ])
                const precisionRound = (number, precision) => {
                    var factor = Math.pow(10, precision);
                    return Math.round(number * factor) / factor;
                }
                let employment = employments.at(-1)
                if (employment) {
                    let employee = employment?.employee
                    let perMinute = 0
                    let totalWorkDays = 22
                    let perMonth = 0

                    let gross = 0.0
                    let tardy = 0.0
                    let grant = 0.0
                    if (employment?.salaryType === 'monthly') {
                        perMinute = precisionRound((employment.salary / totalWorkDays / 8 / 60), 9)
                    } else if (employment?.salaryType === 'daily') {
                        perMinute = precisionRound((employment.salary / 8 / 60), 9)
                    } else if (employment?.salaryType === 'hourly') {
                        perMinute = precisionRound((employment.salary / 60), 9)
                    }

                    if (employment.employmentType === 'permanent') {
                        stats.weekdays.renderedDays += stats.holidays.renderedDays
                        stats.weekdays.renderedHours += stats.holidays.renderedHours
                        stats.weekdays.renderedMinutes += stats.holidays.renderedMinutes
                        stats.weekdays.totalMinutes += stats.holidays.totalMinutes
                        stats.weekdays.underTimeTotalMinutes += stats.holidays.underTimeTotalMinutes
                    }
                    gross = precisionRound(perMinute * stats.weekdays.totalMinutes, 9)
                    tardy = precisionRound(perMinute * stats.weekdays.underTimeTotalMinutes, 9)
                    grant = gross - tardy

                    if (employment.employmentType === 'permanent') {
                        if (employment.salaryType === 'monthly') {
                            perMonth = employment.salary
                        }
                        gross = perMonth - tardy
                    }

                    payroll.rows[x].sourceOfFund = employment?.department
                    payroll.rows[x].name = `${employee.lastName}, ${employee.firstName}`
                    payroll.rows[x].position = employment?.position
                    payroll.rows[x].wage = employment?.salary
                    payroll.rows[x].days = stats.weekdays.renderedDays
                    payroll.rows[x].hours = stats.weekdays.renderedHours
                    payroll.rows[x].minutes = stats.weekdays.renderedMinutes
                    payroll.rows[x].gross = gross
                    payroll.rows[x].tardy = tardy
                    payroll.rows[x].grant = grant
                }
            }
        }
        await req.app.locals.db.main.Payroll2.updateOne({ _id: payroll._id }, payroll)

        // return res.send(rows)
        // let payroll2 = await req.app.locals.db.main.Payroll2.create({
        //     name: name,
        //     template: template,
        //     dateStart: dateStart,
        //     dateEnd: dateEnd,
        //     rows: rows,
        // })
        res.redirect(`/payroll2/view/${payroll._id}`)
    } catch (err) {
        next(err);
    }
});
router.get('/payroll2/:payrollId/add-row', middlewares.guardRoute(['read_payroll']), async (req, res, next) => {
    try {
        let payroll = await req.app.locals.db.main.Payroll2.findById(req?.params?.payrollId)
        if (!payroll) {
            throw new Error(`Payroll not found.`)
        }
        payroll.rows.splice(req?.query?.index, 0, {
            uid: req.app.locals.db.mongoose.Types.ObjectId(),
            rtype: parseInt(req?.query?.rtype),
            name: req?.query?.title
        })
        await payroll.save()
        res.redirect(`/payroll2/view/${payroll._id}`)
    } catch (err) {
        next(err);
    }
});
router.get('/payroll2/:payrollId/del-row', middlewares.guardRoute(['read_payroll']), async (req, res, next) => {
    try {
        let payroll = await req.app.locals.db.main.Payroll2.findById(req?.params?.payrollId)
        if (!payroll) {
            throw new Error(`Payroll not found.`)
        }
        payroll.rows.splice(req?.query?.index, 1)
        await payroll.save()
        res.redirect(`/payroll2/view/${payroll._id}`)
    } catch (err) {
        next(err);
    }
});
router.post('/payroll2/:payrollId/sort-rows', middlewares.guardRoute(['update_payroll']), async (req, res, next) => {
    try {
        let payroll = await req.app.locals.db.main.Payroll2.findById(req?.params?.payrollId).lean()
        if (!payroll) {
            return res.render('error.html', { error: "Sorry, payroll not found." })
        }

        let body = req.body
        let oldIndex = lodash.get(body, 'oldIndex')
        let newIndex = lodash.get(body, 'newIndex')

        /*{# https://stackoverflow.com/a/6470794/1594918 #}*/
        /* Move array element from old to new index */
        let element = payroll.rows[oldIndex];
        payroll.rows.splice(oldIndex, 1);
        payroll.rows.splice(newIndex, 0, element);

        await req.app.locals.db.main.Payroll2.updateOne({ _id: payroll._id }, payroll)

        res.send('Sorting saved.')
    } catch (err) {
        next(err);
    }
});

router.post('/payroll2/:payrollId/save', middlewares.guardRoute(['read_payroll']), async (req, res, next) => {
    try {
        let payroll = await req.app.locals.db.main.Payroll2.findById(req?.params?.payrollId).lean()
        if (!payroll) {
            return res.render('error.html', { error: "Sorry, payroll not found." })
        }
        let body = lodash.get(req, 'body')
        let patch = {
            rows: lodash.get(body, 'rows')
        }

        let r = await req.app.locals.db.main.Payroll2.updateOne({ _id: payroll._id }, patch)
        console.log(r)
        res.send(`Payroll saved.`)
    } catch (err) {
        next(err);
    }
});

module.exports = router;