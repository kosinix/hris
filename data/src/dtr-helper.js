//// Core modules

//// External modules
const lodash = require('lodash')
const moment = require('moment')
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
        flexible: settings.hour,
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
    console.log('needle', needle)

    let index = 0
    let distance = null
    shifts.forEach((shift, i) => {
        if (distance === null) {
            distance = Math.abs(shift.start - needle)
            console.log('distance null, set to', distance)
        }
        let newDistance = Math.abs(shift.start - needle)
        if (newDistance < distance) {
            console.log('shift.start < distance', newDistance, distance)
            console.log('index', i)

            distance = newDistance
            index = i

        }
        newDistance = Math.abs(shift.end - needle)
        if (newDistance < distance) {
            console.log('shift.end < distance', newDistance, distance)
            console.log('index', i)
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
const calcTimeRecord = (minutes, totalMinutesUnderTime, hoursPerDay = 8) => {

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


    console.log(renderedDays)
    console.log(renderedHours)
    console.log(renderedMinutes)

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

const calcDailyAttendance = (attendance, hoursPerDay = 8, travelPoints = 480) => {

    // Default govt shift
    let shifts = []
    shifts.push(createShift({ hour: 8, minute: 0 }, { hour: 12, minute: 0 }, { hour: 0, minute: 15 }, { maxHours: 4 }))
    shifts.push(createShift({ hour: 13, minute: 0 }, { hour: 17, minute: 0 }, { hour: 0, minute: 0 }, { maxHours: 4 }))


    // travelPoints 480 minutes = 8 hours 
    if (null === attendance) return null

    // Daily minutes
    let minutes = 0
    let underMinutes = 0
    if (attendance.onTravel) {
        minutes += travelPoints
    } else if (attendance.wfh) {
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
                shiftCurrent = getNextShift(startMinutes, shifts)

                if (shiftCurrent instanceof Error) break

                if (startMinutes <= shiftCurrent.start + shiftCurrent.grace) { // late but graced
                    startMinutes = shiftCurrent.start // set to shift start
                }

            } else if (log.mode === 0) { // out

                if (startMinutes === null) break
                if (shiftCurrent === null) break
                if (shiftCurrent instanceof Error) break

                endMinutes = momentToMinutes(moment(log.dateTime))
                if (endMinutes < shiftCurrent.start) break // Logging out before shift starts!

                if (endMinutes > shiftCurrent.end) {
                    endMinutes = shiftCurrent.end // Not counted outshide shift
                }

                let minutesWorked = endMinutes - startMinutes
                if (minutesWorked > shiftCurrent.maxMinutes) {
                    minutesWorked = shiftCurrent.maxMinutes
                }

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
    return calcTimeRecord(minutes, underMinutes, hoursPerDay)

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
        let weekDay = moment(date).format('ddd')
        let attendance = attendances[date] || null
        let dtr = calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints)

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
module.exports = {
    calcDailyAttendance: calcDailyAttendance,
    calcTimeRecord: calcTimeRecord, //@deprecated. Use getTimeBreakdown
    createShift: createShift,
    getDtrMonthlyView: getDtrMonthlyView,
    getNearestShift: getNearestShift,
    getNextShift: getNextShift,
    getTimeBreakdown: calcTimeRecord,
    momentToMinutes: momentToMinutes
}