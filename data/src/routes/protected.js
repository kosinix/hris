//// Core modules

//// External modules
const express = require('express')
const lodash = require('lodash')

//// Core modules
const util = require('util')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const s3 = require('../aws-s3');

// Router
let router = express.Router()

router.get('/', middlewares.requireAuthUser, async (req, res, next) => {
    try {
        let user = res.user.toObject()

        if (user.roles.includes('employee')) {
            return res.redirect('/e-profile/home')
        }
        if (user.roles.includes('clinical')) {
            return res.redirect('/hdf/all')
        }
        if (user.roles.includes('records')) {
            return res.redirect('/memo/all')
        }
        if (user.roles.includes('president') || user.roles.includes('campusdirectormosqueda') || user.roles.includes('campusdirectorbaterna')) {
            return res.redirect('/attendance/monthly')
        }
        if (user.roles.includes('checker')) {
            let scanner = await db.main.Scanner.findOne({
                userId: user._id
            })
            if (scanner) {
                return res.redirect(`${CONFIG.app.url}/scanner/${scanner.uid}/scan`)
            }
        }

        res.redirect('/employee/all');
    } catch (err) {
        next(err);
    }
});

router.use('/check', middlewares.requireAuthUser, middlewares.guardRoute([
    'read_all_employee',
    'create_employee',
    'read_employee',
    'update_employee',
    'delete_employee',

    'read_all_pass',
    'create_pass',
    'read_pass',
    'update_pass',
    'delete_pass',
]))

router.get('/check', async (req, res, next) => {
    try {

        res.render('check.html');
    } catch (err) {
        next(err);
    }
});

// View s3 object using html page
router.get('/file-viewer/:bucket/:prefix/:key', middlewares.requireAuthUser, async (req, res, next) => {
    try {
        let bucket = lodash.get(req, "params.bucket", "");
        let prefix = lodash.get(req, "params.prefix", "");
        let key = lodash.get(req, "params.key", "");

        let url = s3.getSignedUrl('getObject', {
            Bucket: bucket,
            Key: prefix + '/' + key
        })

        res.render('file-viewer.html', {
            url: url,
        });
    } catch (err) {
        next(err);
    }
});

// Get s3 object content
router.get('/file-getter/:bucket/:prefix/:key', async (req, res, next) => {
    try {
        let bucket = lodash.get(req, "params.bucket", "");
        let prefix = lodash.get(req, "params.prefix", "");
        let key = lodash.get(req, "params.key", "");

        let url = s3.getSignedUrl('getObject', {
            Bucket: bucket,
            Key: prefix + '/' + key,
        })

        res.redirect(url);
    } catch (err) {
        next(err);
    }
});

router.get('/address', middlewares.requireAuthUser, async (req, res, next) => {
    try {
        let search = lodash.get(req, 'query.s', '');
        let keys = search.split(',')
        keys = lodash.map(keys, (o) => {
            o = lodash.trim(o)
            o = o.replace(/(brgy\.)|(brgy)/, 'Barangay')
            return new RegExp(o, "i")

        })

        // Our address returned starts from bgy level
        let query = {
            level: 'Bgy'
        }
        if (keys.length === 0) {

        }
        if (keys.length === 1) {

            query = {
                $or: [
                    {
                        $and: [
                            { name: keys[0] },
                            { level: 'Bgy' },
                        ]
                    },
                    {
                        $and: [
                            { cityMunName: keys[0] },
                            { level: 'Bgy' },
                        ]
                    },
                    {
                        $and: [
                            { provName: keys[0] },
                            { level: 'Bgy' },
                        ]
                    }
                ]
            }

            if (keys[0].source.match(/([\w]+ city)/i)) {
                let custom = keys[0].source.replace(/ city/i, '')
                custom = `City of ${custom}`
                query.$or.push({
                    $and: [
                        { cityMunName: new RegExp(custom, 'i') },
                        { level: 'Bgy' },
                    ]
                })
            }

        } else if (keys.length === 2) {
            query = {
                $or: [
                    {
                        $and: [
                            { name: keys[0] },
                            { level: 'Bgy' },
                            { cityMunName: keys[1] }
                        ],
                    },
                    {
                        $and: [

                            { level: 'Bgy' },
                            { cityMunName: keys[0] },
                            { provName: keys[1] }
                        ],
                    },
                ]
            }
        } else {
            query = {
                $or: [
                    {
                        $and: [
                            { name: keys[0] },
                            { level: 'Bgy' },
                            { cityMunName: keys[1] },
                            { provName: keys[2] },
                        ],
                    },
                    {
                        $and: [
                            { name: keys[0] },
                            { level: 'Bgy' },
                            { cityMunName: keys[1] },
                        ],
                    },
                ]
            }
        }
        // console.log(util.inspect(query, false, null, true /* enable colors */))
        // raw ops
        let addresses = await db.main.Address.collection.find(query).limit(10).toArray()
        addresses = lodash.map(addresses, (o) => {
            let full = [o.name]
            if (o.cityMunName) {
                full.push(o.cityMunName)
            }
            if (o.provName) {
                full.push(o.provName)
            }
            return {
                id: o.code,
                name: full.join(', ')
            }
        })
        return res.send(addresses)

    } catch (err) {
        next(err);
    }
});

router.get('/employee', middlewares.requireAuthUser, async (req, res, next) => {
    try {
        let search = lodash.get(req, 'query.s', '');
        let showSalary = lodash.get(req, 'query.salary', 1);
        let keys = search.split(' ')
        keys = lodash.map(keys, (o) => {
            o = lodash.trim(o)
            return new RegExp(o, "i")
        })
        // console.log(keys)
        // Our address returned starts from bgy level
        let query = {
            $or: [
                {
                    firstName: keys[0]
                },
                {
                    lastName: keys[0]
                },
            ]
        }

        // console.log(util.inspect(query, false, null, true /* enable colors */))
        // raw ops
        // let employees = await db.main.Employee.collection.find(query).limit(10).toArray()
        let aggr = []
        aggr.push({ $match: query })
        aggr.push({ $limit: 10 })
        aggr.push({
            $lookup:
            {
                from: "employments",
                localField: "_id",
                foreignField: "employeeId",
                as: "employments"
            }
        })

        let employees = await db.main.Employee.aggregate(aggr)
        let ret = []
        employees.forEach((employee, i) => {
            let full = [employee.firstName]
            if (employee.lastName) {
                full.push(employee.lastName)
            }
            full = full.join(' ')

            employee.employments.forEach((employment, i) => {
                let final = `${full} - ${employment.position}`
                if (showSalary == 1) {
                    final += ` (${employment.salary})`
                }
                ret.push({
                    id: employment._id,
                    name: final
                })
            })
        })

        return res.send(ret)

    } catch (err) {
        next(err);
    }
});

router.get('/users', middlewares.requireAuthUser, async (req, res, next) => {
    try {
        let search = lodash.get(req, 'query.s', '');
        let keys = search.split(' ')
        keys = lodash.map(keys, (o) => {
            o = lodash.trim(o)
            return new RegExp(o, "i")

        })
        // console.log(keys)
        // Our address returned starts from bgy level
        let query = {
            $or: [
                {
                    firstName: keys[0]
                },
                {
                    lastName: keys[0]
                },
                {
                    username: keys[0]
                },
            ]
        }

        // console.log(util.inspect(query, false, null, true /* enable colors */))
        // raw ops
        let users = await db.main.User.collection.find(query).limit(10).toArray()
        users = lodash.map(users, (o) => {
            let full = [o.firstName]
            if (o.lastName) {
                full.push(o.lastName)
            }
            if (o.username) {
                full.push(' - ')
                full.push(o.username)
            }
            return {
                id: o._id,
                name: full.join(' ')
            }
        })
        return res.send(users)

    } catch (err) {
        next(err);
    }
});
module.exports = router;