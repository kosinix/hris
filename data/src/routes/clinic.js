//// Core modules
const path = require('path')

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const middlewares = require('../middlewares');

// Router
let router = express.Router()

router.use('/e/clinic', middlewares.requireAuthUser)

router.get('/e/clinic/home', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let data = {
            flash: flash.get(req, 'employee'),

            employee: employee,
            momentNow: moment(),
        }
        res.render('e/clinic/home.html', data);
    } catch (err) {
        next(err);
    }
});

router.get('/e/clinic/hdf', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        // Today attendance
        let hd = await req.app.locals.db.main.HealthDeclaration.findOne({
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
        res.render('e/clinic/hdf.html', {
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
router.post('/e/clinic/hdf', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
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
            let hd = await req.app.locals.db.main.HealthDeclaration.findOne({
                employeeId: employee._id,
                createdAt: {
                    $gte: moment().startOf('day').toDate(),
                    $lt: moment().endOf('day').toDate(),
                }
            })
            if (hd) {
                throw new Error('You have already submitted a health declaration today.')
            } else {

                hd = new req.app.locals.db.main.HealthDeclaration({
                    employeeId: employee._id,
                    data: body
                })
                await hd.save()
                flash.ok(req, 'employee', 'Health declaration submitted.')
                return res.redirect('/e/clinic/home');
            }
        }

        qrData = Buffer.from(JSON.stringify(qrData)).toString('base64')

        qrData = qr.imageSync(qrData, { size: 5, type: 'png' }).toString('base64')
        qrCodes.push({
            data: qrData,
            employment: '',
            title: 'Health Declaration Form',
        })

        res.render('e/clinic/hdf-qr.html', {
            momentNow: moment(),
            employee: employee,
            qrCodes: qrCodes,
        });
    } catch (err) {
        next(err);
    }
});


router.get('/e/clinic/vax/all', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e/clinic/vax/all.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e/clinic/vax/create', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        // return res.send(req.body)
        let body = lodash.get(req, 'body')
        let payload = {
            _id: req.app.locals.db.mongoose.Types.ObjectId(),
            name: body.name,
            date: body.date,
            sequence: body.sequence,
            healthFacility: body.healthFacility,
        }

        let vaccines = lodash.get(employee, 'personal.vaccines', [])
        vaccines.push(payload)
        lodash.set(employee, 'personal.vaccines', vaccines)


        await req.app.locals.db.main.Employee.updateOne({
            _id: employee._id
        }, employee)

        res.send(payload)
    } catch (err) {
        next(err);
    }
});
router.post('/e/clinic/vax/delete', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let vaxId = lodash.get(req, 'body.vaxId')
        
        let vaccines = lodash.get(employee, 'personal.vaccines', [])
        let index = vaccines.findIndex(v=>{
            return v._id.toString() === vaxId
        })
        vaccines.splice(index, 1)
        lodash.set(employee, 'personal.vaccines', vaccines)

        await req.app.locals.db.main.Employee.updateOne({
            _id: employee._id
        }, employee)

        res.send({})
    } catch (err) {
        next(err);
    }
});
module.exports = router;