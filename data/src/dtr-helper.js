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

const createTimeSegment = (start, end, gracePeriod = 0, settings) => {
    // Note: Be careful with assigning default values to array, lodash.merge will merged it with @param settings. 
    settings = lodash.merge({
        flexible: false,
        max: null,
        breaks: [],
        format: 'h:mmA'
    }, settings)

    let startTime = timeToM(start, settings.format) // string to minutes
    let endTime = timeToM(end, settings.format) // string to minutes

    let max = settings.max
    if (!max) {
        max = endTime - startTime
    }

    return {
        start: startTime,
        end: endTime,
        grace: gracePeriod,
        flexible: settings.flexible,
        breaks: settings.breaks,
        max: max,
    }
}

const createTimeSegmentBreaks = (start, end, settings) => {
    settings = lodash.merge({
        type: 'vacant',
        format: 'h:mmA'
    }, settings)

    let startTime = timeToM(start, settings.format) // string to minutes
    let endTime = timeToM(end, settings.format) // string to minutes

    return {
        start: startTime,
        end: endTime,
        type: settings.type,
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
 * 
 * @param {number} minutes Minutes since midnight of that day
 * @param {object} _moment Instance of moment
 * @returns {object} Instance of moment
 */
const minutesToMoments = (minutes, _moment = null) => {
    if (!_moment) {
        _moment = moment()
    }
    return _moment.startOf('day').minutes(minutes)
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
        totalInHours: minutes / 60,
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
    if (attendance.type === 'wfh') {
        minutes += travelPoints
    } else if (attendance.type === 'leave') {
        minutes += travelPoints
    } else if (attendance.type === 'pass') {
        minutes += travelPoints
    } else if (attendance.type === 'holiday') {
        minutes += travelPoints
    } else { // normal, hybrid
        // roll logs 
        let momentIn = null
        let startMinutes = null
        let endMinutes = null
        let shiftCurrent = null

        if (attendance.type === 'travel') {
            if (attendance.logs.length >= 2) {
                minutes += travelPoints / 2

            } else {
                minutes += travelPoints
                // console.log(minutes)
            }
        }

        for (let l = 0; l < attendance.logs.length; l++) {
            let log = attendance.logs[l]
            if (log.mode === 1) { // in
                momentIn = moment(log.dateTime)
                startMinutes = momentToMinutes(momentIn)

                if (startMinutes === null) break // Something went wrong

                shiftCurrent = getNextShift(startMinutes, shifts)

                if (shiftCurrent instanceof Error) break // No more next shift
                if (shiftCurrent === null) break // Something went wrong

                // If log time is before current shift + grace period, use current shift start
                if (startMinutes <= shiftCurrent.start + shiftCurrent.grace) {
                    startMinutes = shiftCurrent.start // Set to shift start
                } // else use startMinutes as is

                // console.log(`shift ${shiftCurrent.start} to ${shiftCurrent.end} IN  ${startMinutes}`)

            } else if (log.mode === 0) { // out

                if (shiftCurrent instanceof Error) break // No more next shift
                if (shiftCurrent === null) break // Something went wrong

                endMinutes = momentToMinutes(moment(log.dateTime))

                let minutesWorked = 0

                // Different conditions
                if (endMinutes < shiftCurrent.start) { // Invalid. Logged out before current shift starts! 

                    // console.log('Logging out before shift starts!')

                } else if (endMinutes >= shiftCurrent.start && endMinutes <= shiftCurrent.end) { // Logged out within current shift

                    minutesWorked = endMinutes - startMinutes
                    // Breaks here
                    if (shiftCurrent.breaks) {
                        let subTime = 0
                        for (let b = 0; b < shiftCurrent.breaks.length; b++) {
                            let breakTime = shiftCurrent.breaks[b]
                            if (endMinutes >= breakTime.start && endMinutes <= breakTime.end) { // Logged out in a break
                                subTime += endMinutes - breakTime.start
                            } else if (endMinutes > breakTime.end) { // Logged out after break
                                subTime += breakTime.end - breakTime.start
                            }
                        }

                        minutesWorked -= subTime
                    }

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
                            /*
                            // Add next shift time worked
                            minutesWorked += endMinutes - shiftNext.start
                            // Breaks goes here
                            */
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
    let maxMinutes = shifts.map((shift) => {
        return lodash.get(shift, 'maxHours', 0) * 60
    }).reduce((result, maxMinutes) => {
        return result + maxMinutes
    }, 0)

    if (minutes > maxMinutes) {
        minutes = maxMinutes
    }

    // TODO: check under time logic
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
        let weekDayLower = weekDay.toLowerCase()
        let attendance = attendances[date] || null

        // v2 schedule schema with weekday support
        let timeSegments = lodash.get(attendance, `workSchedule.weekDays.${weekDayLower}.timeSegments`)
        if (timeSegments) {
            timeSegments = timeSegments.map((t) => {
                t.maxHours = t.max
                return t
            })
        }
        // original schedule schema
        if (!timeSegments) {
            timeSegments = lodash.get(attendance, 'workSchedule.timeSegments')
        }
        let dtr = calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints, timeSegments)
        let isNow = (date === moment().format('YYYY-MM-DD')) ? true : false
        let isWeekend = ['Sun', 'Sat'].includes(weekDay) ? true : false

        // Push if PM login
        // if (attendance) {
        //     if (attendance.logs[0] && attendance.logs.length <= 2) {
        //         if ('PM' === moment(attendance.logs[0].dateTime).format('A')) {
        //             attendance.logs.unshift(null)
        //             attendance.logs.unshift(null)
        //         }
        //     }
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

const logAttendance = async (db, employee, employment, scannerId, waitTime = 15, extra = {}, logType = 'scanner', source = {}) => {
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
        let log = {
            scannerId: scannerId,
            dateTime: moment().toDate(),
            extra: extra,
            mode: 1, // in
            // type: logType,
        }
        if (source.id && source.type) {
            log.source = source
        }
        attendance = await db.main.Attendance.create({
            employeeId: employee._id,
            employmentId: employment._id,
            logs: [
                log
            ],
            workScheduleId: employment.workScheduleId,
        })
    } else {
        let maxScans = 4
        if (attendance.type === 'travel') {
            maxScans = 3
        }

        if (attendance.logs.length >= maxScans) {
            throw new Error('Max scans already.')
        }

        if (attendance.logs.length <= 0) {
            throw new Error('Bad attendance data.') // should have at least 1 log
        }
        let lastLog = attendance.logs[attendance.logs.length - 1]

        // Throttle to avoid double scan
        if (attendance.type === 'travel' && attendance.logs.length === 1) {
            waitTime = 0
        }
        let diff = moment().diff(moment(lastLog.dateTime), 'minutes')
        if (diff < waitTime) {
            let timeUnit = 'minute'
            if (waitTime - diff > 1) {
                timeUnit = 'minutes'
            }
            throw new Error(`You have just logged. Please wait ${waitTime - diff} ${timeUnit} and try again later.`)
        }

        let mode = lastLog.mode === 1 ? 0 : 1 // Toggle 1 or 0

        let log = {
            scannerId: scannerId,
            dateTime: moment().toDate(),
            mode: mode,
            extra: extra,
            // type: logType,
        }
        if (source.id && source.type) {
            log.source = source
        }
        attendance.logs.push(log)

        let dbOpRes = await db.main.Attendance.collection.updateOne({
            _id: attendance._id
        }, {
            $set: {
                logs: attendance.logs
            }
        })
        if (dbOpRes.modifiedCount <= 0) {
            throw new Error('Failed to save.')
        }
        if (dbOpRes.matchedCount <= 0) {
            throw new Error('Could not find attendance.')
        }
    }



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
        } else {
            if (attendance.logs[x]) {

                let message = `${user.username} removed time log #${x + 1} ${moment(attendance.logs[x].dateTime).format('hh:mm A')}.`
                changeLogs.push(message)
                attendance.changes.push({
                    summary: message,
                    objectId: user._id,
                    createdAt: moment().toDate()
                })

                attendance.logs[x].dateTime = null

            }
        }
    }

    attendance.logs = attendance.logs.filter(o => o.dateTime !== null)

    if (attendance.type !== attendancePatch.type) {
        let message = `${user.username} changed attendance type from ${attendance.type} to ${attendancePatch.type}.`
        changeLogs.push(message)
        attendance.type = attendancePatch.type
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

const editAttendance2 = async (db, attendance, attendancePatch, user) => {
    if (!attendance) {
        throw new Error('Attendance not found.')
    }

    attendancePatch = lodash.merge({
        type: 'normal',
    }, attendancePatch)

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
        } else {
            if (attendance.logs[x]) {

                let message = `${user.username} removed time log #${x + 1} ${moment(attendance.logs[x].dateTime).format('hh:mm A')}.`
                changeLogs.push(message)
                attendance.changes.push({
                    summary: message,
                    objectId: user._id,
                    createdAt: moment().toDate()
                })

                attendance.logs[x].dateTime = null

            }
        }
        // Because we deal with a timesegment:
        let logPatchType = lodash.get(attendancePatch, `log${x}Type`)
        if (logPatchType) {
            let oldType = lodash.get(attendance, `logs[${x}].type`)
            let newType = logPatchType
            if (oldType !== newType && attendance.logs[x]) {
                let message = `${user.username} changed time log #${x + 1} type from ${oldType} to ${newType}.`
                changeLogs.push(message)
                attendance.changes.push({
                    summary: message,
                    objectId: user._id,
                    createdAt: moment().toDate()
                })
                attendance.logs[x].type = newType // start
            }

            let endIndex = x + 1
            oldType = lodash.get(attendance, `logs[${endIndex}].type`)
            if (oldType !== newType && attendance.logs[endIndex]) {
                let message = `${user.username} changed time log #${endIndex + 1} type from ${oldType} to ${newType}.`
                changeLogs.push(message)
                attendance.changes.push({
                    summary: message,
                    objectId: user._id,
                    createdAt: moment().toDate()
                })
                attendance.logs[endIndex].type = newType // end
            }
        }

    }

    attendance.logs = attendance.logs.filter(o => o.dateTime !== null)

    if (lodash.get(attendancePatch, 'log0Type') === 'travel' || lodash.get(attendancePatch, 'log2Type') === 'travel') {
        attendancePatch.type = 'travel'
    }
    if (lodash.get(attendancePatch, 'log0Type') === 'normal' && lodash.get(attendancePatch, 'log2Type') === 'normal') {
        attendancePatch.type = 'normal'
    }
    if (attendance.type !== attendancePatch.type) {
        let message = `${user.username} changed attendance type from ${attendance.type} to ${attendancePatch.type}.`
        changeLogs.push(message)
        attendance.type = attendancePatch.type
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

// Convert from minutes from midnight into HTML time input HH:mm
let mToTime = (minutes, format, date = null) => {
    if (!minutes) return 0
    format = format || 'HH:mm'
    let mDate = {}
    if (date) {
        mDate = moment.utc(date)
    } else {
        mDate = moment().startOf('year')
    }
    return mDate.startOf('day').add(minutes, 'minutes').format(format)
}

// Convert from HTML time input HH:mm into minutes from midnight
let timeToM = (time, format) => {
    format = format || 'HH:mm'
    var momentDayStart = moment().startOf('day')

    var timeParser = moment(time, format)
    var momentTime = momentDayStart.clone().hours(timeParser.hours()).minutes(timeParser.minutes())

    return momentTime.diff(momentDayStart, 'minutes')
}

const createWorkScheduleTemplate = () => {

    let timeSegmentTemplate = {
        start: 0,
        end: 0,
        grace: 0,
        maxHours: 0,
        flexible: false,
        breaks: []
    }
    let timeSegmentsTemplate = [
        timeSegmentTemplate, // morning
        timeSegmentTemplate, // afternoon
        // timeSegmentTemplate, // extended service
    ]
    let workScheduleTemplate = {
        weekDays: {
            mon: {
                id: 'mon',
                name: 'Mon',
                type: 1, // 1 - normal, 2 - rest
                timeSegments: timeSegmentsTemplate,
            },
            tue: {
                id: 'tue',
                name: 'Tue',
                type: 1, // 1 - normal, 2 - rest
                timeSegments: timeSegmentsTemplate,
            },
            wed: {
                id: 'wed',
                name: 'Wed',
                type: 1, // 1 - normal, 2 - rest
                timeSegments: timeSegmentsTemplate,
            },
            thu: {
                id: 'thu',
                name: 'Thu',
                type: 1, // 1 - normal, 2 - rest
                timeSegments: timeSegmentsTemplate,
            },
            fri: {
                id: 'fri',
                name: 'Fri',
                type: 1, // 1 - normal, 2 - rest
                timeSegments: timeSegmentsTemplate,
            },
            sat: {
                id: 'sat',
                name: 'Sat',
                type: 2, // 1 - normal, 2 - rest
                timeSegments: timeSegmentsTemplate,
            },
            sun: {
                id: 'sun',
                name: 'Sun',
                type: 2, // 1 - normal, 2 - rest
                timeSegments: timeSegmentsTemplate,
            },
        }
    };

    workScheduleTemplate.weekDays = lodash.mapValues(workScheduleTemplate.weekDays, (weekDay) => {
        weekDay.timeSegments = lodash.map(weekDay.timeSegments, (timeSegment) => {
            timeSegment.maxHours = timeSegment.end - timeSegment.start
            timeSegment.start = mToTime(timeSegment.start)
            timeSegment.end = mToTime(timeSegment.end)
            timeSegment.breaks = lodash.map(timeSegment.breaks, (br) => {
                br.start = mToTime(br.start)
                br.end = mToTime(br.end)
                return br
            })
            return timeSegment
        })
        return weekDay
    })

    return workScheduleTemplate
}

/**
 * Turn breaks into time segments and merge with original time segment
 * 
 * @param {*} timeSegment 
 * @param {Number} timeSegment.grace - Grace period
 * @param {Boolean} timeSegment.flexible - Flexi or sliding time
 * @param {Number} timeSegment.start - Start minutes from midnight
 * @param {Number} timeSegment.end - End minutes from midnight
 * @param {Number|null|undefined} timeSegment.max - Max minutes. Auto computed if falsy.
 * @param {Array} timeSegment.breaks - Array of breaks
 * @throws {Error} 
 * @returns {Array}
 */
const breakTimeSegments = (timeSegment) => {

    let points = []
    points.push(timeSegment.start)
    lodash.get(timeSegment, 'breaks', []).forEach(br => {
        points.push(br.start)
        points.push(br.end)
    })
    points.push(timeSegment.end)

    let isOdd = points.length % 2 > 0
    if (isOdd) {
        throw new Error('Odd points. Every point should have a partner.')
    }
    let chunks = []
    let chunkSize = 2
    for (let i = 0; i < points.length; i += chunkSize) {
        chunks.push(points.slice(i, i + chunkSize))
    }

    let timeSegments = chunks.map((chunk, i) => {
        let grace = timeSegment.grace
        let max = lodash.get(timeSegment, 'max')
        if (!max) {
            max = chunk[1] - chunk[0]
        }
        // These chunks are breaks, only the first chunk is the original time segment that has grace period
        if (i > 0) {
            grace = 0
        }

        return {
            name: timeSegment.name,
            grace: grace,
            flexible: timeSegment.flexible,
            start: chunk[0],
            end: chunk[1],
            max: max,
        }
    })

    return timeSegments
}

/**
 * Loop on every time segment and extract breaks turning them into time segments too.
 * 
 * @param {Array} timeSegments 
 * @returns {Array} - 1-dimensional array of time segments
 */
const buildTimeSegments = (timeSegments) => {

    let hasFlexi = timeSegments.filter(o => o.flexible)
    // Add OT to computation
    // if (hasFlexi.length <= 0) {
    if (false) {
        // Overtime
        let start = timeSegments[timeSegments.length - 1].end
        // let end = 1439 // 11:59pm
        let end = 1140 // 7pm 
        let max = end - start
        if (max > 0) {
            timeSegments.push({
                name: "OT",
                grace: 0,
                flexible: false,
                start: start,
                end: end,
                max: max,
                breaks: []
            })
        }
    }

    timeSegments = timeSegments.map(timeSegment => {
        return breakTimeSegments(timeSegment)
    })
    let flattened = []
    timeSegments.forEach(timeSegment => {
        flattened.push(...timeSegment)
    })


    return flattened
}

const normalizeTimeSegments = (workScheduleTimeSegments) => {
    if (workScheduleTimeSegments) {
        workScheduleTimeSegments = workScheduleTimeSegments.map((timeSegment) => {
            return Object.fromEntries(Object.entries(timeSegment).filter(([key]) => !['_id'].includes(key))) // remove _id
        })
    }

    workScheduleTimeSegments = workScheduleTimeSegments.map((t) => {
        if (t.maxHours) { // TODO: Check sliding time on database as they use maxHours?
            t.max = t.maxHours * 60 // TODO: Use max only and remove maxHours
            delete t.maxHours
        }
        return t
    })

    return workScheduleTimeSegments
}

/**
 * Extract time segments from a work schedule on a given date
 * 
 * @param {*} workSchedule 
 * @param {*} givenDate 
 * @returns 
 */
const getWorkScheduleTimeSegments = (workSchedule, givenDate) => {
    // Turn into date object
    let customDate = new Date()
    customDate.setTime(Date.parse(givenDate))
    // Get lowercase 3-letter weekday 
    let weekDay = customDate.toLocaleDateString('en-PH', {
        timeZone: 'Asia/Manila',
        weekday: 'short',
    })
    weekDay = weekDay.toLocaleLowerCase()


    // Get if v1 or v2 schedule
    let workScheduleTimeSegments = lodash.get(workSchedule, `weekDays.${weekDay}.timeSegments`) // V2 work schedule schema
    if (!workScheduleTimeSegments) { // V1 work schedule schema
        workScheduleTimeSegments = lodash.get(workSchedule, 'timeSegments', [])
    }

    return normalizeTimeSegments(workScheduleTimeSegments)
}

const buildLogSegments = (logs) => {
    let points = logs.map(log => {
        return timeToM(moment(log.dateTime).format('HH:mm'))
    })

    let isOdd = points.length % 2 > 0
    if (isOdd) {
        // throw new Error('Odd points. Every point should have a partner.')
    }
    let chunks = []
    let chunkSize = 2
    for (let i = 0; i < points.length; i += chunkSize) {
        chunks.push(points.slice(i, i + chunkSize))
    }

    return chunks.map((chunk, i) => {
        let start = chunk[0] === undefined ? 0 : chunk[0]
        let end = chunk[1] === undefined ? 0 : chunk[1]
        let raw = end - start
        raw = raw < 0 ? 0 : raw
        return {
            start: start,
            end: end,
            raw: raw,
            type: logs[i * chunkSize].type
        }
    })
}

const fromPointsToLogSegments = (points) => {
    let isOdd = points.length % 2 > 0
    if (isOdd) {
        throw new Error('Odd points. Every point should have a partner.')
    }
    let chunks = []
    let chunkSize = 2
    for (let i = 0; i < points.length; i += chunkSize) {
        chunks.push(points.slice(i, i + chunkSize))
    }

    return chunks.map((chunk, i) => {
        return {
            start: chunk[0],
            end: chunk[1],
            raw: chunk[1] - chunk[0],
            type: ''
        }
    })
}

/**
 * Compare time segments and log segments to compute time worked.
 * @param {Array} timeSegments 
 * @param {Array} logSegments 
 * @param {Boolean} options.ignoreZero - Ignore zero counted
 * @param {Boolean} options.noSpill - If true, dont count a log segment that starts from another time segment
 * @returns {Array}
 */
let countWork = (timeSegments, logSegments, options) => {
    timeSegments = timeSegments.map(timeSegment => {
        timeSegment.logSegments = [] // add prop
        return timeSegment
    })
    for (let s = 0; s < timeSegments.length; s++) {
        let timeSegment = timeSegments[s]
        let prevTimeSegment = timeSegments[s - 1]

        timeSegments[s].counted = 0
        timeSegments[s].countedUndertime = 0

        for (let l = 0; l < logSegments.length; l++) {
            let logSegment = logSegments[l]
            let log = new Map()
            log.set('start', logSegment.start)
            log.set('end', logSegment.end)
            log.set('raw', logSegment.end - logSegment.start)

            log.set('countedStart', logSegment.start)
            if (logSegment.start <= timeSegment.start + timeSegment.grace) {
                log.set('countedStart', timeSegment.start) // Backward to timeSegment.start if within grace period
            }

            log.set('countedEnd', logSegment.end)
            if (logSegment.end >= timeSegment.end) {
                log.set('countedEnd', timeSegment.end)
            }

            log.set('counted', log.get('countedEnd') - log.get('countedStart'))
            log.set('counted', log.get('counted') < 0 ? 0 : log.get('counted'))
            log.set('counted', log.get('counted') > timeSegment.max ? timeSegment.max : log.get('counted'))

            // For flexible time segments, we count exceeded max as OT
            log.set('countedExcess', log.get('countedEnd') - log.get('countedStart') - timeSegment.max)
            if (log.get('countedExcess') < 0) {
                // log.set('countedExcess', 0)
            }

            log.set('tardiness', logSegment.start - timeSegment.start)
            if (log.get('tardiness') < 0 || log.get('counted') <= 0 || timeSegment.flexible) {
                // log.set('tardiness', 0)
            }

            log.set('undertime', timeSegment.end - logSegment.end)
            if (log.get('undertime') < 0 || log.get('counted') <= 0 || timeSegment.flexible) {
                // log.set('undertime', 0)
            }

            if (options.noSpill && prevTimeSegment && logSegment.start <= prevTimeSegment.end) {
                log.set('counted', 0)
            }

            timeSegments[s].counted += log.get('counted')
            timeSegments[s].countedUndertime = timeSegment.max - timeSegments[s].counted

            if (options && options.ignoreZero) {
                if (log.get('counted') > 0) {
                    timeSegments[s].logSegments.push(Object.fromEntries(log))
                }
            } else {
                timeSegments[s].logSegments.push(Object.fromEntries(log))
            }
        }
    }


    return timeSegments
}

let normalizeAttendance = (attendance, employee, workScheduleTimeSegments) => {
    let defaults = {
        _id: null,
        employeeId: '',
        employmentId: '',
        type: 'normal',
        workScheduleId: '',
        logs: [],
        changes: [],
        comments: [],
        createdAt: '',
    }
    attendance = lodash.merge(defaults, attendance)

    let logs = lodash.get(attendance, 'logs', [])

    let timeZone = -480 // ph -8 hrs
    if (attendance.type == 'holiday') {
        let start = 450 // 7:30
        let currentShift = getNextShift(start, workScheduleTimeSegments)
        let mToTime = (minutes, format, date = null) => {
            format = format || 'HH:mm'
            let mDate = {}
            if (date) {
                mDate = moment.utc(date)
            } else {
                mDate = moment().startOf('year')
            }
            return mDate.startOf('day').add(minutes, 'minutes').format(format)
        }
        attendance.logs = [
            {
                dateTime: mToTime(currentShift.start + timeZone, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]', attendance.createdAt),
                type: 'holiday',
                source: {
                    id: employee.userId,
                    type: 'userAccount'
                }
            },
            {
                dateTime: mToTime(1020 + timeZone, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]', attendance.createdAt),
                type: 'holiday',
                source: {
                    id: employee.userId,
                    type: 'userAccount'
                }
            }
        ]
    } else if (attendance.type == 'travel') {
        if (logs.length <= 1) { // all day travel

            let start = 450 // 7:30
            let currentShift = getNextShift(start, workScheduleTimeSegments)
            let mToTime = (minutes, format, date = null) => {
                format = format || 'HH:mm'
                let mDate = {}
                if (date) {
                    mDate = moment.utc(date)
                } else {
                    mDate = moment().startOf('year')
                }
                return mDate.startOf('day').add(minutes, 'minutes').format(format)
            }
            attendance.logs = [
                {
                    dateTime: mToTime(currentShift.start + timeZone, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]', attendance.createdAt),
                    type: 'travel',
                    source: {
                        id: employee.userId,
                        type: 'userAccount'
                    }
                },
                {
                    dateTime: mToTime(1020 + timeZone, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]', attendance.createdAt),
                    type: 'travel',
                    source: {
                        id: employee.userId,
                        type: 'userAccount'
                    }
                }
            ]
        } else if (logs.length === 3) { // half day travel
            // travel, !travel, !travel
            if (logs[0].type === 'travel' && logs[1].type !== 'travel' && logs[2].type !== 'travel') { // Travel must have start and end logs to conform to our API
                let start = timeToM(moment(logs[0].dateTime).format('HH:mm'))
                let currentShift = getNextShift(start, workScheduleTimeSegments)

                let adjustedLogs = [
                    {
                        dateTime: moment(mToTime(currentShift.start + timeZone, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]', attendance.createdAt)).toDate(), // Begin on start of shift
                        type: 'travel',
                        source: {
                            id: employee.userId,
                            type: 'userAccount'
                        }
                    },
                    // Inserted log
                    {
                        dateTime: logs[1].dateTime,
                        type: 'travel',
                        source: {
                            id: employee.userId,
                            type: 'userAccount'
                        }
                    },
                    logs[1], // As is
                    logs[2], // As is
                ]
                attendance.logs = adjustedLogs

                // !travel, !travel, travel
            } else if (logs[0].type !== 'travel' && logs[1].type !== 'travel' && logs[2].type === 'travel') { //
                let start = timeToM(moment(logs[2].dateTime).format('HH:mm'))
                let nextShift = getNextShift(start, workScheduleTimeSegments)

                let adjustedLogs = [
                    logs[0], // As is
                    logs[1], // As is
                    {
                        dateTime: moment(mToTime(nextShift.start + timeZone, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]', attendance.createdAt)).toDate(), // Begin on start of shift
                        type: 'travel',
                        source: {
                            id: employee.userId,
                            type: 'userAccount'
                        }
                    },
                    // Inserted log
                    {
                        dateTime: moment(mToTime(nextShift.end + timeZone, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]', attendance.createdAt)).toDate(),
                        type: 'travel',
                        source: {
                            id: employee.userId,
                            type: 'userAccount'
                        }
                    },
                ]
                attendance.logs = adjustedLogs
            }
        }

    }

    attendance.logs = attendance.logs.map(log => {
        let newLog = {
            // scannerId: null,
            dateTime: log.dateTime,
            mode: log.mode,
            type: log.type,
            source: {
                id: null,
                type: '',
            }
        }
        if (log.scannerId) {
            // newLog.scannerId = log.scannerId
            newLog.type = 'normal'
            newLog.source.id = log.scannerId
            newLog.source.type = 'scanner'
        } else {
            newLog.type = 'normal'
        }
        if ('online' === log.type) {
            newLog.type = 'normal'
            newLog.source.type = 'userAccount'
        }
        if ('scanner' === log.type) {
            newLog.type = 'normal'
            newLog.source.type = 'scanner'
        }
        if ('travel' === log.type) {
            newLog.type = 'travel'
            newLog.source.id = employee.userId
            newLog.source.type = 'userAccount'
        }
        if (lodash.has(log, 'extra.id')) {
            newLog.source.id = log.extra.id
        }
        if (lodash.has(log, 'extra.type')) {
            newLog.source.type = log.extra.type
        }
        if (lodash.has(log, 'extra.lat')) {
            newLog.source.lat = log.extra.lat
        }
        if (lodash.has(log, 'extra.lon')) {
            newLog.source.lon = log.extra.lon
        }
        if (lodash.has(log, 'extra.photo')) {
            newLog.source.photo = log.extra.photo
        }
        if (lodash.has(log, 'source.id')) {
            newLog.source.id = log.source.id
        }
        if (lodash.has(log, 'source.type')) {
            newLog.source.type = log.source.type
        }

        return newLog
    })


    return attendance
}

/**
* Format for DTR display
*/
let logSegmentsDtrFormat = (logSegments) => {
    let entries = {
        am: {
            start: '',
            end: '',
            type: '',
        },
        pm: {
            start: '',
            end: '',
            type: '',
        },
        ext: {
            start: '',
            end: '',
            type: '',
        }
    }
    logSegments.forEach((o, i) => {
        if (i == 0) {
            entries.am.start = mToTime(o.start)
            entries.am.end = mToTime(o.end)
            entries.am.type = o.type
        } else if (i == 1) {
            entries.pm.start = mToTime(o.start)
            entries.pm.end = mToTime(o.end)
            entries.pm.type = o.type
        } else if (i == 2) {
            entries.ext.start = mToTime(o.start)
            entries.ext.end = mToTime(o.end)
            entries.ext.type = o.type
        }
    })
    return entries
}

const getDtrByDateRange2 = async (db, employeeId, employmentId, startMoment, endMoment, options) => {

    let defaults = {
        padded: false,
        excludeWeekend: false,
    }

    options = lodash.merge(defaults, options)
    let { showTotalAs, showWeekDays, padded, excludeWeekend } = options;

    if (!showWeekDays) {
        showWeekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    }

    let employment = await db.main.Employment.findOne(employmentId);
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
    let days = Array.from(range1.by('days')) // Generate array of days

    // Get all holidays for this date range
    let holidays = await db.main.Holiday.find({
        date: {
            $gte: startMoment.clone().startOf('day').toDate(),
            $lte: endMoment.clone().endOf('day').toDate(),
        }
    }).lean()
    // Turn array of holidays into an object with date as keys: "2020-12-31"
    holidays = lodash.mapKeys(holidays, (h) => {
        return moment(h.date).format('YYYY-MM-DD')
    })

    let defaultWorkSched = await db.main.WorkSchedule.findById(employment.workScheduleId).lean()

    days = days.map((_moment) => {
        let year = _moment.format('YYYY')
        let month = _moment.format('MM')
        let day = _moment.format('DD')
        let date = _moment.format('YYYY-MM-DD')
        let weekDay = _moment.format('ddd')
        let weekDayLower = weekDay.toLowerCase()
        let attendance = attendances[date] || null
        let holiday = holidays[date] || null
        let workSchedule = lodash.get(attendance, 'workSchedule', defaultWorkSched)
        let dtr = {
            totalMinutes: 0,
            totalInHours: 0,
            renderedDays: 0,
            renderedHours: 0,
            renderedMinutes: 0,
            excessMinutes: 0,
            underTimeTotalMinutes: 0,
            underDays: 0,
            underHours: 0,
            underMinutes: 0,
            undertime: false,
        }

        //////////
        // console.dir(date, { depth: null })
        // console.dir(attendance, { depth: null })
        if ((holiday && employment.employmentType === 'permanent') || lodash.get(attendance, 'type') === 'wfh') {
            dtr.totalMinutes = 480
        } else if (attendance) {
            let workScheduleTimeSegments = getWorkScheduleTimeSegments(workSchedule, attendance.createdAt)

            // Normalize schema
            attendance = normalizeAttendance(attendance, { userId: employeeId }, workScheduleTimeSegments)

            // Schedule segments
            let timeSegments = buildTimeSegments(workScheduleTimeSegments)

            // console.log(date, attendance)
            let logSegments = []
            try {
                logSegments = buildLogSegments(attendance.logs)
            } catch (errr) {
                console.log(errr)
            }
            // console.dir(timeSegments, { depth: null })
            // console.dir(logSegments, { depth: null })

            let options = {
                ignoreZero: true,
                noSpill: true
            }
            if (employment.employmentType === 'part-time' || attendance.type !== 'normal') {
                options.noSpill = false
            }
            let timeWorked = countWork(timeSegments, logSegments, options)
            attendance.timeWorked = timeWorked

            // console.dir(timeWorked, { depth: null })

            timeWorked.forEach(ts => {
                if (ts.name != 'OT') { // Exclude OT
                    ts.logSegments.forEach(ls => {
                        dtr.excessMinutes += ls.countedExcess
                    })
                    dtr.totalMinutes += ts.counted
                    dtr.underTimeTotalMinutes += ts.countedUndertime
                }
            })

        }

        let hoursPerDay = 8

        dtr.totalInHours = dtr.totalMinutes / 60
        dtr.renderedDays = dtr.totalMinutes / 60 / hoursPerDay
        dtr.renderedHours = (dtr.renderedDays - Math.floor(dtr.renderedDays)) * hoursPerDay
        dtr.renderedMinutes = (dtr.renderedHours - Math.floor(dtr.renderedHours)) * 60


        dtr.underDays = dtr.underTimeTotalMinutes / 60 / hoursPerDay
        dtr.underHours = (dtr.underDays - Math.floor(dtr.underDays)) * hoursPerDay
        dtr.underMinutes = (dtr.underHours - Math.floor(dtr.underHours)) * 60
        dtr.undertime = dtr.underTimeTotalMinutes > 0 ? true : false

        dtr.totalInHours = dtr.totalMinutes / 60
        dtr.renderedDays = Math.floor(dtr.renderedDays)
        dtr.renderedHours = Math.floor(dtr.renderedHours)
        dtr.renderedMinutes = Math.round(dtr.renderedMinutes)

        dtr.underDays = Math.floor(dtr.underDays)
        dtr.underHours = Math.floor(dtr.underHours)
        dtr.underMinutes = Math.round(dtr.underMinutes)

        if (null === attendance) dtr = null
        ////////
        //let dtr = calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints, timeSegments, holiday)

        let isNow = (date === moment().format('YYYY-MM-DD')) ? true : false
        let isWeekend = ['Sun', 'Sat'].includes(weekDay) ? true : false

        // Push if PM login
        // if (attendance) {
        //     if (attendance.logs[0] && attendance.logs.length <= 2) {
        //         if ('PM' === moment(attendance.logs[0].dateTime).format('A')) {
        //             attendance.logs.unshift(null)
        //             attendance.logs.unshift(null)
        //         }
        //     }
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
            holiday: holiday,
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

module.exports = {
    logAttendance: logAttendance,
    editAttendance: editAttendance,
    compute: compute,
    calcDailyAttendance: calcDailyAttendance,
    calcTimeRecord: getTimeBreakdown, //@deprecated. Use getTimeBreakdown
    createWorkScheduleTemplate: createWorkScheduleTemplate,
    createShift: createShift,
    createTimeSegment: createTimeSegment,
    createTimeSegmentBreaks: createTimeSegmentBreaks,
    getDtrMonthlyView: getDtrMonthlyView,
    getDtrTable: getDtrTable,
    getNearestShift: getNearestShift,
    getNextShift: getNextShift,
    getTimeBreakdown: getTimeBreakdown,
    getDtrByDateRange: getDtrByDateRange,
    momentToMinutes: momentToMinutes,
    minutesToMoments: minutesToMoments,
    mToTime: mToTime,
    timeToM: timeToM,
    // 
    breakTimeSegments: breakTimeSegments,
    buildTimeSegments: buildTimeSegments,
    normalizeTimeSegments: normalizeTimeSegments,
    getWorkScheduleTimeSegments: getWorkScheduleTimeSegments,
    countWork: countWork,
    buildLogSegments: buildLogSegments,
    fromPointsToLogSegments: fromPointsToLogSegments,
    normalizeAttendance: normalizeAttendance,
    logSegmentsDtrFormat: logSegmentsDtrFormat,
    getDtrByDateRange2: getDtrByDateRange2,
    editAttendance2: editAttendance2,
}

