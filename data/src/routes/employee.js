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
const dtrHelper = require('../dtr-helper');
const excelGen = require('../excel-gen');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const passwordMan = require('../password-man');
const s3 = require('../aws-s3');
const uploader = require('../uploader');

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

        if (!isNaN(perPage)) {
            aggr.push({ $skip: options.skip })
            aggr.push({ $limit: options.limit })
        }
        let employees = await req.app.locals.db.main.Employee.aggregate(aggr)

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

        let matches = await req.app.locals.db.main.Employee.find({
            firstName: new RegExp(`^${lodash.trim(patch.firstName)}$`, "i"),
            lastName: new RegExp(`^${lodash.trim(patch.lastName)}$`, "i"),
        })
        if (matches.length > 0) {
            throw new Error(`Possible duplicate entry. There is already an employee with a name of "${patch.firstName} ${patch.lastName}"`)
        }

        let employee = new req.app.locals.db.main.Employee(patch)
        await employee.save()
        flash.ok(req, 'employee', `Added ${employee.firstName} ${employee.lastName}.`)
        res.redirect(`/employee/${employee._id}/employment`)
    } catch (err) {
        next(err);
    }
});

router.get('/employee/history/:employeeId', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.send(employee.history)
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

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

        flash.ok(req, 'employee', `Updated ${employee.firstName} ${employee.lastName}'s personal info.`)
        res.redirect(`/employee/${employee._id}/personal`)
    } catch (err) {
        next(err);
    }
});

// Employment
router.get('/employee/:employeeId/employment', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentIndex = employee.employments.length

        res.render('employee/employment/all.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            employment: employee.employments[employmentIndex],
            employmentIndex: employmentIndex
        });
    } catch (err) {
        next(err);
    }
});
// C
router.get('/employee/:employeeId/employment/create', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

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
        lodash.set(patch, `salary`, lodash.get(body, 'salary').replace(/,/g, ''))
        lodash.set(patch, `salaryType`, lodash.get(body, 'salaryType'))
        lodash.set(patch, `fundSource`, lodash.get(body, 'fundSource'))
        lodash.set(patch, `sssDeduction`, lodash.get(body, 'sssDeduction'))
        lodash.set(patch, `workScheduleId`, lodash.get(body, 'workScheduleId'))

        let employment = new req.app.locals.db.main.Employment(patch)
        await employment.save()

        flash.ok(req, 'employee', `Added to "${employee.firstName} ${employee.lastName}'s" employment.`)
        res.redirect(`/employee/${employee._id}/employment`)

    } catch (err) {
        next(err);
    }
});
// RU
router.get('/employee/:employeeId/employment/:employmentId/update', middlewares.guardRoute(['read_employee', 'update_employee']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment

        let workSchedules = await req.app.locals.db.main.WorkSchedule.find().lean()
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
        lodash.set(patch, `salary`, lodash.get(body, 'salary').replace(/,/g, ''))
        lodash.set(patch, `salaryType`, lodash.get(body, 'salaryType'))
        lodash.set(patch, `fundSource`, lodash.get(body, 'fundSource'))
        lodash.set(patch, `sssDeduction`, lodash.get(body, 'sssDeduction'))
        lodash.set(patch, `workScheduleId`, lodash.get(body, 'workScheduleId'))
        lodash.set(patch, `active`, lodash.get(body, 'active'))

        await req.app.locals.db.main.Employment.updateOne({ _id: employment._id }, patch)

        flash.ok(req, 'employee', `Updated "${employee.firstName} ${employee.lastName}'s" employment.`)
        res.redirect(`/employee/${employee._id}/employment`)

    } catch (err) {
        next(err);
    }
});
// D
router.get('/employee/:employeeId/employment/:employmentId/delete', middlewares.guardRoute(['delete_employee']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
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

        await employment.remove()

        flash.ok(req, 'employee', `Deleted "${employee.firstName} ${employee.lastName}'s" employment.`)
        res.redirect(`/employee/${employee._id}/employment`)
    } catch (err) {
        next(err);
    }
});

// Schedule
router.get('/employee/:employeeId/employment/:employmentId/schedule', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, middlewares.getEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment.toObject()

        // Convert from minutes from midnight into HTML time input HH:mm
        let mToTime = (minutes, format) => {
            if (!minutes) return 0
            format = format || 'HH:mm'
            return moment().startOf('year').startOf('day').add(minutes, 'minutes').format(format)
        }

        // Convert from HTML time input HH:mm into minutes from midnight
        let timeToM = (time, format) => {
            format = format || 'HH:mm'
            var momentDayStart = moment().startOf('day')

            var timeParser = moment(time, format)
            var momentTime = momentDayStart.clone().hours(timeParser.hours()).minutes(timeParser.minutes())

            return momentTime.diff(momentDayStart, 'minutes')
        }

        let timeSegmentsTemplate = [
            {
                start: 0,
                end: 0,
                grace: 0,
                maxHours: 0,
                flexible: false,
                breaks: []
            },
            {
                start: null,
                end: null,
                grace: null,
                maxHours: 0,
                flexible: false,
                breaks: []
            },
        ]
        let workScheduleTemplate = {
            weekDays: {
                mon: {
                    id: 'mon',
                    name: 'Mon',
                    type: 1, // 1 - normal, 2 - rest
                    timeSegments: timeSegmentsTemplate,
                },
                tue: {
                    id: 'tue',
                    name: 'Tue',
                    type: 1, // 1 - normal, 2 - rest
                    timeSegments: timeSegmentsTemplate,
                },
                wed: {
                    id: 'wed',
                    name: 'Wed',
                    type: 1, // 1 - normal, 2 - rest
                    timeSegments: timeSegmentsTemplate,
                },
                thu: {
                    id: 'thu',
                    name: 'Thu',
                    type: 1, // 1 - normal, 2 - rest
                    timeSegments: timeSegmentsTemplate,
                },
                fri: {
                    id: 'fri',
                    name: 'Fri',
                    type: 1, // 1 - normal, 2 - rest
                    timeSegments: timeSegmentsTemplate,
                },
                sat: {
                    id: 'sat',
                    name: 'Sat',
                    type: 2, // 1 - normal, 2 - rest
                    timeSegments: timeSegmentsTemplate,
                },
                sun: {
                    id: 'sun',
                    name: 'Sun',
                    type: 2, // 1 - normal, 2 - rest
                    timeSegments: timeSegmentsTemplate,
                },
            }
        };

        workScheduleTemplate.weekDays = lodash.mapValues(workScheduleTemplate.weekDays, (weekDay) => {
            weekDay.timeSegments = lodash.map(weekDay.timeSegments, (timeSegment) => {
                timeSegment.maxHours = timeSegment.end - timeSegment.start
                timeSegment.start = mToTime(timeSegment.start)
                timeSegment.end = mToTime(timeSegment.end)
                timeSegment.breaks = lodash.map(timeSegment.breaks, (br) => {
                    br.start = mToTime(br.start)
                    br.end = mToTime(br.end)
                    return br
                })
                return timeSegment
            })
            return weekDay
        })
        // return res.send(workSchedule.weekDays.mon)
        res.render('employee/schedule.html', {
            flash: flash.get(req, 'employee'),
            title: `Employee - ${employee.lastName} - Schedule`,
            employee: employee,
            employment: employment,
            workSchedule: workScheduleTemplate,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/employment/:employmentId/schedule', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, middlewares.getEmployment, fileUpload(), async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment.toObject()
        let files = lodash.get(req, 'files', [])

        // return res.send(files)
        let localFiles = await uploader.handleExpressUploadLocalAsync(files, CONFIG.app.dirs.upload, ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])
        // Excel containing graduate list
        let workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(lodash.get(localFiles, 'excel.0.filePath'));
        // Select worksheet to use
        let sheet = await workbook.getWorksheet('Sheet1')

        // UTC date to time
        let toTime = (utcDate, strict = true) => {
            return moment(utcDate, strict).format('h:mmA')
        }
        let timeToM = (time, format, strict = true) => {
            format = format || 'h:mmA'
            var momentDayStart = moment().startOf('day')

            var timeParser = moment(time, format, strict)
            if(!timeParser.isValid()){
                // throw new Error(`Invalid time "${time}". Format must be in "${format}"`)
                return 0
            }
            var momentTime = momentDayStart.clone().hours(timeParser.hours()).minutes(timeParser.minutes())

            return momentTime.diff(momentDayStart, 'minutes')
        }

        let parseBreaks = (workBreaks) => {
            let workBreaksArray = []
            if ((typeof workBreaks) === 'string') {
                workBreaks = workBreaks.replace(/\s\s+/g, '') // Remove spaces
                workBreaksArray = workBreaks.split(',')
                workBreaksArray = workBreaksArray.map((workBreak) => {
                    let splits = workBreak.split('-')
                    return {
                        start: timeToM(splits[0]),
                        end: timeToM(splits[1]),
                        type: 'vacant'
                    }
                })
            }
            return workBreaksArray
        }

        let workSchedule = {
            weekDays: {
                mon: {
                    type: ((sheet.getCell('J2').value + '').trim() === 'Work') ? 1 : 2,
                    timeSegments: [
                        {
                            start: timeToM(sheet.getCell('B2').value),
                            end: timeToM(sheet.getCell('C2').value),
                            grace: parseInt(sheet.getCell('D2').value) || 0,
                            max: timeToM(sheet.getCell('C2').value) - timeToM(sheet.getCell('B2').value),
                            flexible: false,
                            breaks: parseBreaks(sheet.getCell('E2').value),
                        },
                        {
                            start: timeToM(sheet.getCell('F2').value),
                            end: timeToM(sheet.getCell('G2').value),
                            grace: parseInt(sheet.getCell('H2').value) || 0,
                            max: timeToM(sheet.getCell('G2').value) - timeToM(sheet.getCell('F2').value),
                            flexible: false,
                            breaks: parseBreaks(sheet.getCell('I2').value),
                        }
                    ]
                },
                tue: {
                    type: ((sheet.getCell('J3').value + '').trim() === 'Work') ? 1 : 2,
                    timeSegments: [
                        {
                            start: timeToM(sheet.getCell('B3').value),
                            end: timeToM(sheet.getCell('C3').value),
                            grace: parseInt(sheet.getCell('D3').value) || 0,
                            max: timeToM(sheet.getCell('C3').value) - timeToM(sheet.getCell('B3').value),
                            flexible: false,
                            breaks: parseBreaks(sheet.getCell('E3').value),
                        },
                        {
                            start: timeToM(sheet.getCell('F3').value),
                            end: timeToM(sheet.getCell('G3').value),
                            grace: parseInt(sheet.getCell('H3').value) || 0,
                            max: timeToM(sheet.getCell('G3').value) - timeToM(sheet.getCell('F3').value),
                            flexible: false,
                            breaks: parseBreaks(sheet.getCell('I3').value),
                        }
                    ]
                },
                wed: {
                    type: ((sheet.getCell('J4').value + '').trim() === 'Work') ? 1 : 2,
                    timeSegments: [
                        {
                            start: timeToM(sheet.getCell('B4').value),
                            end: timeToM(sheet.getCell('C4').value),
                            grace: parseInt(sheet.getCell('D4').value) || 0,
                            max: timeToM(sheet.getCell('C4').value) - timeToM(sheet.getCell('B4').value),
                            flexible: false,
                            breaks: parseBreaks(sheet.getCell('E4').value),
                        },
                        {
                            start: timeToM(sheet.getCell('F4').value),
                            end: timeToM(sheet.getCell('G4').value),
                            grace: parseInt(sheet.getCell('H4').value) || 0,
                            max: timeToM(sheet.getCell('G4').value) - timeToM(sheet.getCell('F4').value),
                            flexible: false,
                            breaks: parseBreaks(sheet.getCell('I4').value),
                        }
                    ]
                },
                thu: {
                    type: ((sheet.getCell('J5').value + '').trim() === 'Work') ? 1 : 2,
                    timeSegments: [
                        {
                            start: timeToM(sheet.getCell('B5').value),
                            end: timeToM(sheet.getCell('C5').value),
                            grace: parseInt(sheet.getCell('D5').value) || 0,
                            max: timeToM(sheet.getCell('C5').value) - timeToM(sheet.getCell('B5').value),
                            flexible: false,
                            breaks: parseBreaks(sheet.getCell('E5').value),
                        },
                        {
                            start: timeToM(sheet.getCell('F5').value),
                            end: timeToM(sheet.getCell('G5').value),
                            grace: parseInt(sheet.getCell('H5').value) || 0,
                            max: timeToM(sheet.getCell('G5').value) - timeToM(sheet.getCell('F5').value),
                            flexible: false,
                            breaks: parseBreaks(sheet.getCell('I5').value),
                        }
                    ]
                },
                fri: {
                    type: ((sheet.getCell('J6').value + '').trim() === 'Work') ? 1 : 2,
                    timeSegments: [
                        {
                            start: timeToM(sheet.getCell('B6').value),
                            end: timeToM(sheet.getCell('C6').value),
                            grace: parseInt(sheet.getCell('D6').value) || 0,
                            max: timeToM(sheet.getCell('C6').value) - timeToM(sheet.getCell('B6').value),
                            flexible: false,
                            breaks: parseBreaks(sheet.getCell('E6').value),
                        },
                        {
                            start: timeToM(sheet.getCell('F6').value),
                            end: timeToM(sheet.getCell('G6').value),
                            grace: parseInt(sheet.getCell('H6').value) || 0,
                            max: timeToM(sheet.getCell('G6').value) - timeToM(sheet.getCell('F6').value),
                            flexible: false,
                            breaks: parseBreaks(sheet.getCell('I6').value),
                        }
                    ]
                },
                sat: {
                    type: ((sheet.getCell('J7').value + '').trim() === 'Work') ? 1 : 2,
                    timeSegments: [
                        {
                            start: timeToM(sheet.getCell('B7').value),
                            end: timeToM(sheet.getCell('C7').value),
                            grace: parseInt(sheet.getCell('D7').value) || 0,
                            max: timeToM(sheet.getCell('C7').value) - timeToM(sheet.getCell('B7').value),
                            flexible: false,
                            breaks: parseBreaks(sheet.getCell('E7').value),
                        },
                        {
                            start: timeToM(sheet.getCell('F7').value),
                            end: timeToM(sheet.getCell('G7').value),
                            grace: parseInt(sheet.getCell('H7').value) || 0,
                            max: timeToM(sheet.getCell('G7').value) - timeToM(sheet.getCell('F7').value),
                            flexible: false,
                            breaks: parseBreaks(sheet.getCell('I7').value),
                        }
                    ]
                },
                sun: {
                    type: ((sheet.getCell('J8').value + '').trim() === 'Work') ? 1 : 2,
                    timeSegments: [
                        {
                            start: timeToM(sheet.getCell('B8').value),
                            end: timeToM(sheet.getCell('C8').value),
                            grace: parseInt(sheet.getCell('D8').value) || 0,
                            max: timeToM(sheet.getCell('C8').value) - timeToM(sheet.getCell('B8').value),
                            flexible: false,
                            breaks: parseBreaks(sheet.getCell('E8').value),
                        },
                        {
                            start: timeToM(sheet.getCell('F8').value),
                            end: timeToM(sheet.getCell('G8').value),
                            grace: parseInt(sheet.getCell('H8').value) || 0,
                            max: timeToM(sheet.getCell('G8').value) - timeToM(sheet.getCell('F8').value),
                            flexible: false,
                            breaks: parseBreaks(sheet.getCell('I8').value),
                        }
                    ]
                }
            }
        }


        await uploader.deleteUploadsAsync(localFiles, [])


        workSchedule.name = `${employee.firstName} ${employee.lastName} - ${employment.position}`
        workSchedule.visibility = 'members'
        workSchedule.members = [
            {
                "objectId": employment._id,
                "name": `${employee.firstName} ${employee.lastName} - ${employment.group}`,
                "type": "employment"
            }
        ]

        workSchedule = await req.app.locals.db.main.WorkSchedule.create(workSchedule)

        // Update assignment
        await req.app.locals.db.main.Employment.updateOne({
            _id: employment._id
        }, {
            workScheduleId: workSchedule._id
        })

        // res.send(workSchedule)
        res.redirect(`/employee/${employee._id}/employment/${employment._id}/schedule/${workSchedule._id}`)
    } catch (err) {
        next(err);
    }
});
router.get('/employee/:employeeId/employment/:employmentId/schedule/:scheduleId', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, middlewares.getEmployment, middlewares.getSchedule, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment.toObject()
        let workSchedule = res.schedule.toObject()

        workSchedule.weekDays = lodash.mapValues(workSchedule.weekDays, (weekDay) => {
            weekDay.timeSegments = lodash.map(weekDay.timeSegments, (timeSegment) => {
                timeSegment.start = dtrHelper.mToTime(timeSegment.start, 'h:mmA')
                timeSegment.end = dtrHelper.mToTime(timeSegment.end, 'h:mmA')
                // timeSegment.maxHours = timeSegment.end - timeSegment.start
                timeSegment.breaks = lodash.map(timeSegment.breaks, (br) => {
                    br.start = dtrHelper.mToTime(br.start, 'h:mmA')
                    br.end = dtrHelper.mToTime(br.end, 'h:mmA')
                    return br
                })
                return timeSegment
            })
            return weekDay
        })

        // return res.send(workSchedule.weekDays.mon)
        res.render('employee/schedule/read.html', {
            flash: flash.get(req, 'employee'),
            title: `Employee - ${employee.lastName} - Schedule`,
            employee: employee,
            employment: employment,
            workSchedule: workSchedule,
        });
    } catch (err) {
        next(err);
    }
});

// Address
router.get('/employee/:employeeId/address', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
        employee.address = await req.app.locals.db.main.Address.findOneFullAddress({
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
router.post('/employee/:employeeId/address', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee
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
router.post('/employee/:employeeId/photo', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee,  middlewares.dataUrlToReqFiles(['photo']), middlewares.handleUpload({ allowedMimes: ["image/jpeg", "image/png"]}), async (req, res, next) => {
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

        employee.profilePhoto = lodash.get(req, 'saveList.photo[0]')
        await employee.save()
        flash.ok(req, 'employee', `Updated ${employee.firstName} ${employee.lastName} photo.`)
        res.redirect(`/employee/${employee._id}/personal`);
    } catch (err) {
        next(err);
    }
});
router.get('/employee/:employeeId/photo/delete', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
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
        let employee = res.employee.toObject()
        employee.user = await req.app.locals.db.main.User.findById(employee.userId)

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
router.post('/employee/:employeeId/user', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        let body = req.body
        body.username = lodash.trim(lodash.get(body, 'username'))
        body.password = lodash.trim(lodash.get(body, 'password'))

        let salt = passwordMan.randomString(16)
        let passwordHash = passwordMan.hashPassword(body.password, salt)

        let employeeUser = await req.app.locals.db.main.User.findById(employee.userId)
        if (employeeUser) { // Assoc user
            // Check username avail
            let found = await req.app.locals.db.main.User.findOne({
                username: body.username,
                _id: {
                    $ne: employeeUser._id
                }
            })
            if (found) {
                flash.error(req, 'employee', `Username "${body.username}" already exists. Please choose a different one.`)
                return res.redirect(`/employee/${employee._id}/user`)
            }

            employeeUser.username = body.username
            employeeUser.salt = salt
            employeeUser.passwordHash = passwordHash
            await employeeUser.save()

        } else { // No assoc user

            // Check username avail
            let found = await req.app.locals.db.main.User.findOne({
                username: body.username,
            })
            if (found) {
                flash.error(req, 'employee', `Username "${body.username}" already exists. Please choose a different one.`)
                return res.redirect(`/employee/${employee._id}/user`)
            }

            employeeUser = new req.app.locals.db.main.User({
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
        res.redirect(`/employee/${employee._id}/user`)

    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/user/password', middlewares.guardRoute(['update_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
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


// Documents
router.get('/employee/:employeeId/document/all', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

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
// C
router.get('/employee/:employeeId/document/create', middlewares.guardRoute(['read_employee']), middlewares.getEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()


        res.render('employee/document/create.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/employee/:employeeId/document/create', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, fileUpload(),  middlewares.handleUpload({ allowedMimes: ["image/jpeg", "image/png"]}), async (req, res, next) => {
    try {
        let employee = res.employee
        
        employee.documents.push({
            name: lodash.get(req, 'body.name'),
            key: lodash.get(req, 'saveList.document[0]'),
            mimeType: '',
        })

        await employee.save()
        flash.ok(req, 'employee', `Updated ${employee.firstName} ${employee.lastName} documents.`)
        res.redirect(`/employee/${employee._id}/document/all`);
    } catch (err) {
        next(err);
    }
});
// D
router.get('/employee/:employeeId/document/:documentId/delete', middlewares.guardRoute(['create_employee', 'update_employee']), middlewares.getEmployee, fileUpload(),  middlewares.handleUpload({ allowedMimes: ["image/jpeg", "image/png"]}), async (req, res, next) => {
    try {
        let employee = res.employee
        let documentId = req.params.documentId

        let document = employee.toObject().documents.find(o=>{
            return o._id.toString() === documentId
        })
        if(!document){
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
            console.log(resx)
        }

        let documents = employee.toObject().documents.filter(o=>{
            return o._id.toString() !== documentId
        })
        await req.app.locals.db.main.Employee.updateOne({
            _id: employee._id
        }, {
            documents: documents
        })

        flash.ok(req, 'employee', `Deleted document.`)
        res.redirect(`/employee/${employee._id}/document/all`);
    } catch (err) {
        next(err);
    }
});

// Delete employee
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