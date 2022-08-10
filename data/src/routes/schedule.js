//// Core modules

//// External modules
const kalendaryo = require('kalendaryo')
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const moment = require('moment')
const momentRange = require('moment-range')
const momentExt = momentRange.extendMoment(moment)

//// Modules
const dtrHelper = require('../dtr-helper')
const excelGen = require('../excel-gen')
const middlewares = require('../middlewares')
const workScheduler = require('../work-scheduler')


// Router
let router = express.Router()

router.use('/schedule', middlewares.requireAuthUser)

// Work Schedule
router.get('/schedule/all', middlewares.guardRoute(['read_all_schedule', 'read_schedule']), async (req, res, next) => {
    try {
        let schedules = await req.app.locals.db.main.WorkSchedule.find().lean()
        schedules = schedules.map((o) => {
            o.timeSegments = o.timeSegments.map((t) => {
                t.start = moment().startOf('day').minutes(t.start).format('hh:mm A')
                t.end = moment().startOf('day').minutes(t.end).format('hh:mm A')
                return t
            })
            return o
        })

        res.render('schedule/all.html', {
            flash: flash.get(req, 'schedule'),
            schedules: schedules,
        });
    } catch (err) {
        next(err);
    }
});
router.get('/schedule/create', middlewares.guardRoute(['create_schedule']), async (req, res, next) => {
    try {

        let employeeLists = await req.app.locals.db.main.EmployeeList.find({}, { _id: 1, name: 1 })
        res.render('schedule/create.html', {
            flash: flash.get(req, 'schedule'),
            employeeLists: employeeLists,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/schedule/create', middlewares.guardRoute(['create_schedule']), async (req, res, next) => {
    try {

        let body = lodash.get(req, 'body')

        let name = lodash.get(body, 'name')
        let visibility = lodash.get(body, 'visibility', '')
        let memberIds = lodash.get(body, 'memberIds')

        // return res.send(body)



        let timeSegments = lodash.get(req, 'body.timeSegments', [])
        if (timeSegments.length <= 0) {
            let err = new Error('No time segments.')
            err.type = 'flash'
            throw err
        }

        let errors = []
        timeSegments.forEach((timeSegment, i) => {
            let momentStart = moment.utc(timeSegment.start, 'HH:mm')
            let momentEnd = moment.utc(timeSegment.end, 'HH:mm')
            if (!momentStart.isValid()) {
                errors.push(`Start time for segment #${i + 1} is invalid.`)
            }
            if (!momentEnd.isValid()) {
                errors.push(`End time for segment #${i + 1} is invalid.`)
            }
        })
        if (errors.length > 0) {
            let err = new Error(`${errors.join(' ')}`)
            err.type = 'flash'
            throw err
        }
        timeSegments = timeSegments.map((timeSegment, i) => {
            timeSegment.start = moment.utc(timeSegment.start, 'HH:mm').hours() * 60 + moment.utc(timeSegment.start, 'HH:mm').minutes()
            timeSegment.end = moment.utc(timeSegment.end, 'HH:mm').hours() * 60 + moment.utc(timeSegment.end, 'HH:mm').minutes()
            timeSegment.grace = (lodash.toNumber(lodash.get(timeSegment, 'grace', 0)))
            timeSegment.maxHours = (timeSegment.end - timeSegment.start) / 60
            timeSegment.flexible = false
            return timeSegment
        })

        let members = []
        if (visibility === 'members') {
            if (!memberIds) {
                let err = new Error('No members selected.')
                err.type = 'flash'
                throw err
            } else {
                memberIds = memberIds.split(',').map(id => new req.app.locals.db.mongoose.Types.ObjectId(id))
                for (let x = 0; x < memberIds.length; x++) {
                    let memberId = memberIds[x]
                    let objectId = null
                    let name = ''
                    let type = ''

                    let employment = await req.app.locals.db.main.Employment.findById(memberId)
                    if (employment) {
                        objectId = employment._id
                        type = 'employment'
                        let employee = await req.app.locals.db.main.Employee.findById(employment.employeeId)
                        if (employee) {
                            name = `${employee.firstName} ${employee.lastName} - ${employment.position}`
                        }
                    } else {
                        let employeeList = await req.app.locals.db.main.EmployeeList.findById(memberId)
                        if (employeeList) {
                            objectId = employeeList._id
                            name = `${employeeList.name} - ${employeeList.tags.join(',')}`
                            type = 'list'
                        }
                    }
                    if (objectId && name && type) {
                        members.push({
                            objectId: objectId,
                            name: name,
                            type: type,
                        })
                    }

                }
            }
        }

        let patch = {
            name: name,
            visibility: visibility,
            members: members,
            timeSegments: timeSegments
        }
        // return res.send(patch)
        await req.app.locals.db.main.WorkSchedule.create(patch)
        flash.ok(req, 'schedule', `Work schedule created.`)
        return res.redirect('/schedule/all')
    } catch (err) {
        if (err.type === 'flash') {
            flash.error(req, 'schedule', `Error: ${err.message}`)
            return res.redirect('/schedule/create')
        }
        next(err);
    }
});

router.get('/schedule/:scheduleId', middlewares.guardRoute(['update_schedule']), middlewares.getSchedule, async (req, res, next) => {
    try {
        let schedule = res.schedule.toObject()

        schedule.timeSegments = schedule.timeSegments.map((t) => {
            t.start = moment().startOf('day').minutes(t.start).format('hh:mm A')
            t.end = moment().startOf('day').minutes(t.end).format('hh:mm A')
            return t
        })

        let employeeLists = await req.app.locals.db.main.EmployeeList.find({
            tags: {
                $in: ['Employment']
            }
        })

        res.render('schedule/read.html', {
            flash: flash.get(req, 'schedule'),
            schedule: schedule,
            employeeLists: employeeLists
        });
    } catch (err) {
        next(err);
    }
});
router.post('/schedule/:scheduleId/members', middlewares.guardRoute(['update_schedule']), middlewares.getSchedule, async (req, res, next) => {
    try {
        let listIds = lodash.get(req, 'body.listIds', [])

        let employeeListeds = await req.app.locals.db.main.EmployeeList.find({
            _id: {
                $in: listIds
            }
        },
            {
                members: true
            }).lean()
        let members = []
        employeeListeds.forEach((o) => {
            o.members.forEach((m) => {
                members.push(m)
            })
        })

        members.sort((a, b) => {
            if (a.lastName < b.lastName) {
                return -1;
            }
            if (a.lastName > b.lastName) {
                return 1;
            }
            return 0;
        })

        let employmentIds = members.map((m) => m.employmentId)

        let r = await req.app.locals.db.main.Employment.updateMany({
            _id: {
                $in: employmentIds
            }
        }, {
            workScheduleId: res.schedule._id
        })
        // return res.send(r) 

        res.schedule.members = members
        await res.schedule.save()

        flash.ok(req, 'schedule', 'Work scheduled applied to ' + members.length + ' employee(s).')
        res.redirect(`/schedule/${res.schedule._id}`)

    } catch (err) {
        next(err);
    }
});
router.get('/schedule/:scheduleId/members/:memberId/delete', middlewares.guardRoute(['delete_schedule']), middlewares.getSchedule, async (req, res, next) => {
    try {
        let memberId = lodash.get(req, 'params.memberId')

        let member = ''
        res.schedule.members = res.schedule.toObject().members.filter((m) => {
            if (m._id.toString() === memberId) {
                member = m.lastName + ', ' + m.firstName
            }
            return m._id.toString() !== memberId
        })

        await res.schedule.save()

        flash.ok(req, 'schedule', `Removed ${member} from list.`)
        res.redirect(`/schedule/${res.schedule._id}`)

    } catch (err) {
        next(err);
    }
});

module.exports = router;