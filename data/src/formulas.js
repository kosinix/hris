//// Core modules

//// External modules
const _ = require('lodash')
const moment = require("moment")
const money = require('money-math')

//// Modules
const dtrHelper = require('./dtr-helper');

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
                return `${_.get(row, 'employment.salary', 0).toFixed(2)}`
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
    ]
}

module.exports = formulas