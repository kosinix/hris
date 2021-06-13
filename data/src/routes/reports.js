//// Core modules
const fs = require('fs')

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const phAddress = require('ph-address')
const lodash = require('lodash')
const lodashGet = require('lodash.get')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const s3 = require('../aws-s3');

// Router
let router = express.Router()

router.use('/reports', middlewares.requireAuthUser)
router.use('/reports', middlewares.guardRoute(['read_all_admin', 'create_admin', 'read_admin', 'update_admin', 'delete_admin']))

router.get('/reports/all', async (req, res, next) => {
    try {
        let logs = await db.main.Log.find({
            enteredAt: {
                $gte: moment('2020-08-20').toDate(),
                $lt: moment('2020-08-21').toDate()
            }
        })

        let promises = logs.map((log, i) => {
            return db.main.Person.findById(log.personId)
        })
        let residents = await Promise.all(promises)
        // return res.send(residents)
        res.render('reports/all.html', {
            flash: flash.get(req, 'reports'),
            residents: residents
        });
    } catch (err) {
        next(err);
    }
});

router.get('/reports/person', async (req, res, next) => {
    try {
        // let logs = await db.main.Log.find({
        //     enteredAt: {
        //         $gte: moment('2020-08-20').toDate(),
        //         $lt: moment('2020-08-21').toDate()
        //     }
        // })

        let firstName = lodashGet(req, 'query.firstName', '')
        let middleName = lodashGet(req, 'query.middleName', '')
        let lastName = lodashGet(req, 'query.lastName', '')

        let persons = await db.main.Person.find({
            firstName: firstName,
            middleName: middleName,
            lastName: lastName,
        })
      
        res.render('reports/person.html', {
            flash: flash.get(req, 'reports'),
            persons: persons,
            query: req.query
        });
    } catch (err) {
        next(err);
    }
});


router.get('/reports/person/:personId/logs', async (req, res, next) => {
    try {
        // let logs = await db.main.Log.find({
        //     enteredAt: {
        //         $gte: moment('2020-08-20').toDate(),
        //         $lt: moment('2020-08-21').toDate()
        //     }
        // })

        let personId = lodashGet(req, 'params.personId', '')

        let person = await db.main.Person.findById(personId)
      
        let logs = await db.main.Log.find({
            personId: personId,
        })

        for (let x = 0; x < logs.length; x++) {
            let log = logs[x].toObject()
            log.person = person.toObject()
            log.entity = await db.main.Entity.findOne({
                _id: log.entityId
            })
            log.scannerIn = await db.main.Scanner.findOne({
                _id: log.enteredOn
            })
            log.scannerOut = await db.main.Scanner.findOne({
                _id: log.exitedOn
            })
            logs[x] = log
        }

        res.render('reports/person-logs.html', {
            flash: flash.get(req, 'reports'),
            logs: logs
        });
    } catch (err) {
        next(err);
    }
});

router.get('/reports/create', async (req, res, next) => {
    try {

        res.render('reports/create.html', {});
    } catch (err) {
        next(err);
    }
});
router.post('/reports/create', async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        lodash.set(patch, 'firstName', lodash.get(body, 'firstName'))
        lodash.set(patch, 'middleName', lodash.get(body, 'middleName'))
        lodash.set(patch, 'lastName', lodash.get(body, 'lastName'))
        lodash.set(patch, 'suffix', lodash.get(body, 'suffix'))
        lodash.set(patch, 'birthDate', lodash.get(body, 'birthDate'))
        lodash.set(patch, 'gender', lodash.get(body, 'gender'))
        // lodash.set(patch, 'addresses.0._id', db.mongoose.Types.ObjectId())
        // lodash.set(patch, 'addresses.0.unit', lodash.get(body, 'unit1'))
        // lodash.set(patch, 'addresses.0.brgyDistrict', lodash.get(body, 'brgyDistrict1'))
        // lodash.set(patch, 'addresses.0.cityMun', lodash.get(body, 'cityMun1'))
        // lodash.set(patch, 'addresses.0.province', lodash.get(body, 'province1'))
        // lodash.set(patch, 'addresses.0.region', lodash.get(body, 'region1'))
        // lodash.set(patch, 'addresses.1._id', db.mongoose.Types.ObjectId())
        // lodash.set(patch, 'addresses.1.unit', lodash.get(body, 'unit2'))
        // lodash.set(patch, 'addresses.1.brgyDistrict', lodash.get(body, 'brgyDistrict2'))
        // lodash.set(patch, 'addresses.1.cityMun', lodash.get(body, 'cityMun2'))
        // lodash.set(patch, 'addresses.1.province', lodash.get(body, 'province2'))
        // lodash.set(patch, 'addresses.1.region', lodash.get(body, 'region2'))
        // lodash.set(patch, 'addressPermanent', lodash.get(patch, 'addresses.0._id'))
        // lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.1._id'))
        // if(body.addressSame === 'true'){
        //     patch.addresses.splice(1,1) // Remove second array
        //     lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.0._id'))
        // }

        // TODO: Check duplicate

        let person = new db.main.Person(patch)
        await person.save()
        flash.ok(req, 'reports', `Added ${person.firstName} ${person.lastName}.`)
        res.redirect(`/reports/address/${person._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/reports/personal/:personId', middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person

        res.render('reports/personal.html', {
            flash: flash.get(req, 'reports'),
            person: person,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/reports/personal/:personId', middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        let body = req.body
        let patch = {}
        lodash.set(patch, 'firstName', lodash.get(body, 'firstName'))
        lodash.set(patch, 'middleName', lodash.get(body, 'middleName'))
        lodash.set(patch, 'lastName', lodash.get(body, 'lastName'))
        lodash.set(patch, 'suffix', lodash.get(body, 'suffix'))
        lodash.set(patch, 'birthDate', lodash.get(body, 'birthDate'))
        lodash.set(patch, 'gender', lodash.get(body, 'gender'))
        lodash.set(patch, 'civilStatus', lodash.get(body, 'civilStatus'))

        lodash.merge(person, patch)
        await person.save()
        flash.ok(req, 'reports', `Updated ${person.firstName} ${person.lastName} personal info.`)
        res.redirect(`/reports/address/${person._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/reports/address/:personId', middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        let regions = lodash.map(phAddress.regions, (o) => {
            return {
                value: o.regCode,
                text: o.regDesc,
            }
        })
        res.render('reports/address.html', {
            flash: flash.get(req, 'reports'),
            person: person,
            regions: regions,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/reports/address/:personId', middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        let body = req.body
        let patch = {}

        lodash.set(patch, 'addresses.0._id', db.mongoose.Types.ObjectId())
        lodash.set(patch, 'addresses.0.unit', lodash.get(body, 'unit1'))
        lodash.set(patch, 'addresses.0.brgyDistrict', lodash.get(body, 'brgyDistrict1'))
        lodash.set(patch, 'addresses.0.cityMun', lodash.get(body, 'cityMun1'))
        lodash.set(patch, 'addresses.0.province', lodash.get(body, 'province1'))
        lodash.set(patch, 'addresses.0.region', lodash.get(body, 'region1'))
        // lodash.set(patch, 'addresses.1._id', db.mongoose.Types.ObjectId())
        // lodash.set(patch, 'addresses.1.unit', lodash.get(body, 'unit2'))
        // lodash.set(patch, 'addresses.1.brgyDistrict', lodash.get(body, 'brgyDistrict2'))
        // lodash.set(patch, 'addresses.1.cityMun', lodash.get(body, 'cityMun2'))
        // lodash.set(patch, 'addresses.1.province', lodash.get(body, 'province2'))
        // lodash.set(patch, 'addresses.1.region', lodash.get(body, 'region2'))
        lodash.set(patch, 'addressPermanent', lodash.get(patch, 'addresses.0._id'))
        // lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.1._id'))
        // if(body.addressSame === 'true'){
        //     patch.addresses.splice(1,1) // Remove second array
        //     lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.0._id'))
        // }


        lodash.merge(person, patch)
        await person.save()
        flash.ok(req, 'reports', `Updated ${person.firstName} ${person.lastName} address.`)
        res.redirect(`/reports/income/${person._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/reports/income/:personId', middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        let regions = lodash.map(phAddress.regions, (o) => {
            return {
                value: o.regCode,
                text: o.regDesc,
            }
        })
        res.render('reports/income.html', {
            flash: flash.get(req, 'reports'),
            person: person,
            regions: regions,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/reports/income/:personId', middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        let body = req.body
        let patch = {}

        lodash.set(patch, 'addresses.0._id', db.mongoose.Types.ObjectId())
        lodash.set(patch, 'addresses.0.unit', lodash.get(body, 'unit1'))
        lodash.set(patch, 'addresses.0.brgyDistrict', lodash.get(body, 'brgyDistrict1'))
        lodash.set(patch, 'addresses.0.cityMun', lodash.get(body, 'cityMun1'))
        lodash.set(patch, 'addresses.0.province', lodash.get(body, 'province1'))
        lodash.set(patch, 'addresses.0.region', lodash.get(body, 'region1'))
        // lodash.set(patch, 'addresses.1._id', db.mongoose.Types.ObjectId())
        // lodash.set(patch, 'addresses.1.unit', lodash.get(body, 'unit2'))
        // lodash.set(patch, 'addresses.1.brgyDistrict', lodash.get(body, 'brgyDistrict2'))
        // lodash.set(patch, 'addresses.1.cityMun', lodash.get(body, 'cityMun2'))
        // lodash.set(patch, 'addresses.1.province', lodash.get(body, 'province2'))
        // lodash.set(patch, 'addresses.1.region', lodash.get(body, 'region2'))
        lodash.set(patch, 'addressPermanent', lodash.get(patch, 'addresses.0._id'))
        // lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.1._id'))
        // if(body.addressSame === 'true'){
        //     patch.addresses.splice(1,1) // Remove second array
        //     lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.0._id'))
        // }


        lodash.merge(person, patch)
        await person.save()
        flash.ok(req, 'reports', `Updated ${person.firstName} ${person.lastName} address.`)
        res.redirect(`/reports/income/${person._id}`)
    } catch (err) {
        next(err);
    }
});

router.post('/reports/income/:personId/employment/add', middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        let body = req.body
        let incomes = lodash.get(person, 'incomes', [])

        let income = {
            type: 'employed',
            employmentSector: body.employmentSector,
            occupation: body.occupation,
            employmentStatus: body.employmentStatus,
            estimatedMonthlyIncome: body.estimatedMonthlyIncome
        }
        incomes.push(income)
        person.incomes = incomes
        await person.save()
        flash.ok(req, 'reports', `Income added.`)
        res.redirect(`/reports/income/${person._id}`)

    } catch (err) {
        next(err);
    }
});

router.get('/reports/passes/:personId', middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        res.render('reports/passes.html', {
            flash: flash.get(req, 'reports'),
            person: person,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/reports/passes/:personId', middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        let body = req.body
        let passes = lodash.get(person, 'passes', [])

        let pass = {
            type: body.type,
            createdAt: moment().toDate(),
            expiredAt: moment().add(1, 'days').toDate(),
        }
        passes.push(pass)
        person.passes = passes
        await person.save()
        flash.ok(req, 'reports', `Issued pass.`)
        res.redirect(`/reports/passes/${person._id}`)
    } catch (err) {
        next(err);
    }
});


router.get('/reports/photo/:personId', middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person

        res.render('reports/photo.html', {
            person: person
        });
    } catch (err) {
        next(err);
    }
});
router.post('/reports/photo/:personId', middlewares.getPerson, fileUpload(), middlewares.handleExpressUploadMagic, async (req, res, next) => {
    try {
        let person = res.person

        person.profilePhoto = lodash.get(req, 'saveList.photo[0]')
        await person.save()
        flash.ok(req, 'reports', `Updated ${person.firstName} ${person.lastName} photo.`)
        res.redirect(`/reports/personal/${person._id}`);
    } catch (err) {
        next(err);
    }
});


router.get('/reports/id-card/:personId', middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        let qrCodeSvg = qr.imageSync(person.uid, { size: 3, type: 'svg' })
        res.render('reports/id-card.html', {
            person: person,
            qrCodeSvg: qrCodeSvg,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/reports/find', async (req, res, next) => {
    try {
        let code = req.query.code
        let person = await db.main.Person.findOne({
            uid: code
        })
        if (!person) {
            throw new Error('Not found')
        }
        res.redirect(`/reports/personal/${person._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/reports/delete/:personId', middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        let personPlain = person.toObject()


        // Delete files on AWS S3
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'

        let promises = []

        let photo = personPlain.profilePhoto
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
        lodash.each(personPlain.documents, (document) => {
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

        await person.remove()

        flash.ok(req, 'reports', `"${personPlain.firstName} ${personPlain.lastName}" deleted.`)
        res.redirect(`/reports/all`);
    } catch (err) {
        next(err);
    }
});

module.exports = router;