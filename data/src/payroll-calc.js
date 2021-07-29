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
        let empType = employment.employmentType

        // Rendered work
        // Payroll period attendance
        let attendances = employment.attendances

        // add computed values
        let totalMinutes = 0
        let totalMinutesUnderTime = 0
        for (let a = 0; a < attendances.length; a++) {
            let attendance = attendances[a] // daily
            let dtr = dtrHelper.calcDailyAttendance(attendance, hoursPerDay, travelPoints)
            totalMinutes += dtr.totalMinutes
            totalMinutesUnderTime += dtr.underTimeTotalMinutes
            attendances[a].dtr = dtr
        }

        // minutes = 3840
        // console.log(employee.lastName, totalMinutes, totalMinutesUnderTime, hoursPerDay)
        employment.attendances = attendances
        employment.timeRecord = dtrHelper.calcTimeRecord(totalMinutes, totalMinutesUnderTime, hoursPerDay)
        // console.log(employee.lastName, employment.timeRecord)

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

        employment.tardiness = 0
        if (empType === 'permanent') {
            employment.amountWorked = employment.salary
            // Undertime
            let perDay = employment.salary / workDays
            let perHour = perDay / 8
            let perMin = perHour / 60

            if (employment.timeRecord.underTimeTotalMinutes > 0) {
                /*
                Swap with code below if need more accuracy
                let tardiness = perMin * employment.timeRecord.underTimeTotalMinutes
                */
                // Based on HR excel formula
                let tardiness = money.mul(money.floatToAmount(perHour), money.floatToAmount(employment.timeRecord.underTimeTotalMinutes / 60))
                tardiness = parseFloat(tardiness)

                employment.tardiness = tardiness
                employment.amountWorked -= tardiness
            }
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
            employment.incentives.push(incentive)// TODO: check what it does

        }
        employment.totalIncentives = totalIncentives
        employment.amountPostIncentives = employment.salary + totalIncentives
        employment.grantTotal = employment.amountPostIncentives - employment.tardiness
        totalAmountPostIncentives += employment.amountPostIncentives
        // 
        employment.deductions = []
        employment.deductionsMandatory = []
        employment.deductionsNonMandatory = []
        let totalDeductions = 0
        let totalDeductionsMandatory = 0
        let totalDeductionsNonMandatory = 0
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

            if (deduction.mandatory) {
                employment.deductionsMandatory.push(deduction)
                totalDeductionsMandatory += parseFloat(deduction.amount)
            } else {
                employment.deductionsNonMandatory.push(deduction)
                totalDeductionsNonMandatory += parseFloat(deduction.amount)
            }
        }
        //

        employment.totalDeductions = totalDeductions
        employment.totalDeductionsMandatory = totalDeductionsMandatory
        employment.totalDeductionsNonMandatory = totalDeductionsNonMandatory
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

let attachDailyTime = async (attendances) => {
    return attendances
}



module.exports = {
    getCosStaff: getCosStaff,
    computePayroll: computePayroll,
    getDailyRate: getDailyRate,
    getHourlyRate: getHourlyRate,
    attachDailyTime: attachDailyTime,
}