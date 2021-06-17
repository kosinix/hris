//// Core modules

//// External modules
const lodash = require('lodash')
const moment = require("moment")
const money = require("money-math")

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

let getTotalAttendanceMinutes = (attendances, gracePeriod) => {
    
    gracePeriod = [
        {
            hour: 8, // 8:15 AM
            minute: 15
        },
        {
            hour: 13, // 1:15 PM
            minute: 15
        }
    ]
    let travelPoints = 480 // 480 minutes = 8 hours 
    let minutes = 0
    for (let a = 0; a < attendances.length; a++) {
        let attendance = attendances[a] // daily

        if(attendance.onTravel){
            minutes += travelPoints
        } else {
            // roll logs 
            let momentIn = null
            for (let l = 0; l < attendance.logs.length; l++) {
                let log = attendance.logs[l]
                if(log.mode === 1) {
                    momentIn = moment(log.dateTime)
                    if(momentIn.format('A') === 'AM'){ // morning
                        // TODO: Null checks
                        let momentGrace = moment().hour(gracePeriod[0].hour).minutes(gracePeriod[0].minute)
                        if(momentIn.isSameOrBefore(momentGrace)){
                            momentIn = momentIn.hour(8).minute(0)
                        }
                    } else {
                        // TODO: Null checks
                        let momentGrace = moment().hour(gracePeriod[1].hour).minutes(gracePeriod[1].minute)
                        if(momentIn.isSameOrBefore(momentGrace)){
                            momentIn = momentIn.hour(13).minute(0)
                        }
                    }
                } else if (log.mode === 0) {
                    let momentOut = moment(log.dateTime)
                    minutes += Math.round(momentOut.diff(momentIn) / 60000)
                    console.log(momentIn, momentOut, minutes)
                }
            }
        }
    }
    console.log(minutes)
    return minutes
}
let getCosStaff = async (payroll, workDays = 22) => {

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
        let minutes = getTotalAttendanceMinutes(attendances)
        // minutes = 3840
        employee.attendances = attendances
        let hoursPerDay = 8
        let minutesPerDay = 60 * hoursPerDay
        let renderedDays = minutes / minutesPerDay

        employee.timeRecord = {
            totalMinutes: minutes,
            daysReported: attendances.length,
            renderedDays: Math.floor(renderedDays),
            renderedHours: Math.floor((renderedDays - Math.floor(renderedDays)) * hoursPerDay),
            renderedMinutes: minutes % 60
        }


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
    getCosStaff: getCosStaff,
    getDailyRate: getDailyRate,
    getHourlyRate: getHourlyRate
}