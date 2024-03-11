//// Core modules
const path = require('path')

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
const address = require('../address');
const countries = require('../countries');
const dtrHelper = require('../dtr-helper');
const excelGen = require('../excel-gen');
const middlewares = require('../middlewares');
const passwordMan = require('../password-man');
const paginator = require('../paginator');
const suffixes = require('../suffixes');
const S3_CLIENT = require('../aws-s3-client')  // V3 SDK
const { AppError } = require('../errors');
const uploader = require('../uploader');
const workScheduler = require('../work-scheduler');

// Router
let router = express.Router()

router.use('/e/account', middlewares.requireAuthUser)

router.get('/e/account/password', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        let passphrase = passwordMan.genPassphrase(3)
        res.render('e/account/password.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
            passphrase: passphrase
        });

    } catch (err) {
        next(err);
    }
});

router.post('/e/account/check-password', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        const { timingSafeEqual } = require('crypto')

        let user = res.user
        let body = lodash.get(req, 'body')

        let password = lodash.trim(lodash.get(body, 'password'))

        // Check 
        let passwordHash = passwordMan.hashPassword(password, user.salt);
        if (!timingSafeEqual(Buffer.from(passwordHash, 'utf8'), Buffer.from(user.passwordHash, 'utf8'))) {
            throw new Error('Incorrect password.');
        }

        res.send({
            correct: true
        })
    } catch (err) {
        next(err);
    }
});

router.post('/e/account/password', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let user = res.user
        let body = lodash.get(req, 'body')

        let password = lodash.trim(lodash.get(body, 'oldPassword'))

        // Check password
        let passwordHash = passwordMan.hashPassword(password, user.salt);
        if (passwordHash !== user.passwordHash) {
            flash.error(req, 'employee', `Current Password is incorrect.`)
            return res.redirect(`/e/account/password`)
        }

        user.passwordHash = passwordMan.hashPassword(lodash.get(body, 'newPassword'), user.salt);
        await user.save()

        let employee = await req.app.locals.db.main.Employee.findOne({ userId: user._id });
        await req.app.locals.db.main.EmployeeHistory.create({
            employeeId: employee?._id || null,
            description: `User "${user.username}" changed the password.`,
            alert: `text-info`,
            userId: user._id,
            username: user.username,
            op: 'u',
        })
        flash.ok(req, 'employee', `Password changed successfully.`)
        return res.redirect(`/e/account/password`)
    } catch (err) {
        next(err);
    }
});

router.get('/e/account/photo', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        // if (employee.profilePhoto) {
        //     throw new Error('Profile photo temporarily locked.')
        // }
        res.render('e/account/photo.html', {
            employee: employee.toObject()
        });
    } catch (err) {
        next(err);
    }
});
router.post('/e/account/photo', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, fileUpload(), middlewares.handleExpressUploadMagic, async (req, res, next) => {
    try {
        let employee = res.employee
        if (employee.profilePhoto) {
            throw new Error('Profile photo temporarily locked.')
        }

        // Delete files on AWS S3
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'
        let photo = employee.profilePhoto
        if (photo) {
            let objects = [
                { Key: `${bucketKeyPrefix}${photo}` },
                { Key: `${bucketKeyPrefix}tiny-${photo}` },
                { Key: `${bucketKeyPrefix}small-${photo}` },
                { Key: `${bucketKeyPrefix}medium-${photo}` },
                { Key: `${bucketKeyPrefix}large-${photo}` },
                { Key: `${bucketKeyPrefix}xlarge-${photo}` },
                { Key: `${bucketKeyPrefix}orig-${photo}` },
            ]
            await S3_CLIENT.deleteObjects(bucketName, objects)
        }

        employee.profilePhoto = lodash.get(req, 'saveList.photo[0]')
        await employee.save()
        flash.ok(req, 'employee', `Profile photo updated.`)
        res.redirect(`/e-profile/home`);
    } catch (err) {
        next(err);
    }
});
router.get('/e/account/photo/delete', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, fileUpload(), middlewares.handleExpressUploadMagic, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        // Delete files on AWS S3
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'

        let photo = employee.profilePhoto
        if (photo) {
            let objects = [
                { Key: `${bucketKeyPrefix}${photo}` },
                { Key: `${bucketKeyPrefix}tiny-${photo}` },
                { Key: `${bucketKeyPrefix}small-${photo}` },
                { Key: `${bucketKeyPrefix}medium-${photo}` },
                { Key: `${bucketKeyPrefix}large-${photo}` },
                { Key: `${bucketKeyPrefix}xlarge-${photo}` },
                { Key: `${bucketKeyPrefix}orig-${photo}` },
            ]
            await S3_CLIENT.deleteObjects(bucketName, objects)
        }

        await req.app.locals.db.main.Employee.updateOne({ _id: employee._id }, { profilePhoto: '' })

        flash.ok(req, 'employee', `Profile photo deleted.`)
        res.redirect(`/e-profile/home`);
    } catch (err) {
        next(err);
    }
});

router.get('/e/account/webcam', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee

        res.render('e/account/webcam.html', {
            employee: employee.toObject()
        });
    } catch (err) {
        next(err);
    }
});
router.post('/e/account/webcam', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, middlewares.dataUrlToReqFiles(['photo']), middlewares.handleExpressUploadMagic, async (req, res, next) => {
    try {
        let employee = res.employee

        // Delete files on AWS S3
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'
        let photo = employee.profilePhoto
        if (photo) {
            let objects = [
                { Key: `${bucketKeyPrefix}${photo}` },
                { Key: `${bucketKeyPrefix}tiny-${photo}` },
                { Key: `${bucketKeyPrefix}small-${photo}` },
                { Key: `${bucketKeyPrefix}medium-${photo}` },
                { Key: `${bucketKeyPrefix}large-${photo}` },
                { Key: `${bucketKeyPrefix}xlarge-${photo}` },
                { Key: `${bucketKeyPrefix}orig-${photo}` },
            ]
            await S3_CLIENT.deleteObjects(bucketName, objects)
        }

        employee.profilePhoto = lodash.get(req, 'saveList.photo[0]')
        await employee.save()
        flash.ok(req, 'employee', `Profile photo updated.`)
        res.redirect(`/e-profile/home`);

    } catch (err) {
        next(err);
    }
});

// Email
router.get('/e/account/email', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e/account/email.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e/account/email', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let user = res.user
        let body = lodash.get(req, 'body')

        let password = lodash.trim(lodash.get(body, 'oldPassword'))

        // Check password
        let passwordHash = passwordMan.hashPassword(password, user.salt);
        if (passwordHash !== user.passwordHash) {
            flash.error(req, 'employee', `Current Password is incorrect.`)
            return res.redirect(`/e/account/email`)
        }

        user.passwordHash = passwordMan.hashPassword(lodash.get(body, 'newPassword'), user.salt);
        await user.save()

        let employee = await req.app.locals.db.main.Employee.findOne({ userId: user._id });
        await req.app.locals.db.main.EmployeeHistory.create({
            employeeId: employee?._id || null,
            description: `User "${user.username}" changed the password.`,
            alert: `text-info`,
            userId: user._id,
            username: user.username,
            op: 'u',
        })
        flash.ok(req, 'employee', `Password changed successfully.`)
        return res.redirect(`/e/account/email`)
    } catch (err) {
        next(err);
    }
});
module.exports = router;