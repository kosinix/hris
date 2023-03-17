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
        let name = (new String(req.query.name ?? '')).trim()
        let showAttendance = req.query.showAttendance ?? false
        let search = {}
        if (name) {
            search = {
                name: {
                    $regex: new RegExp(name, "i")
                }
            }
        }
        let aggr = []

        aggr.push({
            $lookup:
            {
                localField: "_id",
                foreignField: "workScheduleId",
                from: "employments",
                as: "employments"
            }
        })

        aggr.push({
            $project:
            {
                name: 1,
                timeSegments: 1,
                members: 1,
                createdAt: 1,
                updatedAt: 1,
                visibility: 1,
                locked: 1,
                weekDays: 1,
                employments: {
                    active: 1,
                    employeeId: 1,
                },
                attendances: {
                    employeeId: 1,
                    employmentId: 1,
                }
            }
        })

        let schedules = await req.app.locals.db.main.WorkSchedule.aggregate(aggr)

        schedules = schedules.map((o) => {
            o.timeSegments = o.timeSegments.map((t) => {
                t.start = moment().startOf('day').minutes(t.start).format('hh:mm A')
                t.end = moment().startOf('day').minutes(t.end).format('hh:mm A')
                return t
            })
            o.readable = dtrHelper.workScheduleDisplay(o, [
                'mon',
                'tue',
                'wed',
                'thu',
                'fri',
                'sat',
                'sun',
            ]).replace('Mon,Tue,Wed,Thu,Fri,Sat,Sun: ', '')
            return o
        })

        let attendancesCount = schedules.map((o) => {
            if (showAttendance) {
                return req.app.locals.db.main.Attendance.countDocuments({
                    workScheduleId: o._id
                })
            } else {
                return 0
            }
        })
        attendancesCount = await Promise.allSettled(attendancesCount)
        attendancesCount = attendancesCount.map(o => o.value ?? 0)
        res.render('schedule/all.html', {
            flash: flash.get(req, 'schedule'),
            schedules: schedules,
            attendancesCount: attendancesCount,
            name: name,
            showAttendance: showAttendance,
        });
    } catch (err) {
        next(err);
    }
});
router.get('/schedule/create', middlewares.guardRoute(['create_schedule']), async (req, res, next) => {
    try {

        let employeeLists = await req.app.locals.db.main.EmployeeList.find({}, { _id: 1, name: 1 })

        let hourList = []
        Array.from(Array(24).keys()).map((e, i) => i).forEach(e => {
            hourList.push(e)
        })

        //let workSchedule = await req.app.locals.db.main.WorkSchedule.findById('62cce9df59764931cc1dbdea').lean()

        let defaultBreak = {
            type: 'vacant', // vacant, personal
            start: 0,
            end: 0
        }
        let defaultTimeSegment = {
            start: 0,
            end: 0,
            grace: 0,
            max: null, // Absent or if present, limit max minutes per time segment to this
            flexible: false,
            breaks: []
        }
        let defaultWeekDay = new Map()
        defaultWeekDay.set('type', 1) // or 2 for weekends
        defaultWeekDay.set('timeSegments', [])

        let defaultWorkSchedule = {
            name: '',
            weekDays: {},
            visibility: '',
            members: []
            // timeSegments: [],
        }


        let weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        weekDays.forEach(w => {
            defaultWeekDay.set('type', (w === 'sat' || w === 'sun') ? 2 : 1)
            lodash.set(defaultWorkSchedule, 'weekDays.' + w, Object.fromEntries(defaultWeekDay))
        })

        // return res.send(defaultWorkSchedule)
        res.render('schedule/create.html', {
            flash: flash.get(req, 'schedule'),
            hourList: hourList,
            employeeLists: employeeLists,
            scheduleId: '',
            workSchedule: defaultWorkSchedule,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/schedule/create', middlewares.guardRoute(['create_schedule']), async (req, res, next) => {
    try {

        let body = lodash.get(req, 'body')

        let workSchedule = JSON.parse(lodash.get(body, 'workSchedule'))
        // let name = lodash.get(workSchedule, 'name')
        // let visibility = lodash.get(workSchedule, 'visibility', '')
        // let memberIds = lodash.get(body, 'memberIds')
        // return res.send(memberIds)

        let errors = []
        if (!workSchedule.name) {
            let err = new Error('Name required.')
            err.type = 'flash'
            throw err
        }
        if (workSchedule.visibility === 'members' && workSchedule.members.length <= 0) {
            let err = new Error('No members found.')
            err.type = 'flash'
            throw err
        }

        let overlapped = (start1, end1, start2, end2) => {
            return (((start1 >= start2 && start1 <= end2) || (end1 >= start2 && end1 <= end2))
                || ((start2 >= start1 && start2 <= end1) || (end2 >= start1 && end2 <= end1)))
        }
        let spilled = (start1, end1, start2, end2) => {
            return (start1 < start2 || end1 > end2)
        }

        let timeSegmentCount = 0
        lodash.each(workSchedule.weekDays, (weekDay, weekName) => {
            weekDay.timeSegments.forEach((timeSegment, index) => {
                timeSegmentCount++
                let { start, end, max } = timeSegment
                if (!Number.isInteger(start)) {
                    errors.push('Start Time is invalid.')
                }
                if (!Number.isInteger(end)) {
                    errors.push('End Time is invalid.')
                }
                if (max <= 0) {
                    timeSegment.max = null
                }

                // segment here contains time in HH:mm format from HTML input
                if (start % 15 > 0) {
                    errors.push('Start Time must be in 15-minute increments.')
                }
                if (end % 15 > 0) {
                    errors.push('End Time must be in 15-minute increments.')
                }

                if (end <= start) {
                    errors.push('End Time must be more than Start Time.')
                }
            })
        })
        if (timeSegmentCount <= 0) {
            errors.push('Invalid schedule. No time segment found.')
        }

        if (errors.length > 0) {
            let err = new Error(`${errors.join(' ')}`)
            err.type = 'flash'
            throw err
        }

        lodash.each(workSchedule.weekDays, (weekDay, weekName) => {
            workSchedule.weekDays[weekName].timeSegments = weekDay.timeSegments.map(t => {
                t.start = parseInt(t.start)
                t.end = parseInt(t.end)
                t.grace = parseInt(t.grace)
                return t
            })
        })
        // return res.send(workSchedule)

        // let members = []
        // if (visibility === 'members') {
        //     if (!memberIds) {
        //         let err = new Error('No members selected.')
        //         err.type = 'flash'
        //         throw err
        //     } else {
        //         memberIds = memberIds.split(',').map(id => new req.app.locals.db.mongoose.Types.ObjectId(id))
        //         for (let x = 0; x < memberIds.length; x++) {
        //             let memberId = memberIds[x]
        //             let objectId = null
        //             let name = ''
        //             let type = ''

        //             let employment = await req.app.locals.db.main.Employment.findById(memberId)
        //             if (employment) {
        //                 objectId = employment._id
        //                 type = 'employment'
        //                 let employee = await req.app.locals.db.main.Employee.findById(employment.employeeId)
        //                 if (employee) {
        //                     name = `${employee.firstName} ${employee.lastName} - ${employment.position}`
        //                 }
        //             } else {
        //                 let employeeList = await req.app.locals.db.main.EmployeeList.findById(memberId)
        //                 if (employeeList) {
        //                     objectId = employeeList._id
        //                     name = `${employeeList.name} - ${employeeList.tags.join(',')}`
        //                     type = 'list'
        //                 }
        //             }
        //             if (objectId && name && type) {
        //                 members.push({
        //                     objectId: objectId,
        //                     name: name,
        //                     type: type,
        //                 })
        //             }

        //         }
        //     }
        // }

        // workSchedule.members = members
        // return res.send(workSchedule)
        await req.app.locals.db.main.WorkSchedule.create(workSchedule)
        flash.ok(req, 'schedule', `Work schedule created.`)
        return res.redirect('/schedule/all')
    } catch (err) {
        // if (err.type === 'flash') {
        //     flash.error(req, 'schedule', `Error: ${err.message}`)
        //     return res.redirect('/schedule/create')
        // }
        next(err);
    }
});

router.get('/schedule/:scheduleId', middlewares.guardRoute(['update_schedule']), middlewares.getSchedule, async (req, res, next) => {
    try {
        let workSchedule = res.schedule.toObject()

        let employeeLists = await req.app.locals.db.main.EmployeeList.find({}, { _id: 1, name: 1 })

        let hourList = []
        Array.from(Array(24).keys()).map((e, i) => i).forEach(e => {
            hourList.push(e)
        })

        let defaultBreak = {
            type: 'vacant', // vacant, personal
            start: 0,
            end: 0
        }
        let defaultTimeSegment = {
            start: 0,
            end: 0,
            grace: 0,
            max: null, // Absent or if present, limit max minutes per time segment to this
            flexible: false,
            breaks: []
        }
        let defaultWeekDay = new Map()
        defaultWeekDay.set('type', 1) // or 2 for weekends
        defaultWeekDay.set('timeSegments', [])

        let defaultWorkSchedule = {
            name: '',
            weekDays: {},
            visibility: '',
            members: []
            // timeSegments: [],
        }

        let weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

        // V1 doesnt have "weekDays" prop
        if (!lodash.has(workSchedule, 'weekDays')) {
            // Add weekDays with defaults
            weekDays.forEach(w => {
                defaultWeekDay.set('type', (w === 'sat' || w === 'sun') ? 2 : 1)
                defaultWeekDay.set('timeSegments', dtrHelper.normalizeTimeSegments(lodash.get(workSchedule, 'timeSegments', []))) // Populate from root "timeSegments" prop
                lodash.set(workSchedule, 'weekDays.' + w, Object.fromEntries(defaultWeekDay))
            })
        } else {
            // Merge each weekDay timeSegments with root timeSegments
            lodash.each(workSchedule.weekDays, (weekDay, weekName) => {
                let timeSegments = lodash.merge(workSchedule.weekDays[weekName].timeSegments, lodash.get(workSchedule, 'timeSegments', []))
                workSchedule.weekDays[weekName].timeSegments = dtrHelper.normalizeTimeSegments(timeSegments)
            })
        }

        //workSchedule = lodash.merge(defaultWorkSchedule, workSchedule)
        let workScheduleWeek = dtrHelper.workScheduleDisplay(workSchedule, [
            'mon',
            'tue',
            'wed',
            'thu',
            'fri',
            'sat',
            'sun',
        ])

        // regular and faculty sched
        if (!res.user.roles.includes('admin') && workSchedule.locked) {
            return res.render('schedule/read.html', {
                flash: flash.get(req, 'schedule'),
                hourList: hourList,
                employeeLists: employeeLists,
                workSchedule: workSchedule,
                workScheduleWeek: workScheduleWeek,
                scheduleId: workSchedule._id,
            });
        }
        // return res.send(workSchedule)
        res.render('schedule/create.html', {
            flash: flash.get(req, 'schedule'),
            hourList: hourList,
            employeeLists: employeeLists,
            workSchedule: workSchedule,
            workScheduleWeek: workScheduleWeek,
            scheduleId: workSchedule._id,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/schedule/:scheduleId', middlewares.guardRoute(['update_schedule']), middlewares.getSchedule, async (req, res, next) => {
    try {
        let schedule = res.schedule

        let body = lodash.get(req, 'body')
        let workSchedule = JSON.parse(lodash.get(body, 'workSchedule'))

        if ((schedule.locked ?? false) && !res.user.roles.includes('admin')) {
            throw new Error('Cannot edit locked schedule.')
        }

        let errors = []
        if (!workSchedule.name) {
            let err = new Error('Name required.')
            err.type = 'flash'
            throw err
        }
        if (workSchedule.visibility === 'members' && workSchedule.members.length <= 0) {
            let err = new Error('No members found.')
            err.type = 'flash'
            throw err
        }

        let timeSegmentCount = 0
        lodash.each(workSchedule.weekDays, (weekDay, weekName) => {
            weekDay.timeSegments.forEach((timeSegment, index) => {
                timeSegmentCount++
                let { start, end, max } = timeSegment
                if (!Number.isInteger(start)) {
                    errors.push('Start Time is invalid.')
                }
                if (!Number.isInteger(end)) {
                    errors.push('End Time is invalid.')
                }
                if (max <= 0) {
                    timeSegment.max = null
                }

                // segment here contains time in HH:mm format from HTML input
                if (start % 15 > 0) {
                    errors.push('Start Time must be in 15-minute increments.')
                }
                if (end % 15 > 0) {
                    errors.push('End Time must be in 15-minute increments.')
                }

                if (end <= start) {
                    errors.push('End Time must be more than Start Time.')
                }
            })
        })
        if (timeSegmentCount <= 0) {
            errors.push('Invalid schedule. No time segment found.')
        }

        if (errors.length > 0) {
            let err = new Error(`${errors.join(' ')}`)
            err.type = 'flash'
            throw err
        }

        lodash.each(workSchedule.weekDays, (weekDay, weekName) => {
            workSchedule.weekDays[weekName].timeSegments = weekDay.timeSegments.map(t => {
                t.start = parseInt(t.start)
                t.end = parseInt(t.end)
                t.grace = parseInt(t.grace)
                return t
            })
        })

        // return res.send(workSchedule)
        await req.app.locals.db.main.WorkSchedule.updateOne({
            _id: res.schedule._id,
        }, workSchedule)
        flash.ok(req, 'schedule', `Work schedule updated.`)
        return res.redirect('/schedule/all')
    } catch (err) {
        // if (err.type === 'flash') {
        //     flash.error(req, 'schedule', `Error: ${err.message}`)
        //     return res.redirect('/schedule/create')
        // }
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


router.get('/schedule/:scheduleId/employments', middlewares.guardRoute(['read_all_schedule', 'read_schedule']), middlewares.getSchedule, async (req, res, next) => {
    try {
        let schedule = res.schedule


        let aggr = []

        aggr.push({
            $match: {
                workScheduleId: schedule._id
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
                employee: {
                    personal: 0,
                    employments: 0,
                    addresses: 0,
                }

            }
        })


        let employments = await req.app.locals.db.main.Employment.aggregate(aggr)

        res.render('schedule/employments.html', {
            flash: flash.get(req, 'schedule'),
            schedule: schedule,
            employments: employments,
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;