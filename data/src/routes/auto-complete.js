//// Core modules

//// External modules
const express = require('express')
const lodash = require('lodash')

/**
 * Use by the auto-complete field
 */
//// Core modules
const util = require('util')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');

// Router
let router = express.Router()

// Require authenticated users (logged-in)
router.use('/auto-complete', middlewares.requireAuthUser)

// Allowed for all authenticated users
router.get('/auto-complete/address', async (req, res, next) => {
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

// Limit by permissions
// Get employment given search string
router.get('/auto-complete/employee', middlewares.guardRoute(['read_all_employee', 'read_employee']), async (req, res, next) => {
    try {
        let search = lodash.get(req, 'query.s', '')
        let showSalary = lodash.get(req, 'query.salary', 1)
        let ignore = lodash.get(req, 'query.ignore', '')

        let words = search.split(' ')
        words = lodash.map(words, (o) => {
            o = lodash.trim(o)
            return new RegExp(o, "i")
        })
        // console.log(words)

        let query = {
            $and: []
        }
        // Ignore employments with these IDs
        if (ignore) {
            query['$and'].push({
                _id: {
                    $nin: ignore.split(',').map(id => new db.mongoose.Types.ObjectId(id))
                }
            })
        }
        // 1 word
        if (words.length === 1) {
            query['$and'].push({
                $or: [
                    {
                        'employee.firstName': words[0]
                    },
                    {
                        'employee.lastName': words[0]
                    },
                ],
            })
        } else if (words.length > 1) { // 2 or more words
            query['$and'].push({
                $or: [
                    {
                        'employee.firstName': words[0]
                    },
                    {
                        'employee.lastName': words[1]
                    },
                    {
                        'employee.firstName': words[1]
                    },
                    {
                        'employee.lastName': words[0]
                    },
                ],
            })
        }

        // console.log(util.inspect(query, false, null, true /* enable colors */))
        let aggr = []

        // Join
        aggr.push({
            $lookup: {
                localField: 'employeeId',
                foreignField: '_id',
                from: 'employees',
                as: 'employees'
            }
        })
        // Employment can only have one employee, move employees[0] to employment
        aggr.push({
            $addFields: {
                "employee": {
                    $arrayElemAt: ["$employees", 0]
                }
            }
        })
        // Remove employees[]
        aggr.push({
            $project: {
                employees: 0,
            }
        })
        // Our search query
        aggr.push({ $match: query })
        // Limit to 10 results only to reduce http load
        aggr.push({ $limit: 10 })


        let employments = await db.main.Employment.aggregate(aggr)
        // console.log(util.inspect(aggr, false, null, true /* enable colors */))

        let results = employments.map((employment, i) => {
            let display = []
            if (employment.employee.firstName) {
                display.push(employment.employee.firstName)
            }
            if (employment.employee.lastName) {
                display.push(employment.employee.lastName)
            }

            display.push('-')

            display.push(employment.position)

            if (showSalary == 1) {
                display.push(employment.salary)
            }

            return {
                id: employment._id,
                name: display.join(' ')
            }
        })

        res.send(results)

    } catch (err) {
        next(err);
    }
});
router.get('/auto-complete/employee-list', middlewares.guardRoute(['read_all_employee', 'read_employee']), async (req, res, next) => {
    try {
        let search = lodash.get(req, 'query.s', '')
        let ignore = lodash.get(req, 'query.ignore', '')

        let words = lodash.trim(search)
        if (words) {
            words = new RegExp(words, "i")
        }
        // console.log(words)

        let query = {}

        // Ignore employments with these IDs
        if (ignore) {
            query['_id'] = {
                $nin: ignore.split(',').map(id => new db.mongoose.Types.ObjectId(id))
            }
        }
        if (words) {
            query['name'] = words
        }

        // console.log(util.inspect(query, false, null, true /* enable colors */))
        let aggr = []

        // Our search query
        aggr.push({ $match: query })

        // Limit to 10 results only to reduce http load
        aggr.push({ $limit: 10 })


        let employeeLists = await db.main.EmployeeList.aggregate(aggr)
        // console.log(util.inspect(aggr, false, null, true /* enable colors */))

        let results = employeeLists.map((employeeList, i) => {
            return {
                id: employeeList._id,
                name: employeeList.name + ' - ' + employeeList.tags.join(', ')
            }
        })

        res.send(results)

    } catch (err) {
        next(err);
    }
});

module.exports = router;