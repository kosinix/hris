//// Core modules

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const momentRange = require('moment-range')
const momentExt = momentRange.extendMoment(moment)
const qr = require('qr-image')
const sharp = require('sharp')

//// Modules
const countries = require('../countries');
const dtrHelper = require('../dtr-helper');
const excelGen = require('../excel-gen');
const middlewares = require('../middlewares');
const passwordMan = require('../password-man');
const paginator = require('../paginator');
const suffixes = require('../suffixes');
const s3 = require('../aws-s3');
const { AppError } = require('../errors');
const uploader = require('../uploader');
const workScheduler = require('../work-scheduler');

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
                title: `${e.position}` || 'Employment',
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

router.get(['/e-profile/dtr/:employmentId', '/e-profile/dtr/print/:employmentId'], middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, middlewares.getDtrQueries, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let employmentId = employment._id

        let {
            periodMonthYear,
            periodSlice,
            periodWeekDays,
            showTotalAs,
            showWeekDays,
            startMoment,
            endMoment,
            countTimeBy,
        } = res


        let options = {
            padded: true,
            showTotalAs: showTotalAs,
            showWeekDays: showWeekDays,
        }

        let { days, stats } = await dtrHelper.getDtrByDateRange(req.app.locals.db, employee._id, employment._id, startMoment, endMoment, options)

        let periodMonthYearMoment = moment(periodMonthYear)
        const range1 = momentExt.range(periodMonthYearMoment.clone().subtract(6, 'months'), periodMonthYearMoment.clone().add(6, 'months'))
        let months = Array.from(range1.by('months')).reverse()

        let periodMonthYearList = months.map((_moment) => {
            let date = _moment.startOf('month')

            return {
                value: date.format('YYYY-MM-DD'),
                text: date.format('MMM YYYY'),
            }
        })

        let workSchedules = await workScheduler.getEmploymentWorkSchedule(req.app.locals.db, employmentId)

        let workSchedule = workSchedules.find(o => {
            return lodash.invoke(o, '_id.toString') === lodash.invoke(employment, 'workScheduleId.toString')
        })

        let data = {
            title: `DTR - ${employee.firstName} ${employee.lastName} ${employee.suffix}`,

            flash: flash.get(req, 'employee'),

            employee: employee,
            employment: employment,

            // Data that might change
            days: days,
            stats: stats,

            showTotalAs: showTotalAs,
            workSchedules: workSchedules,
            periodMonthYearList: periodMonthYearList,
            periodMonthYear: periodMonthYearMoment.format('YYYY-MM-DD'),
            periodWeekDays: periodWeekDays,
            periodSlice: periodSlice,
            inCharge: employment.inCharge,
            countTimeBy: countTimeBy,

            startDate: startMoment.format('YYYY-MM-DD'),
            endDate: endMoment.format('YYYY-MM-DD'),

            workSchedule: workSchedule,
            shared: false,

            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => !['normal'].includes(o)),

        }

        // return res.send(req.path)
        if (req.xhr) {
            return res.json(data)
        }
        // return res.send(days)

        if (/^\/e-profile\/dtr\/print/.test(req.path)) {
            return res.render('e-profile/dtr-print.html', data)
        }
        res.render('e-profile/dtr.html', data)
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

        // Get pending
        let attendanceReview = await req.app.locals.db.main.AttendanceReview.findOne({
            attendanceId: attendanceId,
            status: 'pending'
        }).lean()

        if (attendanceReview) {
            throw new Error('Attendance correction application for this date is still under review.')
        }

        // Get rejected
        let attendanceDenied = await req.app.locals.db.main.AttendanceReview.findOne({
            attendanceId: attendanceId,
            status: 'rejected'
        }).sort({ _id: -1 }).lean()


        // Get attendance
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            _id: attendanceId,
            employmentId: employmentId,
        }).lean()

        if (!attendance) {
            throw new Error('Attendance not found.')
        }

        // let now = moment()
        // let created = moment(attendance.createdAt).add(8, 'hours')
        // if(now.isSameOrBefore(created)){
        //     throw new Error('Cannot correct today\'s attendance. Please wait for tomorrow to apply for correction.')
        // }
        let workSchedule = await req.app.locals.db.main.WorkSchedule.findById(
            lodash.get(attendance, 'workScheduleId')
        )

        attendance.shifts = lodash.get(workSchedule, 'timeSegments')

        let workSchedules = await req.app.locals.db.main.WorkSchedule.find().lean()
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
            attendanceTypesList: CONFIG.attendance.types.map(o => o.value).filter(o => !['normal', 'wfh', 'pass'].includes(o)),
            correctionReasons: CONFIG.attendance.correctionReasons,
            attendanceDenied: attendanceDenied,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/e-profile/dtr/:employmentId/attendance/:attendanceId/edit', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, fileUpload(), middlewares.handleExpressUploadMagic, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentId = res.employmentId
        let employment = res.employment
        let attendanceId = lodash.get(req, 'params.attendanceId')

        // Get pending
        let attendanceReview = await req.app.locals.db.main.AttendanceReview.findOne({
            attendanceId: attendanceId,
            status: 'pending'
        }).lean()

        if (attendanceReview) {
            throw new Error('Attendance correction application for this date is still under review.')
        }

        // Get attendance
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            _id: attendanceId,
            employmentId: employmentId,
        }).lean()

        if (!attendance) {
            throw new Error('Attendance not found.')
        }

        let saveList = lodash.get(req, 'saveList')
        let attachments = lodash.get(saveList, 'photo')
        let body = lodash.get(req, 'body')


        // ORIG
        let orig = JSON.parse(JSON.stringify(attendance))
        delete orig._id

        // PATCH
        let patch = JSON.parse(JSON.stringify(attendance))
        delete patch._id

        patch.attendanceId = attendance._id.toString()
        patch.attachments = attachments
        patch.type = body.type
        patch.correctionReason = body.correctionReason
        patch.logsheetNumber = body.logsheetNumber
        patch.workScheduleId = body.workScheduleId
        patch.status = 'pending'

        let getMode = (x) => {
            let mode = 1
            if (x === 0) {
                mode = 1
            } else if (x === 1) {
                mode = 0
            } else if (x === 2) {
                mode = 1
            } else if (x === 3) {
                mode = 0
            }
            return mode
        }

        // Merge 4 logs
        for (let x = 0; x < 4; x++) {
            let origLog = lodash.get(orig, `logs[${x}]`)
            let patchLog = lodash.get(body, `log${x}`)
            let newLog = origLog
            let momentLog = moment(patchLog, 'HH:mm', true) // Turn to moment or null if fails
            if (momentLog.isValid()) {

                let dateTime = moment(attendance.createdAt).hours(momentLog.hours()).minutes(momentLog.minutes()).toDate()
                let mode = getMode(x)
                if (origLog) {
                    newLog.dateTime = dateTime
                    newLog.mode = mode
                } else { // undefined
                    newLog = {
                        _id: req.app.locals.db.mongoose.Types.ObjectId(),
                        scannerId: null,
                        dateTime: dateTime,
                        mode: mode,
                        type: 'online',

                    }
                }

            }

            patch.logs[x] = newLog
        }
        // Remove undefined
        patch.logs = patch.logs.filter(o => o !== undefined)
        patch = JSON.parse(JSON.stringify(patch))

        // return res.send(patch)
        let merged = lodash.merge(orig, patch)
        let review = await req.app.locals.db.main.AttendanceReview.create(merged)

        // return res.send({
        //     orig: JSON.parse(JSON.stringify(attendance)),
        //     patch: patch,
        //     merged: merged,
        //     review: review,
        // })

        flash.ok(req, 'employee', 'Application submitted.')
        res.redirect(`/e-profile/dtr/${employmentId}`)
    } catch (err) {
        next(err);
    }
});
router.patch('/e-profile/dtr/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let employmentId = employment._id
        let momentNow = moment()

        let periodMonthYear = lodash.get(req, 'query.periodMonthYear', moment().startOf('month').format('YYYY-MM-DD'))
        let periodMonthYearMoment = moment(periodMonthYear)
        let periodSlice = lodash.get(req, 'query.periodSlice')
        let periodWeekDays = lodash.get(req, 'query.periodWeekDays', 'Mon-Fri')
        let showTotalAs = lodash.get(req, 'query.showTotalAs', 'time')

        // Validation
        if (!periodMonthYearMoment.isValid()) {
            throw new Error(`Invalid period date.`)
        }
        if (!['15th', '30th', 'all'].includes(periodSlice)) {
            if (momentNow.date() <= 15) {
                periodSlice = '15th'
            } else {
                periodSlice = '30th'
            }

            if (employment.employmentType === 'permanent') {
                periodSlice = 'all'
            }
        }
        if (!['Mon-Fri', 'Sat-Sun'].includes(periodWeekDays)) {
            periodWeekDays = 'Mon-Fri'
        }
        if (!['time', 'undertime'].includes(showTotalAs)) {
            showTotalAs = 'time'
        }

        let startMoment = periodMonthYearMoment.clone().startOf('month')
        let endMoment = periodMonthYearMoment.clone().endOf('month')

        if (periodSlice === '15th') {
            startMoment = startMoment.startOf('day')
            endMoment = endMoment.date(15).endOf('day')
        } else if (periodSlice === '30th') {
            startMoment = startMoment.date(16).startOf('day')
            endMoment = endMoment.endOf('month').endOf('day')
        }

        let showWeekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        if (periodWeekDays === 'Sat-Sun') {
            showWeekDays = ['Sat', 'Sun']
        }

        let workScheduleId = lodash.get(req, 'body.workScheduleId')
        let inCharge = lodash.get(req, 'body.inCharge')

        let patch = {}

        if (workScheduleId) {
            patch.workScheduleId = workScheduleId

            // Today attendance
            let attendances = await req.app.locals.db.main.Attendance.find({
                employeeId: employee._id,
                employmentId: employmentId,
                createdAt: {
                    $gte: startMoment.clone().startOf('day').toDate(),
                    $lte: endMoment.clone().endOf('day').toDate(),
                }
            }).lean()

            attendances = attendances.filter((attendance) => {
                return showWeekDays.includes(moment(attendance.createdAt).format('ddd'))
            })

            let attendanceIds = attendances.map((attendance) => {
                return attendance._id.toString()
            })

            let rA = await req.app.locals.db.main.Attendance.updateMany({
                _id: {
                    $in: attendanceIds
                }
            }, {
                workScheduleId: workScheduleId
            })

            // console.log('updatedAttendances', rA, attendanceIds)
        }
        if (inCharge) {
            patch.inCharge = inCharge
        }

        let rE = await req.app.locals.db.main.Employment.updateOne({
            _id: employment._id
        }, patch)

        // console.log('updated employment', rE)

        res.send('ok')
    } catch (err) {
        next(new AppError(err.message));
    }
});
router.post('/e-profile/dtr/:employmentId/logs', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment

        // return res.send(req.body)
        let body = req.body

        let mode = body.mode
        let lat = body.lat
        let lon = body.lon
        let webcamPhoto = body.webcamPhoto



        // Today attendance
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        }).lean()
        if (attendance) {
            let lastLog = attendance.logs[attendance.logs.length - 1]
            if (lastLog.mode === mode) {
                let message = `You are already logged-in. Please refresh your HRIS account and try again.`
                if (mode == 0) {
                    message = `You are already logged out. Please refresh your HRIS account and try again.`
                }
                throw new Error(message)
            }
        }

        // Photo
        let saveList = null
        if (webcamPhoto) {
            let file = uploader.toReqFile(webcamPhoto)
            let files = {
                photos: [file]
            }
            let localFiles = await uploader.handleExpressUploadLocalAsync(files, CONFIG.app.dirs.upload)
            let imageVariants = await uploader.resizeImagesAsync(localFiles, null, CONFIG.app.dirs.upload); // Resize uploaded images

            let uploadList = uploader.generateUploadList(imageVariants, localFiles)
            saveList = uploader.generateSaveList(imageVariants, localFiles)
            await uploader.uploadToS3Async(uploadList)
            await uploader.deleteUploadsAsync(localFiles, imageVariants)
            req.localFiles = localFiles
            req.imageVariants = imageVariants
            req.saveList = saveList

            // console.log(uploadList, saveList)
        }

        // Log
        let source = {
            id: res.user._id,
            type: 'userAccount', // Online user account
        }
        let extra = {
            lat: lat,
            lon: lon,
            photo: lodash.get(saveList, 'photos[0]', ''),
        }

        let log = await dtrHelper.logAttendance(req.app.locals.db, employee, employment, null, 15, extra, 'online', source) // 15mins timeout
        flash.ok(req, 'employee', 'Attendance saved.')
        res.send(log)
    } catch (err) {
        next(new AppError(err.message));
    }
});
router.get('/e-profile/dtr/:employmentId/log-point', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment

        // Today attendance
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        }).lean()

        // Checkpoints
        // 0 - no log
        // 1 - morning in
        // 2 - morning out
        // 3 - afternoon in
        // 4 - afternoon out
        // 5 - extended in
        // 6 - extended out
        let checkPoint = lodash.get(attendance, 'logs.length', 0)

        res.send({
            checkPoint: checkPoint
        })
    } catch (err) {
        next(new AppError(err.message));
    }
});

router.get('/e-profile/dtr/:employmentId/on1ine', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {

        let getRandomArbitrary = (min, max) => {
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        let timeOut = getRandomArbitrary(10, 60) * 1000
        // console.log(timeOut)
        await new Promise(resolve => setTimeout(resolve, timeOut)) // Rate limit 
        let employment = res.employment

        let t = getRandomArbitrary(0, 3)

        if (t === 0) {
            flash.error(req, 'employee', `Request timed-out. Please check your internet connection and try again.`)
            res.redirect(`/e-profile/home`)
        } else if (t === 1) {
            flash.error(req, 'employee', `Request timed-out. Please check your internet connection and try again.`)
            res.redirect(`/e-profile/dtr/${employment._id}`)
        } else if (t === 2) {
            flash.error(req, 'employee', `Request timed-out. Please check your internet connection and try again.`)
            res.redirect(`/e-profile/dtr/${employment._id}`)
        } else {
            res.redirect(`/logout`)
        }
    } catch (err) {
        next(new AppError(err.message));
    }
});

router.get('/e-profile/dtr/:employmentId/online', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let user = res.user.toObject()
        let employee = res.employee.toObject()
        let employment = res.employment
        if (!employment.active) {
            throw new Error('Cannot modify DTR as employment is no longer active.')
        }
        if (!lodash.get(user, 'settings.ol', true)) {
            return res.redirect(`/e-profile/dtr/${employment._id}/on1ine`)
        }

        // Add check point
        // Today attendance
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        }).lean()

        // Checkpoints
        // 0 - no log
        // 1 - morning in
        // 2 - morning out
        // 3 - afternoon in
        // 4 - afternoon out
        // 5 - extended in
        // 6 - extended out
        let checkPoint = lodash.get(attendance, 'logs.length', 0)

        if (checkPoint <= 0) {
            throw new Error('You need to log your Morning In first.')
        } else if (checkPoint > 2) {
            throw new Error('Service available for lunch breaks only.')
        }

        let maps = await res.app.locals.db.main.Map.find().lean()
        maps = maps.map(m => {
            return {
                name: m.name,
                // Mongo DB is reverse lat lon than OSM
                coordinates: m.geo.coordinates[0].map(o => {
                    return [
                        o[1],
                        o[0]
                    ]
                })
            }
        })

        maps = lodash.keyBy(maps, (m)=>{
            return m.name.toLowerCase().replace(' campus', '')
        })
        
        res.render('e-profile/map-1.html', {
            employee: employee,
            employment: employment,
            maps: maps,
        })
    } catch (err) {
        next(new AppError(err.message));
    }
});

router.post('/e-profile/dtr/:employmentId/location', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employment = res.employment
        let body = req.body


        let found = await req.app.locals.db.main.Map.findOne({
            geo: {
                $geoIntersects: {
                    $geometry: {
                        "type": "Point",
                        "coordinates": body.coordinates
                    }
                }
            }
        }).lean()

        // console.log('found', found)
        if (!found) {
            return res.status(404).send('')
        }
        res.send(found.name)
    } catch (err) {
        next(new AppError(err.message));
    }
});


router.get('/e-profile/dtr/share/:employmentId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.getEmployeeEmployment, middlewares.getDtrQueries, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employmentId = res.employmentId
        let employment = res.employment
        let month = lodash.get(req, 'query.month', moment().format('MMM'))
        let year = lodash.get(req, 'query.year', moment().format('YYYY'))

        let {
            periodMonthYear,
            periodSlice,
            periodWeekDays,
            showTotalAs,
            showWeekDays,
            startMoment,
            endMoment,
            countTimeBy,
        } = res


        let periodMonthYearMoment = moment(periodMonthYear)

        let prevShares = await req.app.locals.db.main.Share.deleteMany({
            createdBy: res.user._id,
        })

        // console.log(prevShares)
        // let forDeletion = await req.app.locals.db.main.Share.remove({
        //     createdBy: res.user._id,
        //     expiredAt: {
        //         $gte: moment().add(1, 'minute').toISOString(),
        //     }
        // }).lean()
        // console.log(forDeletion)
        // return res.send('forDeletion')

        //TODO: Do not allow different DTR view from one shared

        let secureKey = await passwordMan.randomStringAsync(12)
        let url = `${CONFIG.app.url}/shared/dtr/print/${secureKey}?periodMonthYear=${periodMonthYearMoment.format('YYYY-MM-DD')}&periodSlice=${periodSlice}&periodWeekDays=${periodWeekDays}&showTotalAs=${showTotalAs}&countTimeBy=${countTimeBy}`
        let hash = passwordMan.hashSha256(url)
        url = url + '&hash=' + hash
        let share = await req.app.locals.db.main.Share.create({
            secureKey: secureKey,
            expiredAt: moment().add(1, 'hour').toDate(),
            createdBy: res.user._id,
            payload: {
                url: url,
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
        let attendance = await req.app.locals.db.main.Attendance.findOne({
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
            attendance = new req.app.locals.db.main.Attendance({
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
        let attendance = await req.app.locals.db.main.Attendance.findOne({
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
            attendance = new req.app.locals.db.main.Attendance({
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

        if (!employment.active) {
            throw new Error('Cannot modify DTR as employment is no longer active.')
        }
        if (!['wfh', 'travel', 'leave', 'pass', 'holiday'].includes(attendanceType)) {
            throw new Error('Invalid attendance type.')
        }
        // Today attendance
        let attendance = await req.app.locals.db.main.Attendance.findOne({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment().startOf('day').toDate(),
                $lt: moment().endOf('day').toDate(),
            }
        })

        if (attendanceType === 'holiday') {
            if (employment.employmentType != 'permanent') {
                flash.error(req, 'employee', `Only permanent employees can tap Holiday.`)
                return res.redirect(`/e-profile/dtr/${employment._id}`)
            }
        }

        if (attendance && attendanceType != 'travel') {
            flash.error(req, 'employee', `You already have an attendance for today.`)
            return res.redirect(`/e-profile/dtr/${employment._id}`)
        }
        let message = ''
        if (attendance) {
            if ('travel' === attendanceType && attendance.type === 'normal') {
                attendance.type = 'travel'
                attendance.logs.push({
                    scannerId: null,
                    dateTime: moment().toDate(),
                    type: 'travel'
                })
                await attendance.save()
                message = 'Attendance changed to travel.'
            }
        } else {
            let logs = []

            if ('wfh' === attendanceType) {
                message = `Attendance set to WFH. Please secure your accomplishment report and other supporting documents.`
            } else if ('leave' === attendanceType) {
                message = `Attendance set to Leave. Please secure your supporting documents.`
            } else if ('pass' === attendanceType) {
                message = `Attendance set to Pass Slip. Please secure your supporting documents such as your Pass Slip.`
            } else if ('holiday' === attendanceType) {
                message = `Attendance set to Holiday.`
            } else if ('travel' === attendanceType) {
                logs = [{
                    scannerId: null,
                    dateTime: moment().toDate(),
                    type: 'travel'
                }]
                message = `Attendance set to Travel. Please secure your appearance and other supporting documents.`
            }

            await req.app.locals.db.main.Attendance.create({
                employeeId: employee._id,
                employmentId: employment._id,
                type: attendanceType,
                logs: logs
            })
        }
        flash.ok(req, 'employee', `${message}`)
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

        patch.history = employee.history
        if (patch.gender !== employee.gender) {
            patch.history.push({
                comment: `Changed gender from ${employee.gender} to ${patch.gender}.`,
                createdAt: moment().toDate()
            })
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
        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

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

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

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

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

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

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, patch)

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
        let totalDocs = await req.app.locals.db.main.Memo.countDocuments(query)
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

        let memos = await req.app.locals.db.main.Memo.find(query, projection, options).sort(sort).lean()

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

        if(employee.profilePhoto){
            throw new Error('Profile photo temporarily locked.')
        }
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
        if(employee.profilePhoto){
            throw new Error('Profile photo temporarily locked.')
        }

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

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, { profilePhoto: '' })

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