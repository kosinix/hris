//// Core modules

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment');
const qr = require('qr-image')
const sharp = require('sharp')

//// Modules
const countries = require('../countries');
const db = require('../db');
const dtrHelper = require('../dtr-helper');
const excelGen = require('../excel-gen');
const middlewares = require('../middlewares');
const passwordMan = require('../password-man');
const paginator = require('../paginator');
const suffixes = require('../suffixes');
const s3 = require('../aws-s3');
const { AppError } = require('../errors');

// Router
let router = express.Router()

router.use('/e-profile', middlewares.requireAuthUser)

router.get('/e-profile/home', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let carouselItems = []
        employee.employments.forEach((e) => {
            let qrData = {
                type: 2,
                employeeId: employee._id,
                employmentId: e._id
            }
            qrData = Buffer.from(JSON.stringify(qrData)).toString('base64')
            // console.log(qrData)

            qrData = qr.imageSync(qrData, { size: 5, type: 'png' }).toString('base64')
            carouselItems.push({
                type: 'qr',
                data: qrData,
                employment: e,
                title: e.position || 'Employment',
            })
        })



        res.render('e-profile/home.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
            carouselItems: carouselItems,
        });

    } catch (err) {
        next(err);
    }
});
router.get('/e-profile/hdf', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        // Today attendance
        let hd = await db.main.HealthDeclaration.findOne({
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
        res.render('e-profile/hdf.html', {
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
router.post('/e-profile/hdf', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
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
            let hd = await db.main.HealthDeclaration.findOne({
                employeeId: employee._id,
                createdAt: {
                    $gte: moment().startOf('day').toDate(),
                    $lt: moment().endOf('day').toDate(),
                }
            })
            if (hd) {
                throw new Error('You have already submitted a health declaration today.')
            } else {

                hd = new db.main.HealthDeclaration({
                    employeeId: employee._id,
                    data: body
                })
                await hd.save()
                flash.ok(req, 'employee', 'Health declaration submitted.')
                return res.redirect('/e-profile/home');
            }
        }

        qrData = Buffer.from(JSON.stringify(qrData)).toString('base64')

        qrData = qr.imageSync(qrData, { size: 5, type: 'png' }).toString('base64')
        qrCodes.push({
            data: qrData,
            employment: '',
            title: 'Health Declaration Form',
        })

        res.render('e-profile/hdf-qr.html', {
            momentNow: moment(),
            employee: employee,
            qrCodes: qrCodes,
        });
    } catch (err) {
        next(err);
    }
});

router.post('/e-profile/accept', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        employee.acceptedDataPrivacy = true
        await employee.save()

        res.send('ok')
    } catch (err) {
        next(err);
    }
});


router.get('/e-profile/dtr/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentId = res.employmentId
        let employment = res.employment
        let month = lodash.get(req, 'query.month', moment().format('MMM'))
        let year = lodash.get(req, 'query.year', moment().format('YYYY'))
        let momentNow = moment().year(year).month(month)

        // Today attendance
        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            employmentId: employmentId,
            createdAt: {
                $gte: momentNow.clone().startOf('month').toDate(),
                $lt: momentNow.clone().endOf('month').toDate(),
            }
        }).lean()

        for (let a = 0; a < attendances.length; a++) {
            let attendance = attendances[a]
            let workSchedule = await db.main.WorkSchedule.findById(
                lodash.get(attendance, 'workScheduleId')
            )

            attendance.shifts = lodash.get(workSchedule, 'timeSegments')
        }

        let lists = await db.main.EmployeeList.find({
            'members': {
                $elemMatch: {
                    employmentId: employmentId
                }
            }
        }).lean()
        let listIds = lists.map(o => o._id)
        let workSchedules = await db.main.WorkSchedule.find({
            $or: [
                {
                    visibility: ''
                },
                {
                    visibility: {
                        $exists: false
                    }
                },
                {
                    'members': {
                        $elemMatch: {
                            objectId: employmentId,
                            type: 'employment'
                        }
                    }
                },
                {
                    'members': {
                        $elemMatch: {
                            objectId: {
                                $in: listIds
                            },
                            type: 'list'
                        }
                    }
                }
            ]
        }).lean()

        workSchedules = workSchedules.map((o) => {
            let times = []
            o.timeSegments = o.timeSegments.map((t) => {
                t.start = moment().startOf('day').minutes(t.start).format('hh:mm A')
                t.end = moment().startOf('day').minutes(t.end).format('hh:mm A')
                times.push(`${t.start} to ${t.end}`)
                return t
            })
            o.times = times.join(", \n")
            return o
        })

        let dtrDays = dtrHelper.getDtrMonthlyView(month, year, attendances, false)

        let dtrEditable = false
        dtrDays = dtrDays.map((d) => {

            let attendance = d.attendance
            let attendanceType = lodash.get(attendance, 'type')

            // For use by vuejs in frontend
            let ui = {
                editable: false,
                attendanceType: attendanceType,
                log0: '',
                log1: '',
                log2: '',
                log3: '',
            }

            if (attendanceType === 'normal') {
                let maxLogNumber = 4
                for (let l = 0; l < maxLogNumber; l++) {
                    let log = lodash.get(attendance, `logs[${l}]`)
                    if (log) {
                        lodash.set(ui, `log${l}`, moment(log.dateTime).format('HH:mm'))
                    } else {
                        lodash.set(ui, `log${l}`, '')
                        ui.editable = true
                        dtrEditable = true
                    }
                }
            }

            d.ui = ui

            return d
        })

        let years = new Array(10)
        years = years.fill(moment().year()).map((val, index) => val - index)

        // return res.send(dtrDays)
        res.render('e-profile/dtr.html', {
            flash: flash.get(req, 'employee'),
            momentNow: momentNow,
            attendances: attendances,
            employee: employee,
            employment: employment,
            dtrDays: dtrDays,
            workSchedules: workSchedules,
            months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            years: years,
            dtrEditable: dtrEditable,
        });


    } catch (err) {
        next(err);
    }
});
router.get('/e-profile/dtr/:employmentId/attendance/:attendanceId/edit', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentId = res.employmentId
        let employment = res.employment
        let attendanceId = lodash.get(req, 'params.attendanceId')

        // Get attendance
        let attendance = await db.main.Attendance.findOne({
            _id: attendanceId,
            employmentId: employmentId,
        }).lean()

        if (!attendance) {
            throw new Error('Attendance not found.')
        }

        let workSchedule = await db.main.WorkSchedule.findById(
            lodash.get(attendance, 'workScheduleId')
        )

        attendance.shifts = lodash.get(workSchedule, 'timeSegments')

        let workSchedules = await db.main.WorkSchedule.find().lean()
        workSchedules = workSchedules.map((o) => {
            let times = []
            o.timeSegments = o.timeSegments.map((t) => {
                t.start = moment().startOf('day').minutes(t.start).format('hh:mm A')
                t.end = moment().startOf('day').minutes(t.end).format('hh:mm A')
                times.push(`${t.start} to ${t.end}`)
                return t
            })
            o.times = times.join(", \n")
            return o
        })


        let attendanceType = lodash.get(attendance, 'type')

        // For use by vuejs in frontend
        let ui = {
            editable: false,
            attendanceType: attendanceType,
            log0: '',
            log1: '',
            log2: '',
            log3: '',
        }

        if (attendanceType === 'normal') {
            let maxLogNumber = 4
            for (let l = 0; l < maxLogNumber; l++) {
                let log = lodash.get(attendance, `logs[${l}]`)
                if (log) {
                    lodash.set(ui, `log${l}`, moment(log.dateTime).format('HH:mm'))
                } else {
                    lodash.set(ui, `log${l}`, '')
                    ui.editable = true
                }
            }
        }

        attendance.ui = ui


        // return res.send(attendance)
        res.render('e-profile/dtr-edit.html', {
            flash: flash.get(req, 'employee'),
            attendance: attendance,
            employee: employee,
            employment: employment,
            workSchedules: workSchedules,
            attendanceTypes: CONFIG.attendance.types,
            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => o !== 'normal'),
        });
    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/dtr/:employmentId/attendance/:attendanceId/edit', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentId = res.employmentId
        let employment = res.employment
        let attendanceId = lodash.get(req, 'params.attendanceId')


        // Get attendance
        let attendance = await db.main.Attendance.findOne({
            _id: attendanceId,
            employmentId: employmentId,
        }).lean()

        if (!attendance) {
            throw new Error('Attendance not found.')
        }

        let body = req.body
        // return res.send(body)
        let patch = {}
        lodash.set(patch, 'type', lodash.get(body, 'type'))
        lodash.set(patch, 'workScheduleId', lodash.get(body, 'workScheduleId'))
        lodash.set(patch, 'log0', lodash.get(body, 'log0'))
        lodash.set(patch, 'log1', lodash.get(body, 'log1'))
        lodash.set(patch, 'log2', lodash.get(body, 'log2'))
        lodash.set(patch, 'log3', lodash.get(body, 'log3'))
        lodash.set(patch, 'comment', lodash.get(body, 'comment'))

        if (patch.type === '') {
            return res.redirect(`/e-profile/dtr/${employmentId}/attendance/${attendanceId}/edit`)
        }

        // return res.send(patch)

        let { changeLogs, att } = await dtrHelper.editAttendance(db, attendance._id, patch, res.user)

        // return res.send(att)
        if (changeLogs.length) {
            flash.ok(req, 'employee', `${changeLogs.join(' ')}`)
        } else {

        }
        res.redirect(`/e-profile/dtr/${employmentId}`)
    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/dtr/:employmentId/change-sched', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentId = res.employmentId
        let employment = res.employment
        let month = lodash.get(req, 'query.month', moment().format('MMM'))
        let year = lodash.get(req, 'query.year', moment().format('YYYY'))
        let momentNow = moment().year(year).month(month)

        let workScheduleId = lodash.get(req, 'body.workScheduleId')
        if (!workScheduleId) {
            throw new Error('No work schedule selected.')
        }

        // Today attendance
        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            employmentId: employmentId,
            createdAt: {
                $gte: momentNow.clone().startOf('month').toDate(),
                $lt: momentNow.clone().endOf('month').toDate(),
            }
        }).lean()

        let ids = []
        for (let a = 0; a < attendances.length; a++) {
            let attendance = attendances[a]
            ids.push(attendance._id.toString())
            lodash.set(attendance, 'workScheduleId', workScheduleId)
            let workSchedule = await db.main.WorkSchedule.findById(
                lodash.get(attendance, 'workScheduleId')
            )
            attendance.shifts = lodash.get(workSchedule, 'timeSegments')
        }

        let r = await db.main.Attendance.updateMany({
            _id: {
                $in: ids
            }
        }, {
            workScheduleId: workScheduleId
        })
        let r2 = await db.main.Employment.updateOne({
            _id: employment._id
        }, {
            workScheduleId: workScheduleId
        })

        let dtrDays = dtrHelper.getDtrMonthlyView(month, year, attendances, false)

        res.send(dtrDays)
    } catch (err) {
        next(new AppError(err.message));
    }
});
router.post('/e-profile/dtr/:employmentId/logs', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentId = res.employmentId
        let employment = res.employment
        let month = lodash.get(req, 'query.month', moment().format('MMM'))
        let year = lodash.get(req, 'query.year', moment().format('YYYY'))
        let momentNow = moment().year(year).month(month)

        // Log
        let log = await dtrHelper.logAttendance(db, employee, employment, null) // 15mins timeout

        // Today attendance
        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            employmentId: employmentId,
            createdAt: {
                $gte: momentNow.clone().startOf('month').toDate(),
                $lt: momentNow.clone().endOf('month').toDate(),
            }
        }).lean()

        for (let a = 0; a < attendances.length; a++) {
            let attendance = attendances[a]
            let workSchedule = await db.main.WorkSchedule.findById(
                lodash.get(attendance, 'workScheduleId')
            )
            attendance.shifts = lodash.get(workSchedule, 'timeSegments')
        }

        let dtrDays = dtrHelper.getDtrMonthlyView(month, year, attendances, false)

        res.send(dtrDays)
    } catch (err) {
        next(new AppError(err.message));
    }
});
router.get('/e-profile/dtr/print/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentId = res.employmentId
        let employment = res.employment
        let month = lodash.get(req, 'query.month', moment().format('MMM'))
        let year = lodash.get(req, 'query.year', moment().format('YYYY'))
        let momentNow = moment().year(year).month(month)
        let totalTimeView = lodash.get(req, 'query.totalTimeView', 'undertime')

        // Today attendance
        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            employmentId: employmentId,
            createdAt: {
                $gte: momentNow.startOf('month').toDate(),
                $lt: momentNow.endOf('month').toDate(),
            }
        }).lean()

        for (let a = 0; a < attendances.length; a++) {
            let attendance = attendances[a]
            let workSchedule = await db.main.WorkSchedule.findById(
                lodash.get(attendance, 'workScheduleId')
            )

            attendance.shifts = lodash.get(workSchedule, 'timeSegments')
        }

        let workSchedules = await db.main.WorkSchedule.find().lean()
        workSchedules = workSchedules.map((o) => {
            let times = []
            o.timeSegments = o.timeSegments.map((t) => {
                t.start = moment().startOf('day').minutes(t.start).format('hh:mm A')
                t.end = moment().startOf('day').minutes(t.end).format('hh:mm A')
                times.push(`${t.start} to ${t.end}`)
                return t
            })
            o.times = times.join(", \n")
            return o
        })

        let workSchedule = workSchedules.find(o => {
            return lodash.invoke(o, '_id.toString') === lodash.invoke(employment, 'workScheduleId.toString')
        })
        // return res.send(workSchedule)
        let dtrDays = dtrHelper.getDtrMonthlyView(month, year, attendances, true)

        dtrDays = dtrDays.map((d) => {

            let attendance = d.attendance
            let attendanceType = lodash.get(attendance, 'type')

            // For use by vuejs in frontend
            let ui = {
                editable: false,
                attendanceType: attendanceType,
                log0: '',
                log1: '',
                log2: '',
                log3: '',
            }

            if (attendanceType === 'normal') {
                let maxLogNumber = 4
                for (let l = 0; l < maxLogNumber; l++) {
                    let log = lodash.get(attendance, `logs[${l}]`)
                    if (log) {
                        lodash.set(ui, `log${l}`, moment(log.dateTime).format('HH:mm'))
                    } else {
                        lodash.set(ui, `log${l}`, '')
                        // ui.editable = true
                    }
                }
            }

            d.ui = ui

            return d
        })
        // return res.send(dtrDays)
        res.render('e-profile/dtr-print.html', {
            shared: false,
            momentNow: momentNow,
            days: dtrDays,
            attendances: attendances,
            employee: employee,
            employment: employment,
            workSchedule: workSchedule,
            title: `DTR-${momentNow.format('YYYY-MM')}-${employee.lastName}`,
            totalTimeView: totalTimeView,
            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => o !== 'normal'),
        });
    } catch (err) {
        next(err);
    }
});
router.get('/e-profile/dtr/share/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentId = res.employmentId
        let employment = res.employment
        let month = lodash.get(req, 'query.month', moment().format('MMM'))
        let year = lodash.get(req, 'query.year', moment().format('YYYY'))
        let momentNow = moment().year(year).month(month)

        let prevShares = await db.main.Share.deleteMany({
            createdBy: res.user._id,
        })

        // console.log(prevShares)
        // let forDeletion = await db.main.Share.remove({
        //     createdBy: res.user._id,
        //     expiredAt: {
        //         $gte: moment().add(1, 'minute').toISOString(),
        //     }
        // }).lean()
        // console.log(forDeletion)
        // return res.send('forDeletion')


        let secureKey = await passwordMan.randomStringAsync(64)
        let share = await db.main.Share.create({
            secureKey: secureKey,
            expiredAt: moment().add(1, 'hour').toDate(),
            createdBy: res.user._id,
            payload: {
                url: `${CONFIG.app.url}/shared/dtr/print/${secureKey}`,
                employeeId: employee._id,
                employmentId: employmentId,
                month: month,
                year: year,
            }
        })
        // return res.send(share)

        res.render('e-profile/dtr-share.html', {
            prevShares: prevShares,
            share: share,
            employmentId: employmentId,
            employment: employment,
        });
    } catch (err) {
        next(err);
    }
});
router.get('/shared/dtr/print/:secureKey', middlewares.decodeSharedResource, async (req, res, next) => {
    try {
        let payload = res.payload
        let employeeId = payload.employeeId
        let employmentId = payload.employmentId
        let month = payload.month
        let year = payload.year
        let momentNow = moment().year(year).month(month)
        let totalTimeView = lodash.get(req, 'query.totalTimeView', 'undertime')

        // employee
        let employee = await db.main.Employee.findOne({
            _id: employeeId
        })
        if (!employee) {
            throw new Error('Employee not found.')
        }
        employee.employments = await db.main.Employment.find({
            employeeId: employee._id
        }).lean()

        //employment
        let employment = employee.employments.find((e) => {
            return e._id.toString() === employmentId
        })
        if (!employment) {
            throw new Error('Employment not found.')
        }

        // Today attendance
        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            employmentId: employmentId,
            createdAt: {
                $gte: momentNow.clone().startOf('month').toDate(),
                $lt: momentNow.clone().endOf('month').toDate(),
            }
        }).lean()

        for (let a = 0; a < attendances.length; a++) {
            let attendance = attendances[a]
            let workSchedule = await db.main.WorkSchedule.findById(
                lodash.get(attendance, 'workScheduleId')
            )

            attendance.shifts = lodash.get(workSchedule, 'timeSegments')
        }

        let workSchedules = await db.main.WorkSchedule.find().lean()
        workSchedules = workSchedules.map((o) => {
            let times = []
            o.timeSegments = o.timeSegments.map((t) => {
                t.start = moment().startOf('day').minutes(t.start).format('hh:mm A')
                t.end = moment().startOf('day').minutes(t.end).format('hh:mm A')
                times.push(`${t.start} to ${t.end}`)
                return t
            })
            o.times = times.join(", \n")
            return o
        })

        let workSchedule = workSchedules.find(o => {
            return lodash.invoke(o, '_id.toString') === lodash.invoke(employment, 'workScheduleId.toString')
        })
        // return res.send(workSchedule)
        let dtrDays = dtrHelper.getDtrMonthlyView(month, year, attendances, true)

        dtrDays = dtrDays.map((d) => {

            let attendance = d.attendance
            let attendanceType = lodash.get(attendance, 'type')

            // For use by vuejs in frontend
            let ui = {
                editable: false,
                attendanceType: attendanceType,
                log0: '',
                log1: '',
                log2: '',
                log3: '',
            }

            if (attendanceType === 'normal') {
                let maxLogNumber = 4
                for (let l = 0; l < maxLogNumber; l++) {
                    let log = lodash.get(attendance, `logs[${l}]`)
                    if (log) {
                        lodash.set(ui, `log${l}`, moment(log.dateTime).format('HH:mm'))
                    } else {
                        lodash.set(ui, `log${l}`, '')
                        // ui.editable = true
                    }
                }
            }

            d.ui = ui

            return d
        })

        res.render('e-profile/dtr-print.html', {
            shared: true,
            momentNow: momentNow,
            days: dtrDays,
            attendances: attendances,
            employee: employee,
            employment: employment,
            workSchedule: workSchedule,
            title: `DTR-${momentNow.format('YYYY-MM')}-${employee.lastName}`,
            totalTimeView: totalTimeView,
            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => o !== 'normal'),
        });
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/wfh/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let momentNow = moment()

        res.render('e-profile/wfh.html', {
            momentNow: momentNow,
            employee: employee,
            employment: employment,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/wfh/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let momentNow = moment()

        // Today attendance
        let attendance = await db.main.Attendance.findOne({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        })
        if (attendance) {
            throw new Error('Already have attendance for today.')
        } else {
            attendance = new db.main.Attendance({
                employeeId: employee._id,
                employmentId: employment._id,
                onTravel: false,
                wfh: true,
                logs: [
                ]
            })
        }
        await attendance.save()

        return res.redirect(`/e-profile/dtr/${employment._id}`)
        res.render('e-profile/wfh.html', {
            momentNow: momentNow,
            employee: employee,
            employment: employment,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/travel/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let momentNow = moment()

        // Today attendance
        let attendance = await db.main.Attendance.findOne({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        })
        if (attendance) {
            throw new Error('Already have attendance for today.')
        } else {
            attendance = new db.main.Attendance({
                employeeId: employee._id,
                employmentId: employment._id,
                onTravel: true,
                wfh: false,
                type: 'travel',
                logs: [
                ]
            })
        }
        await attendance.save()

        return res.redirect(`/e-profile/dtr/${employment._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/dtr-set/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let attendanceType = lodash.get(req, 'query.type')

        if (!['wfh', 'travel', 'leave', 'pass'].includes(attendanceType)) {
            throw new Error('Invalid attendance type.')
        }
        // Today attendance
        let attendance = await db.main.Attendance.findOne({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        })

        if (attendance) {
            flash.error(req, 'employee', `You already have an attendance for today.`)
            return res.redirect(`/e-profile/dtr/${employment._id}`)

        } else {
            let message = ''

            if ('wfh' === attendanceType) {
                message = `Attendance set to WFH. Please secure your accomplishment report and other supporting documents.`
            } else if ('travel' === attendanceType) {
                message = `Attendance set to Travel. Please secure your appearance and other supporting documents.`
            } else if ('leave' === attendanceType) {
                message = `Attendance set to Leave. Please secure your supporting documents.`
            } else if ('pass' === attendanceType) {
                message = `Attendance set to Pass Slip. Please secure your supporting documents such as your Pass Slip.`
            }

            attendance = new db.main.Attendance({
                employeeId: employee._id,
                employmentId: employment._id,
                type: attendanceType,
                logs: [
                ]
            })
            await attendance.save()
            flash.ok(req, 'employee', `${message}`)
        }

        return res.redirect(`/e-profile/dtr/${employment._id}`)
    } catch (err) {
        next(err);
    }
});


router.get('/e-profile/payroll', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        throw new Error('Page under development.')
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/pds', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e-profile/pds.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
        });

    } catch (err) {
        next(err);
    }
});
router.get('/e-profile/pds.xlsx', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
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

router.get('/e-profile/pds1', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()



        res.render('e-profile/pds1.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/pds1', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = res.employee.toObject()
        let body = lodash.get(req, 'body')
        // return res.send(body)

        lodash.set(patch, 'lastName', lodash.get(body, 'lastName'))
        lodash.set(patch, 'firstName', lodash.get(body, 'firstName'))
        lodash.set(patch, 'middleName', lodash.get(body, 'middleName'))
        lodash.set(patch, 'suffix', lodash.get(body, 'suffix'))
        lodash.set(patch, 'birthDate', lodash.get(body, 'birthDate'))
        lodash.set(patch, 'gender', lodash.get(body, 'gender'))
        lodash.set(patch, 'civilStatus', lodash.get(body, 'civilStatus'))
        lodash.set(patch, 'mobileNumber', lodash.get(body, 'mobileNumber'))
        lodash.set(patch, 'phoneNumber', lodash.get(body, 'phoneNumber'))
        lodash.set(patch, 'email', lodash.get(body, 'email'))

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

        lodash.set(patch, 'personal.birthPlace', lodash.get(body, 'birthPlace'))
        lodash.set(patch, 'personal.height', lodash.get(body, 'height'))
        lodash.set(patch, 'personal.weight', lodash.get(body, 'weight'))
        lodash.set(patch, 'personal.bloodType', lodash.get(body, 'bloodType'))
        lodash.set(patch, 'personal.gsis', lodash.get(body, 'gsis'))
        lodash.set(patch, 'personal.sss', lodash.get(body, 'sss'))
        lodash.set(patch, 'personal.philHealth', lodash.get(body, 'philHealth'))
        lodash.set(patch, 'personal.tin', lodash.get(body, 'tin'))
        lodash.set(patch, 'personal.pagibig', lodash.get(body, 'pagibig'))
        lodash.set(patch, 'personal.agencyEmployeeNumber', lodash.get(body, 'agencyEmployeeNumber'))
        lodash.set(patch, 'personal.citizenship', lodash.get(body, 'citizenship', []))
        lodash.set(patch, 'personal.citizenshipCountry', lodash.get(body, 'citizenshipCountry', ''))
        lodash.set(patch, 'personal.citizenshipSource', lodash.get(body, 'citizenshipSource', []))

        lodash.set(patch, 'personal.spouse.lastName', lodash.get(body, 'spouse.lastName'))
        lodash.set(patch, 'personal.spouse.firstName', lodash.get(body, 'spouse.firstName'))
        lodash.set(patch, 'personal.spouse.middleName', lodash.get(body, 'spouse.middleName'))
        lodash.set(patch, 'personal.spouse.suffix', lodash.get(body, 'spouse.suffix'))
        lodash.set(patch, 'personal.spouse.birthDate', lodash.get(body, 'spouse.birthDate'))
        lodash.set(patch, 'personal.spouse.occupation', lodash.get(body, 'spouse.occupation'))
        lodash.set(patch, 'personal.spouse.employerOrBusinessName', lodash.get(body, 'spouse.employerOrBusinessName'))
        lodash.set(patch, 'personal.spouse.businessAddress', lodash.get(body, 'spouse.businessAddress'))
        lodash.set(patch, 'personal.spouse.phone', lodash.get(body, 'spouse.phone'))

        lodash.set(patch, 'personal.children', lodash.get(body, 'children', []))
        lodash.set(patch, 'personal.schools', lodash.get(body, 'schools', []))

        lodash.set(patch, 'personal.father.lastName', lodash.get(body, 'father.lastName'))
        lodash.set(patch, 'personal.father.firstName', lodash.get(body, 'father.firstName'))
        lodash.set(patch, 'personal.father.middleName', lodash.get(body, 'father.middleName'))
        lodash.set(patch, 'personal.father.suffix', lodash.get(body, 'father.suffix'))
        lodash.set(patch, 'personal.father.birthDate', lodash.get(body, 'father.birthDate'))
        lodash.set(patch, 'personal.mother.lastName', lodash.get(body, 'mother.lastName'))
        lodash.set(patch, 'personal.mother.firstName', lodash.get(body, 'mother.firstName'))
        lodash.set(patch, 'personal.mother.middleName', lodash.get(body, 'mother.middleName'))
        lodash.set(patch, 'personal.mother.birthDate', lodash.get(body, 'mother.birthDate'))

        // return res.send(patch)
        await db.main.Employee.updateOne({ _id: employee._id }, patch)

        flash.ok(req, 'employee', `PDS updated.`)
        if (lodash.get(body, 'actionType') === 'saveNext') {
            return res.redirect(`/e-profile/pds2`)
        }
        res.redirect(`/e-profile/pds1`)
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/pds2', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e-profile/pds2.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/pds2', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = res.employee.toObject()
        let body = lodash.get(req, 'body')
        // return res.send(body)

        lodash.set(patch, 'personal.eligibilities', lodash.get(body, 'eligibilities'))
        lodash.set(patch, 'personal.workExperiences', lodash.get(body, 'workExperiences'))

        await db.main.Employee.updateOne({ _id: employee._id }, patch)

        flash.ok(req, 'employee', `PDS updated.`)

        if (lodash.get(body, 'actionType') === 'saveNext') {
            return res.redirect(`/e-profile/pds3`)
        }
        res.redirect(`/e-profile/pds2`)
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/pds3', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e-profile/pds3.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/pds3', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = res.employee.toObject()
        let body = lodash.get(req, 'body')
        // return res.send(body)

        lodash.set(patch, 'personal.voluntaryWorks', lodash.get(body, 'voluntaryWorks', []))
        lodash.set(patch, 'personal.trainings', lodash.get(body, 'trainings', []))
        lodash.set(patch, 'personal.extraCurriculars', lodash.get(body, 'extraCurriculars', []))

        await db.main.Employee.updateOne({ _id: employee._id }, patch)

        flash.ok(req, 'employee', `PDS updated.`)

        if (lodash.get(body, 'actionType') === 'saveNext') {
            return res.redirect(`/e-profile/pds4`)
        }
        res.redirect(`/e-profile/pds3`)
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/pds4', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e-profile/pds4.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
            countries: countries.options,
            suffixes: suffixes.options,
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/pds4', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let patch = res.employee.toObject()
        let body = lodash.get(req, 'body')
        // return res.send(body)

        lodash.set(patch, 'personal.relatedThirdDegree', lodash.get(body, 'relatedThirdDegree'))
        lodash.set(patch, 'personal.relatedFourthDegree', lodash.get(body, 'relatedFourthDegree'))
        lodash.set(patch, 'personal.relatedFourthDegreeDetails', lodash.get(body, 'relatedFourthDegreeDetails'))
        lodash.set(patch, 'personal.guiltyAdmin', lodash.get(body, 'guiltyAdmin'))
        lodash.set(patch, 'personal.guiltyAdminDetails', lodash.get(body, 'guiltyAdminDetails'))
        lodash.set(patch, 'personal.criminalCharge', lodash.get(body, 'criminalCharge'))
        lodash.set(patch, 'personal.criminalChargeDetails', lodash.get(body, 'criminalChargeDetails'))
        lodash.set(patch, 'personal.criminalChargeDate', lodash.get(body, 'criminalChargeDate'))
        lodash.set(patch, 'personal.convicted', lodash.get(body, 'convicted'))
        lodash.set(patch, 'personal.convictedDetails', lodash.get(body, 'convictedDetails'))
        lodash.set(patch, 'personal.problematicHistory', lodash.get(body, 'problematicHistory'))
        lodash.set(patch, 'personal.problematicHistoryDetails', lodash.get(body, 'problematicHistoryDetails'))
        lodash.set(patch, 'personal.electionCandidate', lodash.get(body, 'electionCandidate'))
        lodash.set(patch, 'personal.electionCandidateDetails', lodash.get(body, 'electionCandidateDetails'))
        lodash.set(patch, 'personal.electionResigned', lodash.get(body, 'electionResigned'))
        lodash.set(patch, 'personal.electionResignedDetails', lodash.get(body, 'electionResignedDetails'))
        lodash.set(patch, 'personal.dualCitizen', lodash.get(body, 'dualCitizen'))
        lodash.set(patch, 'personal.dualCitizenDetails', lodash.get(body, 'dualCitizenDetails'))
        lodash.set(patch, 'personal.indigenousGroup', lodash.get(body, 'indigenousGroup'))
        lodash.set(patch, 'personal.indigenousGroupDetails', lodash.get(body, 'indigenousGroupDetails'))
        lodash.set(patch, 'personal.pwd', lodash.get(body, 'pwd'))
        lodash.set(patch, 'personal.pwdDetails', lodash.get(body, 'pwdDetails'))
        lodash.set(patch, 'personal.soloParent', lodash.get(body, 'soloParent'))
        lodash.set(patch, 'personal.soloParentDetails', lodash.get(body, 'soloParentDetails'))
        lodash.set(patch, 'personal.references', lodash.get(body, 'references', []))

        await db.main.Employee.updateOne({ _id: employee._id }, patch)

        flash.ok(req, 'employee', `PDS updated.`)

        res.redirect(`/e-profile/pds4`)
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/account/password', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e-profile/account.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/account/password', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let user = res.user
        let body = lodash.get(req, 'body')

        let password = lodash.trim(lodash.get(body, 'oldPassword'))

        // Check password
        let passwordHash = passwordMan.hashPassword(password, user.salt);
        if (passwordHash !== user.passwordHash) {
            flash.error(req, 'employee', `Current Password is incorrect.`)
            return res.redirect(`/e-profile/account/password`)
        }

        user.passwordHash = passwordMan.hashPassword(lodash.get(body, 'newPassword'), user.salt);
        await user.save()

        flash.ok(req, 'employee', `Password changed successfully.`)
        return res.redirect(`/e-profile/account/password`)
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/memo', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = parseInt(lodash.get(req, 'query.customSort'))
        lodash.set(req, 'session.pagination.perPage', perPage)

        let query = {}
        let projection = {}

        // Pagination
        let totalDocs = await db.main.Memo.countDocuments(query)
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/e-profile/memo',
            req.query
        )

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        // console.log(query, projection, options, sort)

        let memos = await db.main.Memo.find(query, projection, options).sort(sort).lean()

        res.render('e-profile/memo.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            memos: memos,
            pagination: pagination,
            query: req.query,
        });

    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/memo/:memoId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getMemo, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let memo = res.memo.toObject()

        res.render('e-profile/memo-read.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            memo: memo,
        });
    } catch (err) {
        next(err);
    }
});
router.get('/e-profile/photo', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('e-profile/photo.html', {
            employee: employee.toObject()
        });
    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/photo', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, fileUpload(), middlewares.handleExpressUploadMagic, async (req, res, next) => {
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
                        { Key: `${bucketKeyPrefix}xlarge-${photo}` },
                        { Key: `${bucketKeyPrefix}orig-${photo}` },
                    ]
                }
            }).promise()
        }

        employee.profilePhoto = lodash.get(req, 'saveList.photo[0]')
        await employee.save()
        flash.ok(req, 'employee', `Profile photo updated.`)
        res.redirect(`/e-profile/home`);
    } catch (err) {
        next(err);
    }
});
router.get('/e-profile/photo/delete', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, fileUpload(), middlewares.handleExpressUploadMagic, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

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
                        { Key: `${bucketKeyPrefix}xlarge-${photo}` },
                        { Key: `${bucketKeyPrefix}orig-${photo}` },
                    ]
                }
            }).promise()
        }

        await db.main.Employee.updateOne({ _id: employee._id }, { profilePhoto: '' })

        flash.ok(req, 'employee', `Profile photo deleted.`)
        res.redirect(`/e-profile/home`);
    } catch (err) {
        next(err);
    }
});


router.get('/e-profile/webcam', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('e-profile/webcam.html', {
            employee: employee.toObject()
        });
    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/webcam', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.dataUrlToReqFiles(['photo']), middlewares.handleExpressUploadMagic, async (req, res, next) => {
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
        flash.ok(req, 'employee', `Profile photo updated.`)
        res.redirect(`/e-profile/home`);

    } catch (err) {
        next(err);
    }
});

module.exports = router;