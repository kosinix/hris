//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const payrollCalc = require('../payroll-calc');


// Router
let router = express.Router()

router.use('/e-profile', middlewares.requireAuthUser)

router.get('/e-profile/home', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let qrCodes = []
        employee.employments.forEach((e) => {
            let qrData = {
                type: 2,
                employeeId: employee._id,
                employmentId: e._id
            }
            qrData = Buffer.from(JSON.stringify(qrData)).toString('base64')
            console.log(qrData)

            qrData = qr.imageSync(qrData, { size: 5, type: 'png' }).toString('base64')
            qrCodes.push({
                data: qrData,
                employment: e,
                title: e.position || 'Employment',
            })
        })

        res.render('e-profile/home.html', {
            employee: employee,
            momentNow: moment(),
            qrCodes: qrCodes,
        });

    } catch (err) {
        next(err);
    }
});
router.get('/e-profile/hdf', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()


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
        let def = {"temperature":"","lastName":"","firstName":"","middleName":"","age":"","sex":"","civilStatus":"","address":"","contactNumber":"","department":"","symptoms":[],"visitedMedicalFacility":"","visitedMedicalFacilityPurposes":[],"suspectedCovidPatient":"","suspectedCovidPatientDetails":"","sickFamilyMembers":"","sickFamilyMembersDetails":""}
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

router.get('/e-profile/dtr', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        console.log(employee.employments)
        // Today attendance
        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            createdAt: {
                $gte: moment().startOf('month').toDate(),
                $lt: moment().endOf('month').toDate(),
            }
        })

        attendances = lodash.mapKeys(attendances, (a) => {
            return moment(a.createdAt).format('YYYY-MM-DD')
        })

        let momentNow = moment()
        let days = new Array(momentNow.daysInMonth())
        let year = momentNow.format('YYYY')
        let month = momentNow.format('MM')
        days = days.fill(1).map((v, i) => {
            let attendance = attendances[`${year}-${month}-${String(v + i).padStart(2, '0')}`] || null
            let dtr = payrollCalc.calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints, CONFIG.workTime.gracePeriods)

            return {
                date: `${year}-${month}-${String(v + i).padStart(2, '0')}`,
                year: year,
                month: month,
                day: v + i,
                dtr: dtr,
                attendance: attendance
            }
        })
        let qrCodeSvg = qr.imageSync(employee.uid, { size: 10, type: 'png' })

        res.render('e-profile/dtr.html', {
            momentNow: momentNow,
            days: days,
            attendances: attendances,
            employee: employee,
            qrCodeSvg: qrCodeSvg.toString('base64'),
        });
    } catch (err) {
        next(err);
    }
});

router.get('/e-profile/dtr/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentId = req.params.employmentId
        let found = employee.employments.find((e)=>{
            return e._id.toString() === employmentId
        })
        if (!found) {
            throw new Error('Employment not found.')
        }
        // Today attendance
        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            employmentId: employmentId,
            createdAt: {
                $gte: moment().startOf('month').toDate(),
                $lt: moment().endOf('month').toDate(),
            }
        })
        

        attendances = lodash.mapKeys(attendances, (a) => {
            return moment(a.createdAt).format('YYYY-MM-DD')
        })

        let momentNow = moment()
        let days = new Array(momentNow.daysInMonth())
        let year = momentNow.format('YYYY')
        let month = momentNow.format('MM')
        days = days.fill(1).map((v, i) => {
            let attendance = attendances[`${year}-${month}-${String(v + i).padStart(2, '0')}`] || null
            let dtr = payrollCalc.calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints, CONFIG.workTime.gracePeriods)

            return {
                date: `${year}-${month}-${String(v + i).padStart(2, '0')}`,
                year: year,
                month: month,
                day: v + i,
                dtr: dtr,
                attendance: attendance
            }
        })
        let qrCodeSvg = qr.imageSync(employee.uid, { size: 10, type: 'png' })

        res.render('e-profile/dtr.html', {
            momentNow: momentNow,
            days: days,
            attendances: attendances,
            employee: employee,
            qrCodeSvg: qrCodeSvg.toString('base64'),
        });
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
        throw new Error('Page under development.')
    } catch (err) {
        next(err);
    }
});
module.exports = router;