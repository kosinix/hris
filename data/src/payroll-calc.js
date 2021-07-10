//// Core modules

//// External modules
const lodash = require('lodash')
const momentRange = require("moment-range")
const moment = momentRange.extendMoment(require("moment"));

//// Modules
const db = require('./db');

let getDailyRate = (monthlyRate, workDays = 22) => {
    return monthlyRate / workDays
}

let getHourlyRate = (monthlyRate, workDays = 22, hoursPerDay = 8) => {
    return monthlyRate / workDays / hoursPerDay
}

let getPerMinuteRate = (monthlyRate, workDays = 22, hoursPerDay = 8) => {
    return monthlyRate / workDays / hoursPerDay / 60
}

let calcRenderedTime = (minutes, hoursPerDay) => {
    let renderedDays = minutes / 60 / hoursPerDay
    let renderedHours = (renderedDays - Math.floor(renderedDays)) * hoursPerDay
    let renderedMinutes = (renderedHours - Math.floor(renderedHours)) * 60

    let gracePeriodMinutes = 30 // 15 mins AM, 15 mins PM
    let undertime = false
    let underTimeTotalMinutes = hoursPerDay * 60 - gracePeriodMinutes - minutes
    let underDays = 0
    let underHours = 0
    let underMinutes = 0

    if (underTimeTotalMinutes > 0) {
        undertime = true
        underDays = underTimeTotalMinutes / 60 / hoursPerDay
        underHours = (underDays - Math.floor(underDays)) * hoursPerDay
        underMinutes = (underHours - Math.floor(underHours)) * 60
    }

    return {
        totalMinutes: minutes,
        renderedDays: Math.floor(renderedDays),
        renderedHours: Math.floor(renderedHours),
        renderedMinutes: Math.floor(renderedMinutes),
        underTimeTotalMinutes: underTimeTotalMinutes,
        underDays: Math.floor(underDays),
        underHours: Math.floor(underHours),
        underMinutes: Math.floor(underMinutes),
        undertime: undertime
    }
}

let calcDailyAttendance = (attendance, hoursPerDay, travelPoints, gracePeriods) => {

    // let gracePeriods = [
    //     {
    //         mode: 1, // 1 log-in, 0 log-out
    //         start: {
    //             hour: 7,
    //             minute: 0
    //         },
    //         end: {
    //             hour: 7,
    //             minute: 15
    //         }
    //     },
    // ]
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
                console.log(log.mode, momentIn.format('HH:mm A'), momentOut.format('HH:mm A'), momentWorkShift.diff('minutes'), minutes)
            }
        }
    }

    // Upper limit
    if (minutes > 60 * hoursPerDay) {
        minutes = 60 * hoursPerDay
    }
    return calcRenderedTime(minutes, hoursPerDay)
}

let getTotalAttendanceMinutes = (attendances) => {
    let minutes = 0
    for (let a = 0; a < attendances.length; a++) {
        let attendance = attendances[a] // daily

        minutes += attendance.dtr.totalMinutes || 0
    }
    return minutes
}

let addDtr = (attendances, hoursPerDay, travelPoints, gracePeriods) => {
    for (let a = 0; a < attendances.length; a++) {
        let attendance = attendances[a] // daily
        let dtr = calcDailyAttendance(attendance, hoursPerDay, travelPoints, gracePeriods)
        attendances[a].dtr = dtr
    }
    return attendances
}

let getCosStaff = async (payroll, workDays = 22, hoursPerDay = 8, travelPoints) => {

    let totalAmountPostIncentives = 0
    let totalAmountPostDeductions = 0
    for (let x = 0; x < payroll.employments.length; x++) {
        let employment = payroll.employments[x]
        let employee = employment.employee

        // employee.position = lodash.get(employment, 'position', '')
        // employee.department = lodash.get(employment, 'department', '')
        // employee.salary = lodash.toNumber(lodash.get(employment, 'salary', '0'))
        // employee.salaryType = lodash.get(employment, 'salaryType', '')

        // Rendered work
        // Payroll period attendance
        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment(payroll.dateStart).startOf('day').toDate(),
                $lt: moment(payroll.dateEnd).endOf('day').toDate(),
            }
        }).lean()
        // console.log(attendances.length)
        // add computed values
        attendances = addDtr(attendances, hoursPerDay, travelPoints, CONFIG.workTime.gracePeriods)

        let minutes = getTotalAttendanceMinutes(attendances)
        // minutes = 3840
        console.log(employee.lastName, minutes, hoursPerDay)
        employment.attendances = attendances
        employment.timeRecord = calcRenderedTime(minutes, hoursPerDay)


        if (employment.salaryType === 'monthly') {
            let perDay = employment.salary / workDays
            let perHour = perDay / 8
            let perMin = perHour / 60
            employment.amountWorked = (perMin * employment.timeRecord.totalMinutes)
        }
        if (employment.salaryType === 'daily') {
            let perHour = employment.salary / 8
            let perMin = perHour / 60
            employment.amountWorked = (perMin * employment.timeRecord.totalMinutes)
        }
        // 

        employment.incentives = []
        let totalIncentives = 0
        for (let i = 0; i < payroll.incentives.length; i++) {
            let incentive = lodash.cloneDeep(payroll.incentives[i])
            if (incentive.type === 'normal') {
                incentive.amount = (incentive.initialAmount)

            } else if (incentive.type === 'percentage') {
                incentive.amount = (incentive.percentage / 100 * employment.salary)
            }
            totalIncentives += parseFloat(incentive.amount)
            employment.incentives.push(incentive)

        }
        employment.totalIncentives = totalIncentives
        employment.amountPostIncentives = employment.amountWorked + totalIncentives
        totalAmountPostIncentives += employment.amountPostIncentives
        // 
        employment.deductions = []
        let totalDeductions = 0
        for (let d = 0; d < payroll.deductions.length; d++) {
            let deduction = lodash.cloneDeep(payroll.deductions[d])
            if (deduction.deductionType === 'normal') {
                deduction.amount = (deduction.initialAmount)

            } else if (deduction.deductionType === 'percentage') {
                deduction.amount = (deduction.percentage / 100 * employment.salary)
            }
            // vue
            deduction.vueReadOnly = true
            deduction.vueDisabled = false
            totalDeductions += parseFloat(deduction.amount)
            employment.deductions.push(deduction)

        }
        //

        employment.totalDeductions = totalDeductions
        employment.amountPostDeductions = employment.amountWorked + totalIncentives - totalDeductions
        totalAmountPostDeductions += employment.amountPostDeductions

        payroll.employments[x] = employment

    }
    payroll.totalAmountPostIncentives = totalAmountPostIncentives
    payroll.totalAmountPostDeductions = totalAmountPostDeductions

    return payroll
}

let computePayroll = async (payroll, workDays = 22, hoursPerDay = 8, travelPoints) => {

    let totalAmountPostIncentives = 0
    let totalAmountPostDeductions = 0
    for (let x = 0; x < payroll.employments.length; x++) {
        let employment = payroll.employments[x]
        let employee = employment.employee

        // employee.position = lodash.get(employment, 'position', '')
        // employee.department = lodash.get(employment, 'department', '')
        // employee.salary = lodash.toNumber(lodash.get(employment, 'salary', '0'))
        // employee.salaryType = lodash.get(employment, 'salaryType', '')

        // Rendered work
        // Payroll period attendance
        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            employmentId: employment._id,
            createdAt: {
                $gte: moment(payroll.dateStart).startOf('day').toDate(),
                $lt: moment(payroll.dateEnd).endOf('day').toDate(),
            }
        }).lean()
        // add computed values
        attendances = addDtr(attendances, hoursPerDay, travelPoints, CONFIG.workTime.gracePeriods)

        let minutes = getTotalAttendanceMinutes(attendances)
        // minutes = 3840
        console.log(minutes)
        employment.attendances = attendances
        employment.timeRecord = calcRenderedTime(minutes, hoursPerDay)


        if (employment.salaryType === 'monthly') {
            let perDay = employment.salary / workDays
            let perHour = perDay / 8
            let perMin = perHour / 60
            employment.amountWorked = (perMin * employment.timeRecord.totalMinutes)
        }
        if (employment.salaryType === 'daily') {
            let perHour = employment.salary / 8
            let perMin = perHour / 60
            employment.amountWorked = (perMin * employment.timeRecord.totalMinutes)
        }
        // 

        employment.incentives = []
        let totalIncentives = 0
        for (let i = 0; i < payroll.incentives.length; i++) {
            let incentive = lodash.cloneDeep(payroll.incentives[i])
            if (incentive.type === 'normal') {
                incentive.amount = (incentive.initialAmount)

            } else if (incentive.type === 'percentage') {
                incentive.amount = (incentive.percentage / 100 * employment.salary)
            }
            totalIncentives += parseFloat(incentive.amount)
            employment.incentives.push(incentive)

        }
        employment.totalIncentives = totalIncentives
        employment.amountPostIncentives = employment.amountWorked + totalIncentives
        totalAmountPostIncentives += employment.amountPostIncentives
        // 
        employment.deductions = []
        let totalDeductions = 0
        for (let d = 0; d < payroll.deductions.length; d++) {
            let deduction = lodash.cloneDeep(payroll.deductions[d])
            if (deduction.deductionType === 'normal') {
                deduction.amount = (deduction.initialAmount)

            } else if (deduction.deductionType === 'percentage') {
                deduction.amount = (deduction.percentage / 100 * employment.salary)
            }
            // vue
            deduction.vueReadOnly = true
            deduction.vueDisabled = false
            totalDeductions += parseFloat(deduction.amount)
            employment.deductions.push(deduction)

        }
        //

        employment.totalDeductions = totalDeductions
        employment.amountPostDeductions = employment.amountWorked + totalIncentives - totalDeductions
        totalAmountPostDeductions += employment.amountPostDeductions

        payroll.employments[x] = employment

    }
    payroll.totalAmountPostIncentives = totalAmountPostIncentives
    payroll.totalAmountPostDeductions = totalAmountPostDeductions

    return payroll
}

let attachDailyTime = async (attendances) =>{
    return attendances
}



module.exports = {
    calcDailyAttendance: calcDailyAttendance,
    getCosStaff: getCosStaff,
    computePayroll: computePayroll,
    getDailyRate: getDailyRate,
    getHourlyRate: getHourlyRate,
    attachDailyTime: attachDailyTime,
}