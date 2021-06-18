//// Core modules

//// External modules
const lodash = require('lodash')
const moment = require("moment")
const money = require("money-math")

//// Modules
const db = require('./db');

let gracePeriod = [
    {
        hour: 8, // 8:15 AM
        minute: 15
    },
    {
        hour: 13, // 1:15 PM
        minute: 15
    }
]

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

    if(renderedDays <= 0){
        undertime = true
        underDays =  momentWorkHours.clone().subtract(momentWorkDuration).days()
        underHours =  momentWorkHours.clone().subtract(momentWorkDuration).hours()
        underMinutes = momentWorkHours.clone().subtract(momentWorkDuration).minutes()
    }
   
    return {
        totalMinutes: minutes,
        renderedDays: Math.floor(renderedDays),
        renderedHours: renderedHours,
        renderedMinutes: renderedMinutes,
        underDays: underDays,
        underHours: underHours,
        underMinutes: underMinutes,
        undertime: undertime
    }
}

let calcDailyAttendance = (attendance, hoursPerDay, travelPoints) => {
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

                // Grace period
                if (momentIn.format('A') === 'AM') { // morning
                    // TODO: Null checks
                    let gracePeriodHour = gracePeriod[0].hour
                    let gracePeriodMinute = gracePeriod[0].minute
                    if(momentIn.hours() <= gracePeriodHour && momentIn.minutes() <= gracePeriodMinute) {
                        momentIn = momentIn.hour(gracePeriodHour).minute(0)
                    }
                } else {
                    // TODO: Null checks
                    let gracePeriodHour = gracePeriod[1].hour
                    let gracePeriodMinute = gracePeriod[1].minute
                    if(momentIn.hours() <= gracePeriodHour && momentIn.minutes() <= gracePeriodMinute) {
                        momentIn = momentIn.hour(gracePeriodHour).minute(0)
                    }
                }
            } else if (log.mode === 0) {
                let momentOut = moment(log.dateTime)
                minutes += Math.round(momentOut.diff(momentIn) / 60000)
                console.log(momentIn, momentOut, minutes)
            }
        }
    }

    if(minutes > 60 * hoursPerDay) {
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

let addDtr = (attendances, hoursPerDay, travelPoints) => {
    for (let a = 0; a < attendances.length; a++) {
        let attendance = attendances[a] // daily
        let dtr = calcDailyAttendance(attendance, hoursPerDay, travelPoints)
        attendances[a].dtr = dtr
    }
    return attendances
}

let getCosStaff = async (payroll, workDays = 22, hoursPerDay = 8, travelPoints) => {

    let totalAmountPostIncentives = 0
    let totalAmountPostDeductions = 0
    for (let x = 0; x < payroll.employees.length; x++) {
        let employee = payroll.employees[x]
        let details = await db.main.Employee.findById(employee._id)

        let employment = lodash.get(details, 'employments.0', [])
        employee.position = lodash.get(employment, 'position', '')
        employee.department = lodash.get(employment, 'department', '')
        employee.salary = lodash.toNumber(lodash.get(employment, 'salary', '0'))
        employee.salaryType = lodash.get(employment, 'salaryType', '')

        // Rendered work
        // Payroll period attendance
        let attendances = await db.main.Attendance.find({
            employeeId: employee._id,
            createdAt: {
                $gte: moment(payroll.dateStart).startOf('day').toDate(),
                $lt: moment(payroll.dateEnd).endOf('day').toDate(),
            }
        }).lean()
        // add computed values
        attendances = addDtr(attendances, hoursPerDay, travelPoints)

        let minutes = getTotalAttendanceMinutes(attendances)
        // minutes = 3840
        console.log(minutes)
        employee.attendances = attendances
        employee.timeRecord = calcRenderedTime(minutes, hoursPerDay)


        if (employee.salaryType === 'monthly') {
            let perDay = employee.salary / workDays
            let perHour = perDay / 8
            let perMin = perHour / 60
            employee.amountWorked = (perMin * employee.timeRecord.totalMinutes)
        }
        if (employee.salaryType === 'daily') {
            let perHour = employee.salary / 8
            let perMin = perHour / 60
            employee.amountWorked = (perMin * employee.timeRecord.totalMinutes)
        }
        // 

        employee.incentives = []
        details = details.toObject()
        let totalIncentives = 0
        for (let i = 0; i < payroll.incentives.length; i++) {
            let incentive = lodash.cloneDeep(payroll.incentives[i])
            if (incentive.type === 'normal') {
                incentive.amount = (incentive.initialAmount)

            } else if (incentive.type === 'percentage') {
                incentive.amount = (incentive.percentage / 100 * employee.salary)
            }
            totalIncentives += parseFloat(incentive.amount)
            employee.incentives.push(incentive)

        }
        employee.totalIncentives = totalIncentives
        employee.amountPostIncentives = employee.amountWorked + totalIncentives
        totalAmountPostIncentives += employee.amountPostIncentives
        // 
        employee.deductions = []
        let totalDeductions = 0
        for (let d = 0; d < payroll.deductions.length; d++) {
            let deduction = lodash.cloneDeep(payroll.deductions[d])
            if (deduction.deductionType === 'normal') {
                deduction.amount = (deduction.initialAmount)

            } else if (deduction.deductionType === 'percentage') {
                deduction.amount = (deduction.percentage / 100 * employee.salary)
            }
            // vue
            deduction.vueReadOnly = true
            deduction.vueDisabled = false
            totalDeductions += parseFloat(deduction.amount)
            employee.deductions.push(deduction)

        }
        //

        employee.totalDeductions = totalDeductions
        employee.amountPostDeductions = employee.amountWorked + totalIncentives - totalDeductions
        totalAmountPostDeductions += employee.amountPostDeductions

        payroll.employees[x] = lodash.merge(employee, details)

    }
    payroll.totalAmountPostIncentives = totalAmountPostIncentives
    payroll.totalAmountPostDeductions = totalAmountPostDeductions

    return payroll
}



module.exports = {
    calcDailyAttendance: calcDailyAttendance,
    getCosStaff: getCosStaff,
    getDailyRate: getDailyRate,
    getHourlyRate: getHourlyRate
}