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

//// Modules
const middlewares = require('../middlewares');
const passwordMan = require('../password-man');
const S3_CLIENT = require('../aws-s3-client')  // V3 SDK
const mailer = require('../mailer');
const nunjucksEnv = require('../nunjucks-env');

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

router.get('/e/account/email-change', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let employee = res.employee.toObject()

        res.render('e/account/email-change.html', {
            flash: flash.get(req, 'employee'),
            employee: employee,
            momentNow: moment(),
        });

    } catch (err) {
        next(err);
    }
});
router.post('/e/account/email-change', middlewares.guardRoute(['use_employee_profile']), middlewares.requireAssocEmployee, async (req, res, next) => {
    try {
        let user = res.user
        let body = lodash.get(req, 'body')

        let email = lodash.trim(lodash.get(body, 'email'))

        if (email === user.email) {
            throw new Error('Nothing to change. Same email.')
        }

        // Timeout
        let emailPendingChangeUrlExpiry = user.settings?.emailPendingChangeUrlExpiry
        if (emailPendingChangeUrlExpiry) {
            let expiry = moment(emailPendingChangeUrlExpiry)
            let diff = expiry.diff(moment(), 'days')
            if (diff <= 1) {
                throw new Error(`Pending request, please wait after ${expiry.format('MMM DD, YYYY hh:mm A')} and try again.`)
            }
        }

        // Check email availability
        let existingEmail = await req.app.locals.db.main.User.findOne({
            email: email,
            _id: {
                $ne: user._id
            }
        })
        if (existingEmail) {
            throw new Error(`Email "${email}" already exists. Please choose a different one.`)
        }


        user.settings.emailPendingChangeUrl = `${CONFIG.app.url}/change-email/${user._id}/${passwordMan.hashSha256(passwordMan.randomString())}`
        user.settings.emailPendingChangeUrlExpiry = moment().add(1, 'day').toDate()

        let firstName = user.firstName
        let data = {
            baseUrl: `${CONFIG.app.url}`,
            firstName: firstName,
            subject: 'Email Change Request',
            link: user.settings.emailPendingChangeUrl,
        }
        let mailOptions = {
            from: `GSU HRIS <hris-noreply@gsu.edu.ph>`,
            to: email,
            subject: 'Email Change Request',
            text: nunjucksEnv.render('emails/change-email.txt', data),
            html: nunjucksEnv.render('emails/change-email.html', data),
        }

        if (ENV !== 'dev') {
            mailer.transport2.sendMail(mailOptions).then(function (result) {
                // console.log(result, 'Email sent')
            }).catch(err => {
                console.error(err)
            })
        } else {
            console.log(mailOptions.text)
        }

        user.settings.emailPendingValue = email
        user.settings.emailPendingStatus = true
        await user.save()

        flash.ok(req, 'employee', `Email change requested.`)
        return res.redirect(`/e/account/email`)
    } catch (err) {
        next(err);
    }
});
module.exports = router;