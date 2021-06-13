//// Core modules
const fs = require('fs')

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const phAddress = require('ph-address')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const s3 = require('../aws-s3');

// Router
let router = express.Router()

router.use('/resident', middlewares.requireAuthUser )

router.get('/resident/all', middlewares.guardRoute(['read_all_resident', 'read_resident']), async (req, res, next) => {
    try {
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', lodash.get(req, 'session.pagination.perPage', 10)))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = parseInt(lodash.get(req, 'query.customSort'))
        lodash.set(req, 'session.pagination.perPage', perPage)

        let query = {}
        let projection = {}

        // Pagination
        let totalDocs = await db.main.Person.countDocuments(query)
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/resident/all',
            req.query
        )

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        // console.log(query, projection, options, sort)

        let residents = await db.main.Person.find(query, projection, options).sort(sort)

        res.render('resident/all.html', {
            flash: flash.get(req, 'resident'),
            residents: residents,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/resident/create', middlewares.guardRoute(['create_resident']), async (req, res, next) => {
    try {

        res.render('resident/create.html', {
        });
    } catch (err) {
        next(err);
    }
});
router.post('/resident/create', middlewares.guardRoute(['create_resident']), async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        lodash.set(patch, 'firstName', lodash.get(body, 'firstName'))
        lodash.set(patch, 'middleName', lodash.get(body, 'middleName'))
        lodash.set(patch, 'lastName', lodash.get(body, 'lastName'))
        lodash.set(patch, 'suffix', lodash.get(body, 'suffix'))
        lodash.set(patch, 'birthDate', lodash.get(body, 'birthDate'))
        lodash.set(patch, 'gender', lodash.get(body, 'gender'))
        
        // TODO: Check duplicate
        let matches = await db.main.Person.find({
            firstName: patch.firstName,
            middleName: patch.middleName,
            lastName: patch.lastName,
        })
        if(matches.length > 0){
            throw new Error("Dupe")
        }

        let person = new db.main.Person(patch)
        await person.save()
        flash.ok(req, 'resident', `Added ${person.firstName} ${person.lastName}.`)
        res.redirect(`/resident/address/${person._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/resident/personal/:personId', middlewares.guardRoute(['create_resident', 'update_resident']), middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person

        res.render('resident/personal.html', {
            flash: flash.get(req, 'resident'),
            person: person,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/resident/personal/:personId', middlewares.guardRoute(['create_resident', 'update_resident']), middlewares.getPerson, async (req, res, next) => {
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
        flash.ok(req, 'resident', `Updated ${person.firstName} ${person.lastName} personal info.`)
        res.redirect(`/resident/address/${person._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/resident/address/:personId', middlewares.guardRoute(['create_resident', 'update_resident']), middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        person.address = await db.main.Address.findOneFullAddress({
            code: person.addressPsgc
        })
        res.render('resident/address.html', {
            flash: flash.get(req, 'resident'),
            person: person,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/resident/address/:personId', middlewares.guardRoute(['create_resident', 'update_resident']), middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        let body = req.body
        let patch = {}

        if(!body.psgc){
            throw new Error('Invalid address.')
        }
        
        
        lodash.set(patch, 'addresses.0._id', db.mongoose.Types.ObjectId())
        lodash.set(patch, 'addresses.0.unit', lodash.get(body, 'unit'))
        lodash.set(patch, 'addresses.0.psgc', lodash.get(body, 'psgc'))
        lodash.set(patch, 'addressPermanent', lodash.get(patch, 'addresses.0._id'))
        let address = await db.main.Address.findOne({
            code: lodash.get(body, 'psgc', '')
        })
        if(address){
            lodash.set(patch, 'addresses.0.full', lodash.get(address, 'full'))
            lodash.set(patch, 'address', lodash.get(address, 'full'))
        }

        lodash.merge(person, patch)
        await person.save()
        flash.ok(req, 'resident', `Updated ${person.firstName} ${person.lastName} address.`)
        res.redirect(`/resident/income/${person._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/resident/income/:personId', middlewares.guardRoute(['create_resident', 'update_resident']), middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        let regions = lodash.map(phAddress.regions, (o) => {
            return {
                value: o.regCode,
                text: o.regDesc,
            }
        })
        res.render('resident/income.html', {
            flash: flash.get(req, 'resident'),
            person: person,
            regions: regions,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/resident/income/:personId', middlewares.guardRoute(['create_resident', 'update_resident']), middlewares.getPerson, async (req, res, next) => {
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
        flash.ok(req, 'resident', `Updated ${person.firstName} ${person.lastName} address.`)
        res.redirect(`/resident/income/${person._id}`)
    } catch (err) {
        next(err);
    }
});

router.post('/resident/income/:personId/employment/add', middlewares.guardRoute(['create_resident', 'update_resident']), middlewares.getPerson, async (req, res, next) => {
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
        flash.ok(req, 'resident', `Income added.`)
        res.redirect(`/resident/income/${person._id}`)

    } catch (err) {
        next(err);
    }
});

router.get('/resident/passes/:personId', middlewares.guardRoute(['create_resident', 'update_resident']), middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        res.render('resident/passes.html', {
            flash: flash.get(req, 'resident'),
            person: person,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/resident/passes/:personId', middlewares.guardRoute(['create_resident', 'update_resident']), middlewares.getPerson, async (req, res, next) => {
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
        flash.ok(req, 'resident', `Issued pass.`)
        res.redirect(`/resident/passes/${person._id}`)
    } catch (err) {
        next(err);
    }
});


router.get('/resident/photo/:personId', middlewares.guardRoute(['create_resident', 'update_resident']), middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person

        res.render('resident/photo.html', {
            person: person
        });
    } catch (err) {
        next(err);
    }
});
router.post('/resident/photo/:personId', middlewares.guardRoute(['create_resident', 'update_resident']), middlewares.getPerson, fileUpload(), middlewares.handleExpressUploadMagic, async (req, res, next) => {
    try {
        let person = res.person

        person.profilePhoto = lodash.get(req, 'saveList.photo[0]')
        await person.save()
        flash.ok(req, 'resident', `Updated ${person.firstName} ${person.lastName} photo.`)
        res.redirect(`/resident/personal/${person._id}`);
    } catch (err) {
        next(err);
    }
});


router.get('/resident/id-card/:personId', middlewares.guardRoute(['create_resident', 'update_resident']), middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        let qrCodeSvg = qr.imageSync(person.uid, { size: 3, type: 'svg' })
        res.render('resident/id-card.html', {
            person: person,
            qrCodeSvg: qrCodeSvg,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/resident/find', middlewares.guardRoute(['create_resident', 'update_resident']), async (req, res, next) => {
    try {
        let code = req.query.code
        let person = await db.main.Person.findOne({
            uid: code
        })
        if(!person){
            throw new Error('Not found')
        }
        res.redirect(`/resident/personal/${person._id}`)
    } catch (err) {
        next(err);
    }
});


router.get('/resident/delete/:personId', middlewares.guardRoute(['delete_resident']), middlewares.getPerson, async (req, res, next) => {
    try {
        let person = res.person
        let personPlain = person.toObject()


        // Delete files on AWS S3
        const bucketName = CONFIG.aws.bucket1.name
        const bucketKeyPrefix = CONFIG.aws.bucket1.prefix + '/'

        let promises = []

        let photo = personPlain.profilePhoto
        if(photo) {
            let promise = s3.deleteObjects({
                Bucket: bucketName,
                Delete: {
                    Objects: [
                        {Key: `${bucketKeyPrefix}${photo}`},
                        {Key: `${bucketKeyPrefix}tiny-${photo}`},
                        {Key: `${bucketKeyPrefix}small-${photo}`},
                        {Key: `${bucketKeyPrefix}medium-${photo}`},
                        {Key: `${bucketKeyPrefix}large-${photo}`},
                        {Key: `${bucketKeyPrefix}xlarge-${photo}`},
                        {Key: `${bucketKeyPrefix}orig-${photo}`},
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

        flash.ok(req, 'resident', `"${personPlain.firstName} ${personPlain.lastName}" deleted.`)
        res.redirect(`/resident/all`);
    } catch (err) {
        next(err);
    }
});

module.exports = router;