//// Core modules

//// External modules
const lodash = require('lodash')
const momentRange = require("moment-range")
const moment = momentRange.extendMoment(require("moment"));

//// Modules


let calcRenderedTime = (minutes, hoursPerDay) => {
    let momentWorkDuration = moment.duration(minutes, 'minutes')
    let momentWorkHours = moment.duration(hoursPerDay, 'hours')
    let renderedHours = momentWorkDuration.hours()
    let renderedMinutes = momentWorkDuration.minutes()

    let renderedDays = Math.floor(renderedHours / hoursPerDay)
    renderedHours = renderedDays >= 1 ? (renderedHours % hoursPerDay) : renderedHours


    let undertime = false
    let underDays = 0
    let underHours = 0
    let underMinutes = 0


    if (renderedDays <= 0) {
        undertime = true
        underDays = momentWorkHours.clone().subtract(momentWorkDuration).days()
        underHours = momentWorkHours.clone().subtract(momentWorkDuration).hours()
        underMinutes = momentWorkHours.clone().subtract(momentWorkDuration).minutes()
    }

    return {
        totalMinutes: minutes,
        renderedDays: Math.floor(renderedDays),
        renderedHours: renderedHours,
        renderedMinutes: renderedMinutes,
        // underDays: underDays,
        // underHours: underHours,
        // underMinutes: underMinutes,
        // undertime: undertime
    }
}

let calcDailyAttendance = (attendance, hoursPerDay, travelPoints, gracePeriods) => {

    // travelPoints 480 minutes = 8 hours 
    if (null === attendance) return null

    // Daily minutes
    let minutes = 0
    if (attendance.onTravel) {
        minutes += travelPoints
    } else {
        // roll logs 
        let momentIn = null
        for (let l = 0; l < attendance.logs.length; l++) {
            let log = attendance.logs[l]
            if (log.mode === 1) {
                momentIn = moment(log.dateTime)

                for (let g = 0; g < gracePeriods.length; g++) {
                    let grace = gracePeriods[g]
                    if (grace.mode === log.mode) {
                        if (momentIn.hours() >= grace.start.hour &&
                            momentIn.hours() <= grace.end.hour &&
                            momentIn.minutes() >= grace.start.minute &&
                            momentIn.minutes() <= grace.end.minute) {
                            momentIn = momentIn.hour(grace.start.hour).minute(grace.start.minute)
                        }
                    }
                }

            } else if (log.mode === 0) {
                let momentOut = moment(log.dateTime)
                
                let momentWorkShift = moment.range(momentIn, momentOut)
                minutes += momentWorkShift.diff('minutes')
                console.log(momentIn.format('MMM DD, HH:mm A'), momentOut.format('HH:mm A'), momentWorkShift.diff('minutes'), 'minutes')
            }
        }
    }

    // Upper limit
    if (minutes > 60 * hoursPerDay) {
        minutes = 60 * hoursPerDay
    }
    return calcRenderedTime(minutes, hoursPerDay)
}

let attachDailyTime = (attendances, hoursPerDay) =>{
    for (let a = 0; a < attendances.length; a++) {
        let attendance = attendances[a] // daily
        let dtr = calcDailyAttendance(attendance, hoursPerDay, travelPoints = 480, gracePeriods = [])
        console.log(dtr)
        attendances[a].dtr = dtr
    }
    return attendances
}
module.exports = {
    attachDailyTime: attachDailyTime,
}