//// Core modules

//// External modules
const lodash = require('lodash')
const momentRange = require("moment-range")
const moment = momentRange.extendMoment(require("moment"));

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

let calcRenderedTime = (minutes, hoursPerDay) => {
    let renderedDays = minutes / 60 / hoursPerDay
    let renderedHours = (renderedDays - Math.floor(renderedDays)) * hoursPerDay
    let renderedMinutes = (renderedHours - Math.floor(renderedHours)) * 60

    let gracePeriodMinutes = 0 // 15 mins AM, 15 mins PM
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

    // Default govt shift
    let shifts = []
    shifts.push(dtrHelper.createShift({ hour: 8, minute: 0 }, { hour: 12, minute: 0 }, { hour: 0, minute: 15 }, { maxHours: 4 }))
    shifts.push(dtrHelper.createShift({ hour: 13, minute: 0 }, { hour: 17, minute: 0 }, { hour: 0, minute: 15 }, { maxHours: 4 }))


    // travelPoints 480 minutes = 8 hours 
    if (null === attendance) return null

    // Daily minutes
    let minutes = 0
    if (attendance.onTravel) {
        minutes += travelPoints
    } else {
        // roll logs 
        let momentIn = null
        let startMinutes = null
        let shiftCurrent = null
        let logoutMinutes = null

        for (let l = 0; l < attendance.logs.length; l++) {
            let log = attendance.logs[l]
            if (log.mode === 1) { // in
                momentIn = moment(log.dateTime)
                startMinutes = dtrHelper.momentToMinutes(momentIn)
                shiftCurrent = dtrHelper.getNextShift(startMinutes, shifts)

                if (startMinutes <= shiftCurrent.start + shiftCurrent.grace) { // late but graced
                    startMinutes = shiftCurrent.start // set to shift start
                }

            } else if (log.mode === 0) { // out
                logoutMinutes = dtrHelper.momentToMinutes(moment(log.dateTime))
                if (logoutMinutes < shiftCurrent.start) {
                    throw new Error('Logging out before shift')
                }
                if (logoutMinutes > shiftCurrent.end) {
                    logoutMinutes = shiftCurrent.end // Not counted outshide shift
                }

                let shiftMinutes = logoutMinutes - startMinutes
                if (shiftMinutes > shiftCurrent.maxMinutes) {
                    shiftMinutes = shiftCurrent.maxMinutes
                }

                minutes += (logoutMinutes - startMinutes)
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

let attachDailyTime = async (attendances) => {
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