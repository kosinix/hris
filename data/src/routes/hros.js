//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')

//// Modules
const excelGen = require('../excel-gen');
const middlewares = require('../middlewares');
const passwordMan = require('../password-man');
const paginator = require('../paginator');
const { AppError } = require('../errors');
const uploader = require('../uploader');

// Router
let router = express.Router()

router.use('/hros', middlewares.requireAuthUser)

router.get('/hros/home', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let data = {
            title: 'Human Resource Online Services (HROS)',
            flash: flash.get(req, 'hros'),
            employee: employee,
            momentNow: moment(),
        }
        res.render('hros/home.html', data);

    } catch (err) {
        next(err);
    }
});

// Authority to Travel
router.get('/hros/at/all', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = lodash.get(req, 'query.customSort')
        let customFilter = lodash.get(req, 'query.customFilter')
        let customFilterValue = lodash.get(req, 'query.customFilterValue')
        lodash.set(req, 'session.pagination.perPage', perPage)

        let query = {
            employeeId: employee._id
        }
        let projection = {}

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        // console.log(query, projection, options, sort)

        let aggr = []

        aggr.push({
            $lookup:
            {
                localField: "_id",
                foreignField: "employeeId",
                from: "employees",
                as: "employees"
            }
        })
        aggr.push({ $match: query })
        aggr.push({ $sort: sort })

        // Pagination
        let countDocuments = await req.app.locals.db.main.AuthorityToTravel.aggregate(aggr)
        let totalDocs = countDocuments.length
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/hros/at/all',
            req.query
        )

        if (!isNaN(perPage)) {
            aggr.push({ $skip: options.skip })
            aggr.push({ $limit: options.limit })
        }
        let ats = await req.app.locals.db.main.AuthorityToTravel.aggregate(aggr)

        let data = {
            title: 'Human Resource Online Services (HROS) - Authority to Travel',
            employee: employee,
            flash: flash.get(req, 'hros'),
            ats: ats,
            pagination: pagination,
            momentNow: moment(),
        }
        res.render('hros/authority-to-travel/all.html', data);

    } catch (err) {
        next(err);
    }
});
router.get('/hros/at/create', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employments = employee.employments

        let data = {
            title: 'Human Resource Online Services (HROS) - Authority to Travel',
            flash: flash.get(req, 'hros'),
            employee: employee,
            employments: employments,
            employmentId: employments[0]._id,
            momentNow: moment(),
        }
        res.render('hros/authority-to-travel/create.html', data);

    } catch (err) {
        next(err);
    }
});
router.post('/hros/at/create', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let user = res.user.toObject()
        let body = req.body

        // return res.send(body)
        if (moment(body.periodOfTravelEnd).isBefore(moment(body.periodOfTravel))) {
            flash.error(req, 'hros', 'Invalid period of travel. Please check your "To" and "From" dates.')
            return res.redirect('/hros/at/create')
        }
        if (moment(body.periodOfTravelEnd).diff(moment(body.periodOfTravel), 'days') > 60) {
            flash.error(req, 'hros', 'Invalid period of travel. Duration exceeded 60 days.')
            return res.redirect('/hros/at/create')
        }
        if (lodash.toString(body.natureOfBusiness).length > 180) {
            flash.error(req, 'hros', 'Nature Of Business must not exceed 180 characters.')
            return res.redirect('/hros/at/create')
        }
        let employmentId = lodash.get(body, 'employmentId')
        let employment = await req.app.locals.db.main.Employment.findById(employmentId).lean()
        if (!employment) {
            flash.error(req, 'hros', 'Employment not found.')
            return res.redirect('/hros/at/create')
        }

        let ats = await req.app.locals.db.main.AuthorityToTravel.find({
            employeeId: employee._id,
            employmentId: employment._id,
            $or: [
                {
                    periodOfTravel: {
                        $gte: moment(body.periodOfTravel).toDate(),
                        $lte: moment(body.periodOfTravelEnd).toDate(),
                    },
                },
                {
                    periodOfTravelEnd: {
                        $gte: moment(body.periodOfTravel).toDate(),
                        $lte: moment(body.periodOfTravelEnd).toDate(),
                    }
                }
            ]

        })
        if (ats.length > 0) {
            flash.error(req, 'hros', 'Cannot create Authority to Travel on the provided period. There is an overlap with another Authority to Travel.')
            return res.redirect('/hros/at/create')
        }

        // Latest Authority to Travel
        let latest = await req.app.locals.db.main.AuthorityToTravel.findOne({
            periodOfTravel: {
                $gte: moment().startOf('month').toDate(),
            },
            periodOfTravelEnd: {
                $lte: moment().endOf('month').toDate(),
            }
        }).sort({
            createdAt: -1
        })

        let generateControlNumber = (controlNumber) => {
            controlNumber = controlNumber.replace(' (Online)', '')
            let counter = parseInt(controlNumber.split('-')[2]) // Split '2022-01-002' and get '002' as 2
            counter++ // increment
            counter = new String(counter) // Convert to string
            return moment().format('YY-MM-') + counter.padStart(3, '0') + ' (Online)'
        }

        let controlNumber = `${moment().format('YY-MM')}-001 (Online)`
        if (latest) {
            controlNumber = generateControlNumber(latest.controlNumber)
        }

        let at = await req.app.locals.db.main.AuthorityToTravel.create({
            employeeId: employee._id,
            employmentId: employment._id,
            status: 2, // 1 pending, 2 approved
            periodOfTravel: moment(body.periodOfTravel).toDate(),
            periodOfTravelEnd: moment(body.periodOfTravelEnd).toDate(),
            controlNumber: controlNumber,
            data: {
                designation: body.designation,
                officialStation: body.officialStation,
                destination: body.destination,
                natureOfBusiness: body.natureOfBusiness,
                endorser: body.endorser,
                endorserDesignation: body.endorserDesignation,
                approver: body.approver,
                approverDesignation: body.approverDesignation,
            }
        })

        // Set given dates to travel
        let a = body.periodOfTravel
        let b = body.periodOfTravelEnd
        // If you want an inclusive end date (fully-closed interval)
        for (var m = moment(a); m.diff(b, 'days') <= 0; m.add(1, 'days')) {
            // console.log(m.format('YYYY-MM-DD'));
            let attendance = {
                employeeId: employee._id,
                employmentId: employment._id,
                type: 'travel',
                workScheduleId: employment.workScheduleId,
                createdAt: m.toDate(),
                logs: [],
                changes: [],
                comments: [],
            }
            let date = m.toDate()
            attendance.changes.push({
                summary: `${user.username} inserted a new attendance.`,
                objectId: user._id,
                createdAt: date
            })
            attendance.changes.push({
                summary: `${user.username} added a new comment.`,
                objectId: user._id,
                createdAt: date
            })
            attendance.comments.push({
                summary: `Nature of business: ${at.data.natureOfBusiness}`,
                objectId: user._id,
                createdAt: date
            })
            await req.app.locals.db.main.Attendance.create(attendance)
        }

        let message = `Authority to Travel submitted. `
        message += `1.) Please print your Authority to Travel and have it signed. `
        message += `2.) Attached it when submitting your DTR. `
        flash.ok(req, 'hros', message)
        res.redirect(`/hros/at/all`)
    } catch (err) {
        next(err);
    }
});
router.get('/hros/at/:authorityToTravelId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let at = await req.app.locals.db.main.AuthorityToTravel.findById(req.params.authorityToTravelId)
        if (!at) {
            throw new Error('Authority To Travel not found.')
        }


        let words = at.data.natureOfBusiness.replace(/\s\s+/g, ' ').split(' ')
        if (words.length > 32) {
            at.data.natureOfBusiness1 = words.splice(0, 32).join(' ')
            at.data.natureOfBusiness2 = words.splice(0, 25).join(' ')

        } else {
            at.data.natureOfBusiness1 = words.join(' ')
            at.data.natureOfBusiness2 = ''

        }

        let data = {
            title: `Authority to Travel - ${employee.firstName} ${employee.lastName} - ${at.controlNumber}`,
            employee: employee,
            at: at,
            momentNow: moment(),
        }
        res.render('hros/authority-to-travel/read.html', data);

    } catch (err) {
        next(err);
    }
});
router.get('/hros/at/:authorityToTravelId/print', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let at = await req.app.locals.db.main.AuthorityToTravel.findById(req.params.authorityToTravelId)
        if (!at) {
            throw new Error('Authority To Travel not found.')
        }

        let words = at.data.natureOfBusiness.replace(/\s\s+/g, ' ').split(' ')
        if (words.length > 18) {
            at.data.natureOfBusiness1 = words.splice(0, 18).join(' ')
            at.data.natureOfBusiness2 = words.splice(0, 18).join(' ')

        } else {
            at.data.natureOfBusiness1 = words.join(' ')
            at.data.natureOfBusiness2 = ''

        }

        let data = {
            title: `Authority to Travel - ${employee.firstName} ${employee.lastName} - ${at.controlNumber}`,
            employee: employee,
            at: at,
            shared: false,
            momentNow: moment(),
        }
        res.render('hros/authority-to-travel/authority-to-travel.html', data);

    } catch (err) {
        next(err);
    }
});
router.get('/hros/at/:authorityToTravelId/delete', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let at = await req.app.locals.db.main.AuthorityToTravel.findById(req.params.authorityToTravelId)
        if (!at) {
            throw new Error('Authority To Travel not found.')
        }
        if (at.status === 2) {
            throw new Error('Cannot cancel Authority To Travel as it is already approved. Please have it corrected by the HRMO.')
        }

        await at.remove()
        flash.ok(req, 'hros', 'Application for Authority to Travel cancelled.')
        res.redirect(`/hros/at/all`)

    } catch (err) {
        next(err);
    }
});
router.get('/hros/at/:authorityToTravelId/share', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let at = await req.app.locals.db.main.AuthorityToTravel.findById(req.params.authorityToTravelId)
        if (!at) {
            throw new Error('Authority To Travel not found.')
        }


        let secureKey = await passwordMan.randomStringAsync(12)
        let url = `${CONFIG.app.url}/shared/authority-to-travel/print/${secureKey}`
        // let hash = passwordMan.hashSha256(url)
        // url = url + '?hash=' + hash
        let share = await req.app.locals.db.main.Share.create({
            secureKey: secureKey,
            expiredAt: moment().add(1, 'hour').toDate(),
            createdBy: res.user._id,
            payload: {
                url: url,
                employeeId: employee._id,
                employmentId: at.employmentId,
                atId: at._id,
            }
        })

        let data = {
            title: `Authority to Travel - ${employee.firstName} ${employee.lastName} - ${at.controlNumber}`,
            employee: employee,
            share: share,
            momentNow: moment(),
        }
        res.render('hros/authority-to-travel/share.html', data);

    } catch (err) {
        next(err);
    }
});

// Cert of appearance
router.get('/hros/coa', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('hros/certificate-of-appearance/certificate-of-appearance.html', {
            title: `Certificate of Appearance - ${employee.firstName} ${employee.lastName}`,
            flash: flash.get(req, 'employee'),
            employee: employee,
        });
    } catch (err) {
        next(err);
    }
});
router.get('/hros/coa/share', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()


        let secureKey = await passwordMan.randomStringAsync(12)
        let url = `${CONFIG.app.url}/shared/certificate-of-appearance/print/${secureKey}`
        // let hash = passwordMan.hashSha256(url)
        // url = url + '?hash=' + hash
        let share = await req.app.locals.db.main.Share.create({
            secureKey: secureKey,
            expiredAt: moment().add(1, 'hour').toDate(),
            createdBy: res.user._id,
            payload: {
                url: url,
                employeeId: employee._id,
            }
        })

        let data = {
            title: `Certificate of Appearance - ${employee.firstName} ${employee.lastName}`,
            employee: employee,
            share: share,
            momentNow: moment(),
        }
        res.render('hros/certificate-of-appearance/share.html', data);

    } catch (err) {
        next(err);
    }
});


// Flag raising
router.get('/hros/flag/all', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        // let date = lodash.get(req, 'query.date', moment().format('YYYY-MM-DD'))
        let momentDate = moment()


        let query = {
            dateTime: {
                $gte: momentDate.clone().startOf('day').toDate(),
                $lte: momentDate.clone().endOf('day').toDate(),
            }
        }

        let aggr = []
        aggr.push({ $match: query })
        aggr.push({
            $lookup: {
                from: "employees",
                localField: "employeeId",
                foreignField: "_id",
                as: "employees"
            }
        })
        aggr.push({
            $addFields: {
                "employee": {
                    $arrayElemAt: ["$employees", 0]
                },
            }
        })
        // Turn array employees into field employee
        // Add field employee
        aggr.push({
            $project: {
                employees: 0,
            }
        })

        // Hide not needed for lighter payload
        aggr.push({
            $project: {
                employee: {
                    addresses: 0,
                    personal: 0,
                    employments: 0,
                    mobileNumber: 0,
                    phoneNumber: 0,
                    documents: 0,
                    createdAt: 0,
                    updatedAt: 0,
                    uuid: 0,
                    uid: 0,
                    group: 0,
                    __v: 0,
                    profilePhoto: 0,
                    acceptedDataPrivacy: 0,
                    birthDate: 0,
                    civilStatus: 0,
                    addressPermanent: 0,
                    addressPresent: 0,
                    email: 0,
                    history: 0,
                    speechSynthesisName: 0,
                    address: 0
                }
            }
        })

        //console.log(aggr)
        let alreadyLogged = false

        let attendances = await req.app.locals.db.main.AttendanceFlag.aggregate(aggr)
        attendances = attendances.map(attendance => {
            if (!attendance.source.photo) {
                attendance.source.photo = lodash.get(attendance, 'extra.photo', '')
            }
            attendance.logTime = moment(attendance.dateTime).format('hh:mm A')

            if (lodash.invoke(employee, '_id.toString') === lodash.invoke(attendance, 'employeeId.toString')) {
                alreadyLogged = true
            }
            attendance = lodash.pickBy(attendance, function (a, key) {
                return ['_id', 'employeeId', 'logTime', 'source', 'employee'].includes(key)
            });
            return attendance
        })
        // return res.send(attendances)

        res.render('hros/flag-raising/all.html', {
            flash: flash.get(req, 'attendance'),
            momentDate: momentDate,
            attendances: attendances,
            alreadyLogged: alreadyLogged,
            s3Prefix: `/${CONFIG.aws.bucket1.name}/${CONFIG.aws.bucket1.prefix}`,
            serverUrl: CONFIG.app.url,
        });
    } catch (err) {
        next(err);
    }
});
router.get('/hros/flag/create', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.isFlagRaisingDay, async (req, res, next) => {
    try {
        let user = res.user.toObject()
        let employee = res.employee.toObject()

        let momentDate = moment()

        let presentOnFlag = await req.app.locals.db.main.AttendanceFlag.countDocuments({
            employeeId: employee._id,
            dateTime: {
                $gte: momentDate.clone().startOf('day').toDate(),
                $lte: momentDate.clone().endOf('day').toDate(),
            }
        }).lean()
        presentOnFlag = presentOnFlag > 0 ? true : false

        if (presentOnFlag) {
            return res.redirect('/hros/flag/all')
        }

        let data = {
            title: 'Human Resource Online Services (HROS) - Flag',
            flash: flash.get(req, 'hros'),
            user: user,
            employee: employee,
            momentNow: moment(),
        }
        res.render('hros/flag-raising/create.html', data)
    } catch (err) {
        next(err);
    }
});
router.post('/hros/flag/log', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.isFlagRaisingDay, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        // return res.send(req.body)
        let body = req.body

        let lat = body.lat
        let lon = body.lon
        let webcamPhoto = body.webcamPhoto
        let campus = body.campus

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

        let momentDate = moment()

        // Log
        let attendance = await req.app.locals.db.main.AttendanceFlag.create({
            employeeId: employee._id,
            dateTime: momentDate.toDate(),
            type: 'normal',
            source: {
                id: res.user._id,
                type: 'userAccount', // Online user account
                lat: lat,
                lon: lon,
                campus: campus,
                photo: lodash.get(saveList, 'photos[0]', ''),
            }
        })

        // 
        let query = {
            createdAt: {
                $gte: momentDate.clone().startOf('day').toDate(),
                $lte: momentDate.clone().endOf('day').toDate(),
            }
        }

        let aggr = []
        aggr.push({ $match: query })
        aggr.push({
            $lookup: {
                from: "employees",
                localField: "employeeId",
                foreignField: "_id",
                as: "employees"
            }
        })
        aggr.push({
            $addFields: {
                "employee": {
                    $arrayElemAt: ["$employees", 0]
                },
            }
        })
        // Turn array employees into field employee
        // Add field employee
        aggr.push({
            $project: {
                employees: 0,
            }
        })

        // Hide not needed for lighter payload
        aggr.push({
            $project: {
                employee: {
                    addresses: 0,
                    personal: 0,
                    employments: 0,
                    mobileNumber: 0,
                    phoneNumber: 0,
                    documents: 0,
                    createdAt: 0,
                    updatedAt: 0,
                    uuid: 0,
                    uid: 0,
                    group: 0,
                    __v: 0,
                    profilePhoto: 0,
                    acceptedDataPrivacy: 0,
                    birthDate: 0,
                    civilStatus: 0,
                    addressPermanent: 0,
                    addressPresent: 0,
                    email: 0,
                    history: 0,
                    speechSynthesisName: 0,
                    address: 0
                }
            }
        })

        aggr.push({
            $sort: { dateTime: 1 }
        })

        //console.log(aggr)
        let attendances = await req.app.locals.db.main.AttendanceFlag.aggregate(aggr)
        attendances = attendances.map(attendance => {
            if (!attendance.source.photo) {
                attendance.source.photo = lodash.get(attendance, 'extra.photo', '')
            }
            attendance.logTime = moment(attendance.dateTime).format('hh:mm A')

            attendance = lodash.pickBy(attendance, function (a, key) {
                return ['_id', 'employeeId', 'logTime', 'source', 'employee'].includes(key)
            });
            return attendance
        })
        //return res.send(attendances)

        let room = momentDate.format('YYYY-MM-DD')
        req.app.locals.io.of("/flag-raising").to(room).emit('added', attendances.pop())

        flash.ok(req, 'attendance', 'Flag raising attendance saved.')
        res.send(attendance)
    } catch (err) {
        next(new AppError(err.message));
    }
});

// Flag lowering
router.get('/hros/flag-lowering/all', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        // let date = lodash.get(req, 'query.date', moment().format('YYYY-MM-DD'))
        let momentDate = moment()


        let query = {
            dateTime: {
                $gte: momentDate.clone().startOf('day').toDate(),
                $lte: momentDate.clone().endOf('day').toDate(),
            }
        }

        let aggr = []
        aggr.push({ $match: query })
        aggr.push({
            $lookup: {
                from: "employees",
                localField: "employeeId",
                foreignField: "_id",
                as: "employees"
            }
        })
        aggr.push({
            $addFields: {
                "employee": {
                    $arrayElemAt: ["$employees", 0]
                },
            }
        })
        // Turn array employees into field employee
        // Add field employee
        aggr.push({
            $project: {
                employees: 0,
            }
        })

        // Hide not needed for lighter payload
        aggr.push({
            $project: {
                employee: {
                    addresses: 0,
                    personal: 0,
                    employments: 0,
                    mobileNumber: 0,
                    phoneNumber: 0,
                    documents: 0,
                    createdAt: 0,
                    updatedAt: 0,
                    uuid: 0,
                    uid: 0,
                    group: 0,
                    __v: 0,
                    profilePhoto: 0,
                    acceptedDataPrivacy: 0,
                    birthDate: 0,
                    civilStatus: 0,
                    addressPermanent: 0,
                    addressPresent: 0,
                    email: 0,
                    history: 0,
                    speechSynthesisName: 0,
                    address: 0
                }
            }
        })

        //console.log(aggr)
        let alreadyLogged = false

        let attendances = await req.app.locals.db.main.AttendanceFlagLowering.aggregate(aggr)
        attendances = attendances.map(attendance => {
            if (!attendance.source.photo) {
                attendance.source.photo = lodash.get(attendance, 'extra.photo', '')
            }
            attendance.logTime = moment(attendance.dateTime).format('hh:mm A')

            if (lodash.invoke(employee, '_id.toString') === lodash.invoke(attendance, 'employeeId.toString')) {
                alreadyLogged = true
            }
            attendance = lodash.pickBy(attendance, function (a, key) {
                return ['_id', 'employeeId', 'logTime', 'source', 'employee'].includes(key)
            });
            return attendance
        })
        // return res.send(attendances)

        res.render('hros/flag-lowering/all.html', {
            flash: flash.get(req, 'attendance'),
            momentDate: momentDate,
            attendances: attendances,
            alreadyLogged: alreadyLogged,
            s3Prefix: `/${CONFIG.aws.bucket1.name}/${CONFIG.aws.bucket1.prefix}`,
            serverUrl: CONFIG.app.url,
        });
    } catch (err) {
        next(err);
    }
});
router.get('/hros/flag-lowering/create', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.isFlagLoweringDay, async (req, res, next) => {
    try {
        let user = res.user.toObject()
        let employee = res.employee.toObject()

        let data = {
            title: 'Human Resource Online Services (HROS) - Flag',
            flash: flash.get(req, 'hros'),
            user: user,
            employee: employee,
            momentNow: moment(),
        }
        res.render('hros/flag-lowering/create.html', data)
    } catch (err) {
        next(err);
    }
});
router.post('/hros/flag-lowering/log', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.isFlagLoweringDay, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        // return res.send(req.body)
        let body = req.body

        let lat = body.lat
        let lon = body.lon
        let webcamPhoto = body.webcamPhoto
        let campus = body.campus

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

        let momentDate = moment()

        // Log
        let attendance = await req.app.locals.db.main.AttendanceFlagLowering.create({
            employeeId: employee._id,
            dateTime: momentDate.toDate(),
            type: 'normal',
            source: {
                id: res.user._id,
                type: 'userAccount', // Online user account
                lat: lat,
                lon: lon,
                campus: campus,
                photo: lodash.get(saveList, 'photos[0]', ''),
            }
        })

        // 
        let query = {
            dateTime: {
                $gte: momentDate.clone().startOf('day').toDate(),
                $lte: momentDate.clone().endOf('day').toDate(),
            }
        }

        let aggr = []
        aggr.push({ $match: query })
        aggr.push({
            $lookup: {
                from: "employees",
                localField: "employeeId",
                foreignField: "_id",
                as: "employees"
            }
        })
        aggr.push({
            $addFields: {
                "employee": {
                    $arrayElemAt: ["$employees", 0]
                },
            }
        })
        // Turn array employees into field employee
        // Add field employee
        aggr.push({
            $project: {
                employees: 0,
            }
        })

        // Hide not needed for lighter payload
        aggr.push({
            $project: {
                employee: {
                    addresses: 0,
                    personal: 0,
                    employments: 0,
                    mobileNumber: 0,
                    phoneNumber: 0,
                    documents: 0,
                    createdAt: 0,
                    updatedAt: 0,
                    uuid: 0,
                    uid: 0,
                    group: 0,
                    __v: 0,
                    profilePhoto: 0,
                    acceptedDataPrivacy: 0,
                    birthDate: 0,
                    civilStatus: 0,
                    addressPermanent: 0,
                    addressPresent: 0,
                    email: 0,
                    history: 0,
                    speechSynthesisName: 0,
                    address: 0
                }
            }
        })

        aggr.push({
            $sort: { dateTime: 1 }
        })

        //console.log(aggr)
        let attendances = await req.app.locals.db.main.AttendanceFlagLowering.aggregate(aggr)
        attendances = attendances.map(attendance => {
            if (!attendance.source.photo) {
                attendance.source.photo = lodash.get(attendance, 'extra.photo', '')
            }
            attendance.logTime = moment(attendance.dateTime).format('hh:mm A')

            attendance = lodash.pickBy(attendance, function (a, key) {
                return ['_id', 'employeeId', 'logTime', 'source', 'employee'].includes(key)
            });
            return attendance
        })
        //return res.send(attendances)

        let room = momentDate.format('YYYY-MM-DD')
        req.app.locals.io.of("/flag-lowering").to(room).emit('added', attendances.pop())

        flash.ok(req, 'attendance', 'Attendance added.')
        res.send(attendance)
    } catch (err) {
        next(new AppError(err.message));
    }
});

router.post('/hros/flag/location', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
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

        if (!found) {
            return res.status(404).send('')
        }
        res.send(found.name)
    } catch (err) {
        next(new AppError(err.message));
    }
});

// Leave Form
router.use('/hros/leave', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, (req, res, next)=>{
    try {
        let employments = res.employee.employments
        let permanent = employments.map(emp=> emp.employmentType === 'permanent' ).reduce((prev, cur) => {
            return prev || cur 
        }, false)

        if(!permanent && req.originalUrl !== '/hros/leave/all'){
            flash.error(req, 'hros', `For permanent employment only.`)
            return res.redirect(`/hros/leave/all`)
        }
        
        next()
    } catch (err) {
        next(err)
    }
})
router.get('/hros/leave/all', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let lastId = lodash.get(req, 'query.lastId', '')
        let perPage = 100
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', -1))
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let lastName = lodash.get(req, 'query.lastName')
        lodash.set(req, 'session.pagination.perPage', perPage)

        let query = {
            employeeId: employee._id
        }

        if (lastId) {
            if (sortOrder === -1) {
                query = {
                    _id: {
                        $lt: req.app.locals.db.mongoose.Types.ObjectId(lastId)
                    }
                }
            } else {
                query = {
                    _id: {
                        $gt: req.app.locals.db.mongoose.Types.ObjectId(lastId)
                    }
                }
            }
        }

        let aggr = []

        // Sort by _id 
        aggr.push({ $sort: { _id: sortOrder } })
        aggr.push({ $match: query })
        if (!lastName) {
            aggr.push({ $limit: perPage })
        }
        aggr.push({
            $lookup:
            {
                localField: "employeeId",
                foreignField: "_id",
                from: "employees",
                as: "employees"
            }
        })
        aggr.push({
            $addFields: {
                "employee": {
                    $arrayElemAt: ["$employees", 0]
                }
            }
        })
        // Turn array employees into field employee
        // Add field employee
        aggr.push({
            $project: {
                employees: 0,
            }
        })
        let ats = await req.app.locals.db.main.LeaveForm.aggregate(aggr)
        ats = ats.map((l) => {
            l.leaveAvailedList = CONFIG.leaveTypes.filter((o) => {
                return l.leaveAvailed[o.key]
            }).map(o => o.label).join(', ')
            l.dates = l.dates.map(o => moment(o).format('MMM. DD, YYYY')).join(', ')
            return l
        })

        // 
        aggr = []
        // Sort by _id 
        aggr.push({ $match: query })
        aggr.push({ $sort: { _id: sortOrder } })
        let counts = await req.app.locals.db.main.LeaveForm.aggregate(aggr)
        // 

        let data = {
            title: 'Human Resource Online Services (HROS) - Authority to Travel',
            employee: employee,
            flash: flash.get(req, 'hros'),
            ats: ats,
            sortOrder: sortOrder,
            lastName: lastName,
            page: page,
            perPage: perPage,
            momentNow: moment(),
            count: counts.length
        }
        // return res.send(data)
        res.render('hros/leave/all.html', data);

    } catch (err) {
        next(err);
    }
});
router.get('/hros/leave/create', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let employments = employee.employments

        employments = employments.filter((o)=>{
            return o.employmentType === 'permanent'
        })
        const leaveTypes = CONFIG.leaveTypes

        // Schema: leaveAvailed.vacation = false, leaveAvailed.forced = false....
        let leaveAvailed = lodash.mapKeys(leaveTypes, (l) => {
            return l.key
        })
        leaveAvailed = lodash.mapValues(leaveAvailed, (l) => {
            return false
        })
        let data = {
            title: 'Human Resource Online Services (HROS) - Authority to Travel',
            flash: flash.get(req, 'hros'),
            employee: employee,
            employments: employments,
            employmentId: employments.at(0)?._id,
            momentNow: moment(),
            leaveTypes: leaveTypes,
            leaveAvailed: leaveAvailed,
        }
        res.render('hros/leave/create.html', data);
    } catch (err) {
        next(err);
    }
});
router.post('/hros/leave/create', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let user = res.user.toObject()
        let body = req.body

        let defaults = {
            employmentId: "",
            dates: "",
            "leaveAvailed.vacation": false,
            "leaveAvailed.forced": false,
            "leaveAvailed.sick": false,
            "leaveAvailed.maternity": false,
            "leaveAvailed.paternity": false,
            "leaveAvailed.specialPrivilege": false,
            "leaveAvailed.soloParent": false,
            "leaveAvailed.study": false,
            "leaveAvailed.tenDayVawc": false,
            "leaveAvailed.rehabPrivilege": false,
            "leaveAvailed.specialLeaveWomen": false,
            "leaveAvailed.calamity": false,
            "leaveAvailed.adoptionLeave": false,
            "leaveAvailed.others": false,
            otherLeaveSpecifics: "",
            isLocal: false,
            localDetails: "",
            isAbroad: false,
            abroadDetails: "",
            isInHospital: false,
            inHospitalDetails: "",
            isOutPatient: false,
            outPatientDetails: "",
            specialLeaveWomenDetails: "",
            isMastersDegree: false,
            isExamReview: false,
            isMonet: false,
            isTerminalLeave: false,
            isCommutationRequested: false
        }
        body = {
            ...defaults,
            ...body
        }
        if (body.dates) {
            body.dates = body.dates.split(',')
        }
        if (body.otherLeaveSpecifics) {
            body.otherLeaveSpecifics = body.otherLeaveSpecifics.replace(/\s\s+/g, ' ').slice(0, 40)
        }
        if (body.localDetails) {
            body.localDetails = body.localDetails.replace(/\s\s+/g, ' ').slice(0, 26)
        }
        if (body.abroadDetails) {
            body.abroadDetails = body.abroadDetails.replace(/\s\s+/g, ' ').slice(0, 26)
        }
        if (body.inHospitalDetails) {
            body.inHospitalDetails = body.inHospitalDetails.replace(/\s\s+/g, ' ').slice(0, 26)
        }
        if (body.outPatientDetails) {
            body.outPatientDetails = body.outPatientDetails.replace(/\s\s+/g, ' ').slice(0, 26)
        }
        if (body.specialLeaveWomenDetails) {
            body.specialLeaveWomenDetails = body.specialLeaveWomenDetails.replace(/\s\s+/g, ' ').slice(0, 40)
        }

        // return res.send(body)

        let employmentId = lodash.get(body, 'employmentId')
        let employment = await req.app.locals.db.main.Employment.findById(employmentId).lean()
        if (!employment) {
            flash.error(req, 'hros', 'Employment not found.')
            return res.redirect('/hros/leave/create')
        }

        let ats = await req.app.locals.db.main.LeaveForm.find({
            employmentId: employment._id,
            dates: {
                $in: body.dates.join(','), // @TODO: Remove need to rejoin
            },

        })
        if (ats.length > 0) {
            flash.error(req, 'hros', 'Cannot generate Leave Form using the provided date(s). There is an overlap with another Leave Form.')
            return res.redirect('/hros/leave/create')
        }

        // Latest
        let latest = await req.app.locals.db.main.LeaveForm.findOne({
            createdAt: {
                $gte: moment().startOf('month').toDate(),
            },
            createdAt: {
                $lte: moment().endOf('month').toDate(),
            }
        }).sort({
            createdAt: -1
        })

        let generateControlNumber = (latest) => {
            let parsed = latest.controlNumber.replace(' (Online)', '').split('-') // Split '24-01-002' into array of 3 elements
            let counter = parseInt(parsed.at(2)) // Get '002' as 2
            counter++ // increment
            const NOW = moment()
            if (parsed.at(0) !== NOW.format('YY')) {
                counter = 1
            }
            counter = new String(counter) // Convert to string
            return NOW.format('YY-MM-') + counter.padStart(3, '0') + ' (Online)'
        }

        let controlNumber = `${moment().format('YY-MM')}-001 (Online)`
        if (latest) {
            controlNumber = generateControlNumber(latest)
        }

        let leave = await req.app.locals.db.main.LeaveForm.create({
            employeeId: employee._id,
            employmentId: employment._id,
            status: 2, // 1 pending, 2 approved
            controlNumber: controlNumber,
            ...body
        })

        let message = `Leave Form generated. `
        message += `1.) Please print your Leave Form with Control No. ${controlNumber}. `
        message += `2.) Have it signed and approved. `

        flash.ok(req, 'hros', message)
        res.redirect(`/hros/leave/all`)
    } catch (err) {
        next(err);
    }
});
router.get('/hros/leave/:leaveId', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()
        let leave = await req.app.locals.db.main.LeaveForm.findOne({
            _id: req.params.leaveId,
            employeeId: employee._id,
        })
        if (!leave) {
            throw new Error('Leave Form not found.')
        }


        let words = leave.data.natureOfBusiness.replace(/\s\s+/g, ' ').split(' ')
        if (words.length > 32) {
            leave.data.natureOfBusiness1 = words.splice(0, 32).join(' ')
            leave.data.natureOfBusiness2 = words.splice(0, 25).join(' ')

        } else {
            leave.data.natureOfBusiness1 = words.join(' ')
            leave.data.natureOfBusiness2 = ''

        }

        let data = {
            title: `Leave Form - ${employee.firstName} ${employee.lastName} - ${leave.controlNumber}`,
            employee: employee,
            leave: leave,
            momentNow: moment(),
        }
        res.render('hros/leave/read.html', data);

    } catch (err) {
        next(err);
    }
});
router.get('/hros/leave/:leaveId/print', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let aggr = []
        aggr.push({
            $match: {
                _id: req.app.locals.db.mongoose.Types.ObjectId(req.params.leaveId),
                employeeId: req.app.locals.db.mongoose.Types.ObjectId(employee._id),
            }
        })
        aggr.push({
            $lookup: {
                localField: "employeeId",
                foreignField: "_id",
                from: "employees",
                as: "employees"
            }
        })
        aggr.push({
            $lookup: {
                localField: "employmentId",
                foreignField: "_id",
                from: "employments",
                as: "employments"
            }
        })
        aggr.push({
            $addFields: {
                "employee": {
                    $arrayElemAt: ["$employees", 0]
                },
                "employment": {
                    $arrayElemAt: ["$employments", 0]
                }
            }
        })
        // Turn array employees into field employee
        // Add field employee
        aggr.push({
            $project: {
                employees: 0,
                employments: 0,
            }
        })
        let leaves = await req.app.locals.db.main.LeaveForm.aggregate(aggr)
        let leave = leaves.at(0)
        if (!leave) {
            throw new Error('Leave Form not found.')
        }

        let leaveTypes = CONFIG.leaveTypes.filter(o => o.key !== 'others').map(o => {
            o.checked = leave.leaveAvailed[o.key]
            return o
        })

        leave.datesString = leave.dates.map(d => {
            return moment(d).format('MMM. DD, YYYY')
        }).join(', ')

        leave.leaveAvailedList = CONFIG.leaveTypes.filter((o) => {
            return leave.leaveAvailed[o.key]
        }).map(o => o.label).join(', ')

        let data = {
            title: `Leave Form - ${employee.firstName} ${employee.lastName} - ${leave.controlNumber}`,
            employee: employee,
            leave: leave,
            leaveTypes: leaveTypes,
            momentNow: moment(),
        }
        res.render('hros/leave/print.html', data);
    } catch (err) {
        next(err);
    }
});

module.exports = router;