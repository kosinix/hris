//// Core modules

//// External modules
const lodash = require('lodash')
const momentRange = require("moment-range")
const moment = momentRange.extendMoment(require("moment"));
const money = require('money-math')

//// Modules
const db = require('./db');
const dtrHelper = require('./dtr-helper');

let getDailyRate = (monthlyRate, workDays = 22) => {
    return monthlyRate / workDays
}

let getHourlyRate = (monthlyRate, workDays = 22, hoursPerDay = 8) => {
    return monthlyRate / workDays / hoursPerDay
}

let getPerMinuteRate = (monthlyRate, workDays = 22, hoursPerDay = 8) => {
    return monthlyRate / workDays / hoursPerDay / 60
}

let calcTimeRecord = (minutes, totalMinutesUnderTime, hoursPerDay) => {
    let renderedDays = minutes / 60 / hoursPerDay
    let renderedHours = (renderedDays - Math.floor(renderedDays)) * hoursPerDay
    let renderedMinutes = (renderedHours - Math.floor(renderedHours)) * 60

    let undertime = false
    let underDays = 0
    let underHours = 0
    let underMinutes = 0

    if (totalMinutesUnderTime > 0) {
        undertime = true
        underDays = totalMinutesUnderTime / 60 / hoursPerDay
        underHours = (underDays - Math.floor(underDays)) * hoursPerDay
        underMinutes = (underHours - Math.floor(underHours)) * 60
    }

    return {
        totalMinutes: minutes,
        renderedDays: Math.floor(renderedDays),
        renderedHours: Math.floor(renderedHours),
        renderedMinutes: Math.floor(renderedMinutes),
        underTimeTotalMinutes: totalMinutesUnderTime,
        underDays: Math.floor(underDays),
        underHours: Math.floor(underHours),
        underMinutes: Math.floor(underMinutes),
        undertime: undertime
    }
}
let calcRenderedTime = (minutes, hoursPerDay) => {
    let renderedDays = minutes / 60 / hoursPerDay
    let renderedHours = (renderedDays - Math.floor(renderedDays)) * hoursPerDay
    let renderedMinutes = (renderedHours - Math.floor(renderedHours)) * 60

    let undertime = false
    let underTimeTotalMinutes = hoursPerDay * 60 - minutes
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
        let dtr = dtrHelper.calcDailyAttendance(attendance, hoursPerDay, travelPoints)
        attendances[a].dtr = dtr
    }
    return attendances
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

let getCosStaff = async (payroll, workDays = 22, hoursPerDay = 8, travelPoints) => {

    // let totalAmountPostIncentives = 0
    // let totalAmountPostDeductions = 0

    // Compute row of employments
    for (let x = 0; x < payroll.rows.length; x++) {
        let row = payroll.rows[x]
        let employment = row.employment
        let attendances = row.attendances
        let timeRecord = row.timeRecord
        let incentives = row.incentives
        let deductions = row.deductions

        // Attach computed values
        row.computed.amountWorked = compute.amountWorked(employment.salary, employment.salaryType, timeRecord.totalMinutes)
        row.computed.tardiness = compute.tardiness(employment.salary, employment.salaryType, workDays,  timeRecord.underTimeTotalMinutes)

        // 
        let totalIncentives = 0
        for (let i = 0; i < payroll.incentives.length; i++) {
            let incentive = lodash.cloneDeep(payroll.incentives[i])
            if (incentive.type === 'normal') {
                incentive.amount = (incentive.initialAmount)
            } else if (incentive.type === 'percentage') {
                let percentage = incentive.percentage / 100
                if(incentive.percentOf === 'amountWorked'){
                    incentive.amount = percentage * row.computed.amountWorked
                } else {
                    incentive.amount = percentage * employment.salary
                }
            }
            totalIncentives += parseFloat(incentive.amount)
            incentives.push(incentive)// TODO: check what it does
        }
        row.computed.totalIncentives = totalIncentives
        
        let totalDeductions = 0
        for (let d = 0; d < payroll.deductions.length; d++) {
            let deduction = lodash.cloneDeep(payroll.deductions[d])

            let found = deductions.find((o) => {
                return o.uid === deduction.uid
            })
            if (!found) { // payroll d is not yet in employment
                if (deduction.deductionType === 'normal') {
                    deduction.amount = deduction.initialAmount
                } else if (deduction.deductionType === 'percentage') {
                    deduction.amount = (deduction.percentage / 100 * employment.salary)
                }
                deductions.push(deduction)
                totalDeductions += parseFloat(deduction.amount)

            } else {
                totalDeductions += parseFloat(found.amount)
            }
        }
        row.computed.totalDeductions = totalDeductions
    }

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
            // // vue
            // deduction.vueReadOnly = true
            // deduction.vueDisabled = false
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

let attachDailyTime = async (attendances) => {
    return attendances
}



module.exports = {
    compute: compute,
    getCosStaff: getCosStaff,
    computePayroll: computePayroll,
    getDailyRate: getDailyRate,
    getHourlyRate: getHourlyRate,
    attachDailyTime: attachDailyTime,
}