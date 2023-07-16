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

const mandatoryDeductions = [
    // GSIS
    'getRlip',
    'emergencyLoan',
    'eal',
    'conso',
    'ouliPremium',
    'ouliPolicy',
    'regularPolicy',
    'gfal',
    'mpl',
    'cpl',
    'help',
    // Philhealth
    'medicare',
    // Pagibig
    'pagibig',
    'mplLoan',
    'calamity',
    // BIR
    'withTax',
]
const nonMandatoryDeductions = [
    'teachers',
    'ffa',
    'citySavings',
]

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
            periodWeekDays: 'All',
            showDays: 1
        }
        let rows = []
        for (let x = 0; x < members.length; x++) {
            // for (let x = 0; x < 20; x++) {
            let member = members[x]
            // console.log(member)

            let days = await dtrHelper.getDtrDays(req.app.locals.db, member.employmentId, startMoment, endMoment, options)
            let stats = dtrHelper.getDtrStats(days)

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
            
            let employment = employments.at(-1)
            if (employment) {
                let employee = employment?.employee
                let salary = employment?.salary ?? 0
                let hourlyRate = dtrHelper.getHourlyRate(salary, employment.salaryType) // Unified computation for hourly

                let totalHours = stats.workdays.time.totalInHours

                // Include all days for part-timers they have no OT
                if (employment.salaryType === 'hourly') {
                    totalHours = stats.days.time.totalInHours
                }
                const gross = hourlyRate * totalHours

                let tardyHours = stats.workdays.undertime.totalInHours + (stats.count.absentDays * 8)
                let tardy = hourlyRate * tardyHours
                let grant = gross - tardy


                let _days = stats.workdays.time.days
                let _hours = stats.workdays.time.hours
                let _minutes = stats.workdays.time.minutes
                if (employment.salaryType === 'hourly') {
                    _days = stats.days.time.days
                    _hours = stats.days.time.hours
                    _minutes = stats.days.time.minutes
                }

                
                let customCols = {}
                if (template === 'permanent') {
                    customCols['peraAca'] = 2000
                    mandatoryDeductions.forEach((name)=>{
                        lodash.set(customCols, name, 0)
                    })
                    nonMandatoryDeductions.forEach((name)=>{
                        lodash.set(customCols, name, 0)
                    })
                }
                rows.push({
                    uid: employment?._id,
                    rtype: 1,
                    sourceOfFund: employment?.department,
                    name: `${employee.lastName}, ${employee.firstName}`,
                    position: employment?.position,
                    wage: employment?.salary,
                    days: _days,
                    hours: _hours,
                    minutes: _minutes,
                    gross: gross,
                    tardy: tardy,
                    grant: grant,
                    ...customCols
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
            mandatoryDeductions: mandatoryDeductions,
            nonMandatoryDeductions: nonMandatoryDeductions,
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

            }
            return row
        })
        lodash.each(payroll.rows[0], (_,k)=>{
            console.log(k)
        })

        res.render(`payroll2/table-payroll-${payroll.template}.html`, {
            payroll: payroll,
            mandatoryDeductions: mandatoryDeductions,
            nonMandatoryDeductions: nonMandatoryDeductions,
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
            periodWeekDays: 'All',
            showDays: 1,
        }
        for (let x = 0; x < payroll.rows.length; x++) {
            let row = payroll.rows[x]

            if (row.rtype === 1) {
                // console.log(x)

                row.uid = req.app.locals.db.mongoose.Types.ObjectId(row.uid)
                let days = await dtrHelper.getDtrDays(req.app.locals.db, row.uid, startMoment, endMoment, options)
                let stats = dtrHelper.getDtrStats(days)

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

                let employment = employments.at(-1)
                if (employment) {

                    let employee = employment?.employee

                    let salary = employment?.salary ?? 0
                    let hourlyRate = dtrHelper.getHourlyRate(salary, employment.salaryType) // Unified computation for hourly

                    let totalHours = stats.workdays.time.totalInHours

                    // Include all days for part-timers they have no OT
                    if (employment.salaryType === 'hourly') {
                        totalHours = stats.days.time.totalInHours
                    }
                    const gross = dtrHelper.roundOff(hourlyRate * totalHours, 2)

                    let tardyHours = stats.workdays.undertime.totalInHours + (stats.count.absentDays * 8)
                    let tardy = dtrHelper.roundOff(hourlyRate * tardyHours, 2)
                    let grant = gross - tardy
                    // console.log(employee.lastName, 'grant', grant, '=', gross,'-',  tardy)
                    // console.log(employee.lastName, 'tardy', tardy, '=', hourlyRate,'*',  tardyHours)
                    // console.log(employee.lastName, 'gross', '=', hourlyRate,'*',  totalHours)
                    payroll.rows[x].sourceOfFund = employment?.department
                    payroll.rows[x].name = `${employee.lastName}, ${employee.firstName}`
                    payroll.rows[x].position = employment?.position
                    payroll.rows[x].wage = employment?.salary
                    payroll.rows[x].days = stats.workdays.time.days
                    payroll.rows[x].hours = stats.workdays.time.hours
                    payroll.rows[x].minutes = stats.workdays.time.minutes
                    payroll.rows[x].gross = gross
                    payroll.rows[x].tardy = tardy
                    payroll.rows[x].grant = grant
                } else {
                    console.log(x, 'no emp')
                }
            }
        }
        await req.app.locals.db.main.Payroll2.updateOne({ _id: payroll._id }, payroll)
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