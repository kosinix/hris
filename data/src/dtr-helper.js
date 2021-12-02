//// Core modules

//// External modules
const lodash = require('lodash')
const moment = require('moment')
const momentRange = require('moment-range')
const momentExt = momentRange.extendMoment(moment)
const money = require('money-math')

//// Modules

/**
 * Stores working shift data
 * 
 * @param {object} start 
 * @param {number} start.hour  - Number 0 - 23
 * @param {number} start.minute  - Number 0 - 60
 * @param {object} end 
 * @param {number} end.hour  - Number 0 - 23
 * @param {number} end.minute  - Number 0 - 60
 * @param {object} gracePeriod 
 * @param {number} gracePeriod.hour  - Number 0 - 23
 * @param {number} gracePeriod.minute  - Number 0 - 60
 * @param {object} settings 
 * @param {boolean} settings.flexible  - True for flexible time schedule. False otherwise.
 * @param {number} settings.maxHours  - Max counted working hours per shift
 * @returns {object}
 */
const createShift = (start, end, gracePeriod, settings) => {
    start = lodash.merge({ hour: 0, minute: 0 }, start)
    end = lodash.merge({ hour: 0, minute: 0 }, end)
    gracePeriod = lodash.merge({ hour: 0, minute: 0 }, gracePeriod)
    settings = lodash.merge({ flexible: false, maxHours: 4 }, settings)

    return {
        start: start.hour * 60 + start.minute,
        end: end.hour * 60 + end.minute,
        grace: gracePeriod.hour * 60 + gracePeriod.minute,
        flexible: settings.flexible,
        maxHours: settings.maxHours,
        maxMinutes: settings.maxHours * 60, // Derived property. Depends on maxHours
    }
}

/**
 * Find nearest shift to needle. Find nearest shift.start or shift.end to needle.
 * @param {number} needle - Minutes from midnight.
 * @param {array} shifts - Array of shift objects created by createShift. Must be sorted low to high.
 * @returns 
 */
const getNearestShift = (needle, shifts) => {
    // console.log('needle', needle)

    let index = 0
    let distance = null
    shifts.forEach((shift, i) => {
        if (distance === null) {
            distance = Math.abs(shift.start - needle)
            // console.log('distance null, set to', distance)
        }
        let newDistance = Math.abs(shift.start - needle)
        if (newDistance < distance) {
            // console.log('shift.start < distance', newDistance, distance)
            // console.log('index', i)

            distance = newDistance
            index = i

        }
        newDistance = Math.abs(shift.end - needle)
        if (newDistance < distance) {
            // console.log('shift.end < distance', newDistance, distance)
            // console.log('index', i)
            distance = newDistance
            index = i
        }
    })
    // shifts.sort((a, b) => {
    //     return Math.abs(needle - a.start) - Math.abs(needle - b.start);
    // })
    return shifts[index]
}

/**
 * Find next shift from needle
 * @param {number} needle - Minutes from midnight
 * @param {array|null} shifts - Array of shift objects created by createShift. Must be sorted low to high. Null on error.
 */
const getNextShift = (needle, shifts) => {
    let index = null
    for (let i = 0; i < shifts.length; i++) {
        let shift = shifts[i]
        if (needle < shift.end) {
            index = i
            break; // Stop. Dont check other shifts
        }
    }

    if (index === null) {
        return new Error('No more next shifts.')
    }
    return shifts[index]
}

/**
 * 
 * @param {object} momentObject Instance of moment
 * @returns {number} Minutes since midnight of that day
 */
const momentToMinutes = (momentObject) => {
    return momentObject.hour() * 60 + momentObject.minute()
}

/**
 * Breakdown total minutes into: minutes, hours, days
 * @param {number} minutes Total minutes worked
 * @param {number} totalMinutesUnderTime Total undertime in minutes
 * @param {number} hoursPerDay Work hours per day
 * @returns {object} See return
 */
const getTimeBreakdown = (minutes, totalMinutesUnderTime, hoursPerDay = 8) => {

    /* Bare JS  is inaccurate */
    // /*
    let renderedDays = minutes / 60 / hoursPerDay
    let renderedHours = (renderedDays - Math.floor(renderedDays)) * hoursPerDay
    let renderedMinutes = (renderedHours - Math.floor(renderedHours)) * 60
    // */

    /*
    let renderedDays = money.floatToAmount(minutes / 60 / hoursPerDay)
    let renderedHours = money.mul(money.subtract(renderedDays, Math.floor(renderedDays).toFixed(2)), money.floatToAmount(hoursPerDay))
    let renderedMinutes = money.mul(money.subtract(renderedHours, Math.floor(renderedHours).toFixed(2)), "60.00")
    */

    let undertime = false
    let underDays = 0
    let underHours = 0
    let underMinutes = 0

    if (totalMinutesUnderTime > 0) {
        undertime = true
        /*
        underDays = money.floatToAmount(totalMinutesUnderTime / 60 / hoursPerDay)
        underHours = money.mul(money.subtract(underDays, Math.floor(underDays).toFixed(2)), money.floatToAmount(hoursPerDay))
        underMinutes = money.mul(money.subtract(underHours, Math.floor(underHours).toFixed(2)), "60.00")
        */

        underDays = totalMinutesUnderTime / 60 / hoursPerDay
        underHours = (underDays - Math.floor(underDays)) * hoursPerDay
        underMinutes = (underHours - Math.floor(underHours)) * 60

    }

    return {
        totalMinutes: minutes,
        renderedDays: Math.floor(renderedDays),
        renderedHours: Math.floor(renderedHours),
        renderedMinutes: Math.round(renderedMinutes),
        underTimeTotalMinutes: totalMinutesUnderTime,
        underDays: Math.floor(underDays),
        underHours: Math.floor(underHours),
        underMinutes: Math.round(underMinutes),
        undertime: undertime
    }
}

const calcDailyAttendance = (attendance, hoursPerDay = 8, travelPoints = 480, shifts) => {

    // Default govt shift
    if (!shifts) {
        shifts = []
        shifts.push(createShift({ hour: 8, minute: 0 }, { hour: 12, minute: 0 }, { hour: 0, minute: 15 }, { maxHours: 4, flexible: false }))
        shifts.push(createShift({ hour: 13, minute: 0 }, { hour: 17, minute: 0 }, { hour: 0, minute: 15 }, { maxHours: 4, flexible: false }))
    }

    // travelPoints 480 minutes = 8 hours 
    if (null === attendance) return null

    // Daily minutes
    let minutes = 0
    let underMinutes = 0
    if (attendance.type === 'travel') {
        minutes += travelPoints
    } else if (attendance.type === 'wfh') {
        minutes += travelPoints
    } else if (attendance.type === 'leave') {
        minutes += travelPoints
    } else if (attendance.type === 'pass') {
        minutes += travelPoints
    } else {
        // roll logs 
        let momentIn = null
        let startMinutes = null
        let endMinutes = null
        let shiftCurrent = null

        for (let l = 0; l < attendance.logs.length; l++) {
            let log = attendance.logs[l]
            if (log.mode === 1) { // in
                momentIn = moment(log.dateTime)
                startMinutes = momentToMinutes(momentIn)

                if (startMinutes === null) break // Something went wrong

                shiftCurrent = getNextShift(startMinutes, shifts)

                if (shiftCurrent instanceof Error) break // No more next shift
                if (shiftCurrent === null) break // Something went wrong

                if (startMinutes <= shiftCurrent.start + shiftCurrent.grace) { // Late but graced
                    startMinutes = shiftCurrent.start // Set to shift start
                }

                // console.log(`shift ${shiftCurrent.start} to ${shiftCurrent.end} IN  ${startMinutes}`)

            } else if (log.mode === 0) { // out

                if (shiftCurrent instanceof Error) break // No more next shift
                if (shiftCurrent === null) break // Something went wrong

                endMinutes = momentToMinutes(moment(log.dateTime))

                let minutesWorked = 0

                // Different conditions
                if (endMinutes < shiftCurrent.start) { // Invalid. Logged out before current shift starts! 

                    console.log('Logging out before shift starts!')

                } else if (endMinutes >= shiftCurrent.start && endMinutes <= shiftCurrent.end) { // Logged out within current shift

                    minutesWorked = endMinutes - startMinutes

                } else if (endMinutes > shiftCurrent.end) { // Logged out after current shift

                    // Check if logged out on next shift
                    let shiftNext = getNextShift(endMinutes, shifts)

                    if (shiftNext instanceof Error) { // No more next shift

                        minutesWorked = shiftCurrent.end - startMinutes // Remove excess and use shiftCurrent.end

                    } else {

                        if (endMinutes < shiftNext.start) { // Logged out after current and before next shift (eg. logged out on lunch break period)

                            minutesWorked = shiftCurrent.end - startMinutes // Remove excess and use shiftCurrent.end

                        } else if (endMinutes >= shiftNext.start && endMinutes <= shiftNext.end) { // Logged out within NEXT shift (forgot to logout and login)
                            // Get current shift time worked
                            minutesWorked = shiftCurrent.end - startMinutes // Remove excess and use shiftCurrent.end
                            // Add next shift time worked
                            minutesWorked += endMinutes - shiftNext.start
                        } else {
                            // Nothing to compute
                        }

                    }


                }

                // console.log(`shift ${shiftCurrent.start} to ${shiftCurrent.end} OUT ${endMinutes} = ${minutesWorked}`)

                // Attach
                log.minutesWorked = minutesWorked
                log.underMinutes = shiftCurrent.maxMinutes - minutesWorked

                minutes += minutesWorked

            }
        }

    }

    // Upper limit
    if (minutes > 60 * hoursPerDay) {
        minutes = 60 * hoursPerDay
    }
    underMinutes = 60 * hoursPerDay - minutes
    return getTimeBreakdown(minutes, underMinutes, hoursPerDay)

}

const getDtrByDateRange = async (db, employeeId, employmentId, startMoment, endMoment, options) => {

    let defaults = {
        padded: false,
        excludeWeekend: false,
    }

    options = lodash.merge(defaults, options)
    let { showTotalAs, showWeekDays, padded, excludeWeekend } = options;

    if (!showWeekDays) {
        showWeekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    }

    let attendances = await db.main.Attendance.aggregate([
        {
            $match: {
                employeeId: employeeId,
                employmentId: employmentId,
                createdAt: {
                    $gte: startMoment.clone().startOf('day').toDate(),
                    $lte: endMoment.clone().endOf('day').toDate(),
                }
            }
        },
        {
            $lookup: {
                localField: 'workScheduleId',
                foreignField: '_id',
                from: 'workschedules',
                as: 'workSchedules'
            }
        },
        {
            $addFields: {
                "workSchedule": {
                    $arrayElemAt: ["$workSchedules", 0]
                }
            }
        },
        // {
        //     $addFields: {
        //         "shifts": "$workSchedule.timeSegments"
        //     }
        // },
        {
            $project: {
                workSchedules: 0,
            }
        }
    ])

    // Turn array of attendances into an object with date as keys: "2020-12-31"
    attendances = lodash.mapKeys(attendances, (a) => {
        return moment(a.createdAt).format('YYYY-MM-DD')
    })

    if (padded) {
        startMoment.startOf('month')
        endMoment.endOf('month')
    }
    const range1 = momentExt.range(startMoment, endMoment)
    let days = Array.from(range1.by('days'))

    days = days.map((_moment) => {
        let year = _moment.format('YYYY')
        let month = _moment.format('MM')
        let day = _moment.format('DD')
        let date = _moment.format('YYYY-MM-DD')
        let weekDay = _moment.format('ddd')
        let attendance = attendances[date] || null
        let dtr = calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints, lodash.get(attendance, 'workSchedule.timeSegments'))

        let isNow = (date === moment().format('YYYY-MM-DD')) ? true : false
        let isWeekend = ['Sun', 'Sat'].includes(weekDay) ? true : false
        // if (isWeekend && excludeWeekend) {
        //     dtr = null
        //     attendance = null
        // }
        return {
            date: date,
            year: year,
            month: month,
            weekDay: weekDay,
            day: day,
            dtr: dtr,
            isNow: isNow,
            isWeekend: isWeekend,
            attendance: attendance
        }
    })

    days = days.map((day) => {
        if (!showWeekDays.includes(day.weekDay)) {
            day.dtr = null
            day.attendance = null
        }
        return day
    })
    
    let weekdays = days.filter((day) => {
        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(day.weekDay)
    })
    let weekdaysTotalMinutes = weekdays.map(day => lodash.get(day, 'dtr.totalMinutes', 0)).reduce((a, b) => a + b, 0)
    let weekdaysTotalMinutesUnderTime = weekdays.map(day => lodash.get(day, 'dtr.underTimeTotalMinutes', 0)).reduce((a, b) => a + b, 0)

    let weekends = days.filter((day) => {
        return ['Sat', 'Sun'].includes(day.weekDay)
    })
    let weekendsTotalMinutes = weekends.map(day => lodash.get(day, 'dtr.totalMinutes', 0)).reduce((a, b) => a + b, 0)
    let weekendsTotalMinutesUnderTime = weekends.map(day => lodash.get(day, 'dtr.underTimeTotalMinutes', 0)).reduce((a, b) => a + b, 0)


    

    let daysTotalMinutes = days.map(day => lodash.get(day, 'dtr.totalMinutes', 0)).reduce((a, b) => a + b, 0)
    let daysTotalMinutesUnderTime = days.map(day => lodash.get(day, 'dtr.underTimeTotalMinutes', 0)).reduce((a, b) => a + b, 0)

    let hoursPerDay = 8
    let stats = {
        days: getTimeBreakdown(daysTotalMinutes, daysTotalMinutesUnderTime, hoursPerDay),
        weekdays: getTimeBreakdown(weekdaysTotalMinutes, weekdaysTotalMinutesUnderTime, hoursPerDay),
        weekends: getTimeBreakdown(weekendsTotalMinutes, weekendsTotalMinutesUnderTime, hoursPerDay),
    }

    return {
        days: days,
        stats: stats,
    }
}

const getDtrMonthlyView = (month, year, attendances, useDaysInMonth = false) => {

    let momentNow = moment().year(year).month(month)

    // Turn array of attendances into an object with date as keys: "2020-12-31"
    attendances = lodash.mapKeys(attendances, (a) => {
        return moment(a.createdAt).format('YYYY-MM-DD')
    })



    // Array containing 1 - x
    let max = (useDaysInMonth) ? momentNow.daysInMonth() : 31
    let days = new Array(max)
    days = days.fill(1).map((val, index) => val + index)

    days = days.map((index1) => {
        let year = momentNow.format('YYYY')
        let month = momentNow.format('MM')
        let day = String(index1).padStart(2, '0')
        let date = `${year}-${month}-${day}`
        let weekDay = moment(date).isValid() ? moment(date).format('ddd') : ''
        let attendance = attendances[date] || null
        let dtr = calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints, lodash.get(attendance, 'shifts'))

        return {
            date: date,
            year: year,
            month: month,
            weekDay: weekDay,
            day: day,
            dtr: dtr,
            attendance: attendance
        }
    })


    return days
}

const getDtrTable = (startMoment, endMoment, attendances) => {

    return attendances.map((attendance) => {
        let m = moment(attendance.createdAt)
        let date = m.format('YYYY-MM-DD')
        let year = m.format('YYYY')
        let month = m.format('MM')
        let day = m.format('DD')
        let weekDay = m.format('ddd')
        let dtr = calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints, lodash.get(attendance, 'shifts'))

        return {
            date: date,
            year: year,
            month: month,
            weekDay: weekDay,
            day: day,
            dtr: dtr,
            attendance: attendance || null
        }
    })

    // Turn array of attendances into an object with date as keys: "2020-12-31"
    let days = lodash.mapKeys(attendances, (a) => {
        return a.date
    })

    return days
}

let compute = {
    amountWorked: (salary, salaryType, totalMinutes) => {
        if (salaryType === 'monthly') {
            return salary
        } else if (salaryType === 'daily') {
            let perHour = salary / 8
            let perMin = perHour / 60
            return (perMin * totalMinutes)
        }
        throw new Error('Invalid condition.')
    },
    tardiness: (salary, salaryType, workDays, underTimeTotalMinutes) => {
        let tardiness = 0
        if (salaryType === 'monthly') {
            // Undertime
            let perDay = salary / workDays
            let perHour = perDay / 8

            if (underTimeTotalMinutes > 0) {
                /*
                Swap with code below if need more accuracy
                let perMin = perHour / 60
                tardiness = perMin * underTimeTotalMinutes
                */
                // /*
                // Based on HR excel formula
                tardiness = money.mul(money.floatToAmount(perHour), money.floatToAmount(underTimeTotalMinutes / 60))
                tardiness = parseFloat(tardiness)
                // */
            }
        }
        return tardiness
    }
}

const logAttendance = async (db, employee, employment, scannerId, waitTime = 15, extra = {}, logType = 'scanner') => {
    // Today attendance
    let attendance = await db.main.Attendance.findOne({
        employeeId: employee._id,
        employmentId: employment._id,
        createdAt: {
            $gte: moment().startOf('day').toDate(),
            $lt: moment().endOf('day').toDate(),
        }
    }).lean()
    if (!attendance) {
        attendance = await db.main.Attendance.create({
            employeeId: employee._id,
            employmentId: employment._id,
            logs: [
                {
                    scannerId: scannerId,
                    dateTime: moment().toDate(),
                    extra: extra,
                    mode: 1, // in
                    type: logType
                }
            ],
            workScheduleId: employment.workScheduleId,
        })
    } else {
        if (attendance.logs.length >= 4) {
            throw new Error('Max scans already.') // Max 4 log
        }
        if (attendance.logs.length <= 0) {
            throw new Error('Bad attendance data.') // should have at least 1 log
        }
        let lastLog = attendance.logs[attendance.logs.length - 1]

        // Throttle to avoid double scan
        let diff = moment().diff(moment(lastLog.dateTime), 'minutes')
        if (diff < waitTime) {
            throw new Error(`You have already logged. Please wait ${waitTime - diff} minute(s) and try again later.`)
        }

        let mode = lastLog.mode === 1 ? 0 : 1 // Toggle 1 or 0

        attendance.logs.push({
            scannerId: scannerId,
            dateTime: moment().toDate(),
            mode: mode,
            extra: extra,
            type: logType,
        })
    }
    await db.main.Attendance.updateOne({ _id: attendance._id }, attendance)
    return attendance.logs[attendance.logs.length - 1]
}

const editAttendance = async (db, attendanceId, attendancePatch, user) => {

    attendancePatch = lodash.merge({
        type: 'normal',
    }, attendancePatch)

    let attendance = await db.main.Attendance.findById(attendanceId).lean()

    if (!attendance) {
        throw new Error('Attendance not found.')
    }

    let whiteList = CONFIG.attendance.types.map(o => o.value)
    if (!whiteList.includes(attendancePatch.type)) {
        throw new Error(`Invalid attendance type "${attendancePatch.type}".`)
    }

    if (!attendance.changes) {
        attendance.changes = []
    }
    if (!attendance.comments) {
        attendance.comments = []
    }

    let changeLogs = []


    if (lodash.invoke(attendance, 'workScheduleId.toString') !== lodash.invoke(attendancePatch, 'workScheduleId.toString')) {
        let workSchedule1 = await db.main.WorkSchedule.findById(attendance.workScheduleId)
        let workSchedule2 = await db.main.WorkSchedule.findById(attendancePatch.workScheduleId)
        let message = `${user.username} changed work schedule from ${lodash.get(workSchedule1, 'name')} to ${lodash.get(workSchedule2, 'name')}.`
        changeLogs.push(message)
        attendance.workScheduleId = attendancePatch.workScheduleId
        attendance.changes.push({
            summary: message,
            objectId: user._id,
            createdAt: moment().toDate()
        })
    }


    for (x = 0; x < 4; x++) {
        let logPatch = lodash.get(attendancePatch, `log${x}`)
        if (logPatch) {

            let time = logPatch.split(':')
            let hours = parseInt(time[0])
            let minutes = parseInt(time[1])
            let mDate = moment(attendance.createdAt).hour(hours).minute(minutes)

            if (attendance.logs[x]) {
                let oldTime = moment(attendance.logs[x].dateTime).format('hh:mm A')
                let newTime = mDate.format('hh:mm A')
                if (oldTime !== newTime) {
                    let message = `${user.username} changed time log #${x + 1} from ${oldTime} to ${newTime}.`
                    changeLogs.push(message)
                    attendance.changes.push({
                        summary: message,
                        objectId: user._id,
                        createdAt: moment().toDate()
                    })
                    attendance.logs[x].dateTime = mDate.toDate()
                }
            } else {
                let mode = 1 // 1 = "time-in" which is always the first log mode
                let lastLog = attendance.logs[attendance.logs.length - 1]
                if (lastLog) {
                    mode = lastLog.mode === 1 ? 0 : 1 // Flip 1 or 0
                }

                attendance.logs.push({
                    scannerId: null,
                    dateTime: mDate.toDate(),
                    mode: mode
                })

                let newTime = mDate.format('hh:mm A')

                let message = `${user.username} added time log #${x + 1} set to ${newTime}.`
                changeLogs.push(message)
                attendance.changes.push({
                    summary: message,
                    objectId: user._id,
                    createdAt: moment().toDate()
                })

            }
        }
    }

    if (attendance.type !== attendancePatch.type) {
        let message = `${user.username} changed attendance type from ${attendance.type} to ${attendancePatch.type}.`
        changeLogs.push(message)
        attendance.type = attendancePatch.type
        attendance.logs = []
        attendance.changes.push({
            summary: message,
            objectId: user._id,
            createdAt: moment().toDate()
        })
    }

    if (attendancePatch.comment) {
        attendance.comments.push({
            summary: attendancePatch.comment,
            objectId: user._id,
            createdAt: moment().toDate()
        })

        let message = `${user.username} added a new comment.`
        changeLogs.push(message)
        attendance.changes.push({
            summary: message,
            objectId: user._id,
            createdAt: moment().toDate()
        })

    }
    await db.main.Attendance.updateOne({ _id: attendance._id }, attendance)
    return {
        changeLogs: changeLogs,
        attendance: attendance,
    }
}

module.exports = {
    logAttendance: logAttendance,
    editAttendance: editAttendance,
    compute: compute,
    calcDailyAttendance: calcDailyAttendance,
    calcTimeRecord: getTimeBreakdown, //@deprecated. Use getTimeBreakdown
    createShift: createShift,
    getDtrMonthlyView: getDtrMonthlyView,
    getDtrTable: getDtrTable,
    getNearestShift: getNearestShift,
    getNextShift: getNextShift,
    getTimeBreakdown: getTimeBreakdown,
    getDtrByDateRange: getDtrByDateRange,
    momentToMinutes: momentToMinutes
}