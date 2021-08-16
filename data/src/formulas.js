// Used in both browser and node

//// Core modules

//// External modules
const _ = require('lodash')
const moment = require("moment")
const money = require('money-math')

//// Modules
const dtrHelper = require('./dtr-helper');

let window = {
    Money: money
}

let getCellValue = function (row, columnUid, formulas, defVal = 0) {
    let cell = row.cells.find(c => c.columnUid === columnUid)
    let formula = formulas.find(f => f.uid === columnUid)
    let cellVal = _.get(cell, 'value')
    if (cellVal) return cellVal

    return _.invoke(formula, 'getValue', row, formulas) || defVal
}

// Formulas
let formulas = {
    cos: [
        {
            uid: 'fundSource',
            getValue: (row) => {
                return `${_.get(row, 'employment.fundSource', '')}`
            }
        },
        {
            uid: 'name',
            getValue: (row) => {
                let names = [_.get(row, 'employee.lastName', ''), _.get(row, 'employee.firstName', '')].filter(o => o !== '')
                return names.join(', ')
            }
        },
        {
            uid: 'position',
            getValue: (row) => {
                return `${_.get(row, 'employment.position', '')}`
            }
        },
        {
            uid: 'basePay',
            getValue: (row) => {
                return parseFloat(_.get(row, 'employment.salary', 0))
            }
        },
        {
            uid: 'attendance',
            getValue: (row) => {
                let t = _.get(row, 'timeRecord')
                return JSON.stringify({
                    days: t.renderedDays,
                    hrs: t.renderedHours,
                    mins: t.renderedMinutes,
                })
            }
        },
        {
            uid: 'amountWorked',
            getValue: (row) => {
                if (row.type !== 1) return ''
                return parseFloat(money.floatToAmount(
                    dtrHelper.compute.amountWorked(_.get(row, 'employment.salary', 0), _.get(row, 'employment.salaryType'), _.get(row, 'timeRecord.totalMinutes', 0))
                ))
            }
        },
        {
            uid: '5Premium',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                let formula = formulas.find(f => f.uid === 'amountWorked')

                return parseFloat(money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) * 0.05))
            }
        },
        {
            uid: 'grossPay',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                let formula = formulas.find(f => f.uid === 'amountWorked')
                let formula2 = formulas.find(f => f.uid === '5Premium')

                return parseFloat(money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) +
                    _.invoke(formula2, 'getValue', row, formulas)))
            }
        },
        {
            uid: 'totalTax',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                let cell1 = row.cells.find(c => c.columnUid === 'tax3')
                let cell2 = row.cells.find(c => c.columnUid === 'tax10')

                return parseFloat(money.floatToAmount(_.get(cell1, 'value', 0) +
                    _.get(cell2, 'value', 0)))
            }
        },
        {
            uid: 'totalSss',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                let cell1 = row.cells.find(c => c.columnUid === 'contributionSss')
                let cell2 = row.cells.find(c => c.columnUid === 'ecSss')

                return parseFloat(money.floatToAmount(_.get(cell1, 'value', 0) +
                    _.get(cell2, 'value', 0)))
            }
        },
        {
            uid: 'totalDeductions',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                let formula = formulas.find(f => f.uid === 'totalTax')
                let formula2 = formulas.find(f => f.uid === 'totalSss')

                return parseFloat(money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) +
                    _.invoke(formula2, 'getValue', row, formulas)))
            }
        },
        {
            uid: 'netPay',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                let formula = formulas.find(f => f.uid === 'grossPay')
                let formula2 = formulas.find(f => f.uid === 'totalDeductions')

                return parseFloat(money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) -
                    _.invoke(formula2, 'getValue', row, formulas)))
            }
        },
        {
            uid: 'totalGrossPay',
            getValue: (rows, formulas) => {
                if (row.type !== 1) return ''
                let formula = formulas.find(f => f.uid === 'grossPay')
                let formula2 = formulas.find(f => f.uid === 'totalDeductions')

                return parseFloat(money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) -
                    _.invoke(formula2, 'getValue', row, formulas)))
            }
        },
    ],
    permanent: [
        {
            uid: 'name',
            getValue: (row) => {
                let names = [_.get(row, 'employee.lastName', ''), _.get(row, 'employee.firstName', '')].filter(o => o !== '')
                return names.join(', ')
            }
        },
        {
            uid: 'position',
            getValue: (row) => {
                return `${_.get(row, 'employment.position', '')}`
            }
        },
        {
            uid: 'basePay',
            getValue: (row) => {
                return parseFloat(_.get(row, 'employment.salary', 0))
            }
        },
        {
            uid: 'peraAca',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                return 2000
            }
        },
        {
            uid: 'grossPayAllowance',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                let formula = formulas.find(f => f.uid === 'basePay')
                let formula2 = formulas.find(f => f.uid === 'peraAca')

                return parseFloat(money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) +
                    _.invoke(formula2, 'getValue', row, formulas)))
            }
        },
        {
            uid: 'tardiness',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                return parseFloat(money.floatToAmount(
                    dtrHelper.compute.tardiness(_.get(row, 'employment.salary', 0), _.get(row, 'employment.salaryType'), 22, _.get(row, 'timeRecord.underTimeTotalMinutes', 0))
                ))
            }
        },
        {
            uid: 'grossPay',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                let formula = formulas.find(f => f.uid === 'grossPayAllowance')
                let formula2 = formulas.find(f => f.uid === 'tardiness')

                return parseFloat(money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) -
                    _.invoke(formula2, 'getValue', row, formulas)))
            }
        },
        {
            uid: 'rlipPs9',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                let formula = formulas.find(f => f.uid === 'basePay')

                return parseFloat(
                    money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) * 0.09)
                )
            }
        },
        {
            uid: 'totalMandatoryDeductions',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                let v = []
                v.push(getCellValue(row, 'rlipPs9', formulas))
                v.push(getCellValue(row, 'emergencyLoan', formulas))
                v.push(getCellValue(row, 'eal', formulas))
                v.push(getCellValue(row, 'consoLoan', formulas))
                v.push(getCellValue(row, 'ouliPremium', formulas))
                v.push(getCellValue(row, 'policyOuliLoan', formulas))
                v.push(getCellValue(row, 'regularPolicyLoan', formulas))
                v.push(getCellValue(row, 'gfal', formulas))
                v.push(getCellValue(row, 'mpl', formulas))
                v.push(getCellValue(row, 'cpl', formulas))
                v.push(getCellValue(row, 'help', formulas))
                v.push(getCellValue(row, 'medicare', formulas))
                v.push(getCellValue(row, 'pagibigContribution', formulas))
                v.push(getCellValue(row, 'mplLoan', formulas))
                v.push(getCellValue(row, 'calamityLoan', formulas))
                v.push(getCellValue(row, 'withholdingTax', formulas))
                return v.reduce((accum, current) => {
                    return accum + current;
                }, 0)

            }
        },

        {
            uid: 'netAfterTotalMandatoryDeductions',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                let v1 = getCellValue(row, 'grossPay', formulas)
                let v2 = getCellValue(row, 'totalMandatoryDeductions', formulas)
                return parseFloat(v1 - v2)
            }
        },
        //
        {
            uid: 'totalNonMandatoryDeductions',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                let v = []
                v.push(getCellValue(row, 'teachersScholars', formulas))
                v.push(getCellValue(row, 'ffaLoan', formulas))
                v.push(getCellValue(row, 'citySavingsBank', formulas))
                return v.reduce((accum, current) => {
                    return accum + current;
                }, 0)

            }
        },
        {
            uid: 'netPay',
            getValue: (row, formulas) => {
                if (row.type !== 1) return ''
                let v1 = getCellValue(row, 'grossPay', formulas)
                let v2 = getCellValue(row, 'totalMandatoryDeductions', formulas)
                let v3 = getCellValue(row, 'totalNonMandatoryDeductions', formulas)
                return parseFloat(v1 - (v2 + v3))
            }
        },

    ]
}

try {
   module.exports = formulas
} catch (e) {}