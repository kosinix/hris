//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const countries = require('../countries');
const db = require('../db');
const dtrHelper = require('../dtr-helper');
const excelGen = require('../excel-gen');
const middlewares = require('../middlewares');
const passwordMan = require('../password-man');
const payrollCalc = require('../payroll-calc');
const suffixes = require('../suffixes');

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
            // console.log(qrData)

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
                $gte: momentNow.startOf('month').toDate(),
                $lt: momentNow.endOf('month').toDate(),
            }
        })

        attendances = lodash.mapKeys(attendances, (a) => {
            return moment(a.createdAt).format('YYYY-MM-DD')
        })

        let days = new Array(momentNow.daysInMonth())
        days = days.fill(1).map((v, i) => {
            let attendance = attendances[`${year}-${month}-${String(v + i).padStart(2, '0')}`] || null
            let dtr = dtrHelper.calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints)

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
            employment: employment,
            qrCodeSvg: qrCodeSvg.toString('base64'),
        });
    } catch (err) {
        next(err);
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

        // Today attendance
        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            employmentId: employmentId,
            createdAt: {
                $gte: momentNow.startOf('month').toDate(),
                $lt: momentNow.endOf('month').toDate(),
            }
        })

        attendances = lodash.mapKeys(attendances, (a) => {
            return moment(a.createdAt).format('YYYY-MM-DD')
        })

        let days = new Array(31)
        days = days.fill(1).map((v, i) => {
            let attendance = attendances[`${year}-${month}-${String(v + i).padStart(2, '0')}`] || null
            let dtr = dtrHelper.calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints)

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

        res.render('e-profile/dtr-print.html', {
            shared: false,
            momentNow: momentNow,
            days: days,
            attendances: attendances,
            employee: employee,
            employment: employment,
            qrCodeSvg: qrCodeSvg.toString('base64'),
            title: `DTR-${momentNow.format('YYYY-MM')}-${employee.lastName}`
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

        // employee
        let employee = await db.main.Employee.findOne({
            _id: employeeId
        })
        if(!employee){
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
                $gte: momentNow.startOf('month').toDate(),
                $lt: momentNow.endOf('month').toDate(),
            }
        })

        attendances = lodash.mapKeys(attendances, (a) => {
            return moment(a.createdAt).format('YYYY-MM-DD')
        })

        let days = new Array(31)
        days = days.fill(1).map((v, i) => {
            let attendance = attendances[`${year}-${month}-${String(v + i).padStart(2, '0')}`] || null
            let dtr = dtrHelper.calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints)

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

        res.render('e-profile/dtr-print.html', {
            shared: true,
            momentNow: momentNow,
            days: days,
            attendances: attendances,
            employee: employee,
            employment: employment,
            qrCodeSvg: qrCodeSvg.toString('base64'),
            title: `DTR-${momentNow.format('YYYY-MM')}-${employee.lastName}`
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
            let addresses = []
            lodash.set(patch, 'addresses.0.full', lodash.get(address0, 'full'))
            if(lodash.get(patch, 'addresses.0.unit')) addresses.push(lodash.get(patch, 'addresses.0.unit'))
            if(lodash.get(patch, 'addresses.0.street')) addresses.push(lodash.get(patch, 'addresses.0.street'))
            if(lodash.get(patch, 'addresses.0.village')) addresses.push(lodash.get(patch, 'addresses.0.village'))
            if(lodash.get(address0, 'full')) addresses.push(lodash.get(address0, 'full'))
            lodash.set(patch, 'address', addresses.join(', '))
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
            let addresses = []
            lodash.set(patch, 'addresses.1.full', lodash.get(address1, 'full'))
            if(lodash.get(patch, 'addresses.1.unit')) addresses.push(lodash.get(patch, 'addresses.1.unit'))
            if(lodash.get(patch, 'addresses.1.street')) addresses.push(lodash.get(patch, 'addresses.1.street'))
            if(lodash.get(patch, 'addresses.1.village')) addresses.push(lodash.get(patch, 'addresses.1.village'))
            if(lodash.get(address1, 'full')) addresses.push(lodash.get(address1, 'full'))
            lodash.set(patch, 'address', addresses.join(', '))
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
        lodash.set(patch, 'personal.citizenship', lodash.get(body, 'citizenship'))
        lodash.set(patch, 'personal.citizenshipCountry', lodash.get(body, 'citizenshipCountry'))
        lodash.set(patch, 'personal.citizenshipSource', lodash.get(body, 'citizenshipSource'))

        await db.main.Employee.updateOne({ _id: employee._id }, patch)

        flash.ok(req, 'employee', `Updated ${employee.firstName} ${employee.lastName} PDS.`)
        res.redirect(`/e-profile/pds`)
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

        let password = lodash.get(body, 'oldPassword')

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
module.exports = router;