// Used in both browser and node


if (typeof module === "object" && typeof module.exports === "object") {
    // nodejs
    _ = require('lodash');
    money = require('money-math');

} else if (typeof window !== "undefined" && typeof window.document !== "undefined") {
    // browser

    if (!window._) throw new Error('Package lodash needed.')

    // Use money instead of window.Money in browser
    if (!window.Money) throw new Error('Package money-math needed.')
    window.money = window.Money;
}

//// Modules
var amountWorked = function (salary, salaryType, totalMinutes) {
    if (salaryType === 'monthly') {
        return salary;
    } else if (salaryType === 'daily') {
        var perHour = salary / 8;
        var perMin = perHour / 60;
        return (perMin * totalMinutes);
    }
    throw new Error('Invalid condition.');
}

var tardiness = function (salary, salaryType, workDays, underTimeTotalMinutes) {
    var tardiness = 0
    if (salaryType === 'monthly') {
        // Undertime
        var perDay = salary / workDays
        var perHour = perDay / 8

        if (underTimeTotalMinutes > 0) {
            /*
            Swap with code below if need more accuracy
            var perMin = perHour / 60
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

var getCellValue = function (row, column, formulas, defVal = 0) {
    if (typeof column === 'string' || column instanceof String) {
        column = {
            uid: column
        }
    }
    var cell = row.cells.find(function (c) {
        return c.columnUid === column.uid;
    })
    var formula = formulas.find(function (f) {
        return f.uid === column.uid;
    })

    var cellVal = _.get(cell, 'value');
    if (cellVal) return cellVal;

    return _.invoke(formula, 'getValue', row, formulas) || defVal;
}

// Formulas
var formulas = {
    cos_staff: [
        {
            uid: 'fundSource',
            getValue: function (row) {
                return _.get(row, 'employment.fundSource', '');
            }
        },
        {
            uid: 'name',
            getValue: function (row) {
                var names = [_.get(row, 'employee.lastName', ''), _.get(row, 'employee.firstName', '')].filter(function (o) {
                    return o !== '';
                })
                return names.join(', ');
            }
        },
        {
            uid: 'position',
            getValue: function (row) {
                return _.get(row, 'employment.position', '');
            }
        },
        {
            uid: 'basePay',
            getValue: function (row) {
                return parseFloat(_.get(row, 'employment.salary', 0));
            }
        },
        {
            uid: 'attendance',
            getValue: function (row) {
                var t = _.get(row, 'timeRecord')
                return {
                    days: t.renderedDays,
                    hrs: t.renderedHours,
                    mins: t.renderedMinutes,
                }
            }
        },
        {
            uid: 'amountWorked',
            getValue: function (row) {
                return parseFloat(money.floatToAmount(
                    amountWorked(_.get(row, 'employment.salary', 0), _.get(row, 'employment.salaryType'), _.get(row, 'timeRecord.totalMinutes', 0))
                ))
            }
        },
        {
            uid: '5Premium',
            getValue: function (row, formulas) {
                return parseFloat(
                    money.floatToAmount(
                        getCellValue(row, 'amountWorked', formulas) * 0.05
                    )
                )
            }
        },
        {
            uid: 'grossPay',
            getValue: function (row, formulas) {
                return parseFloat(
                    money.floatToAmount(
                        getCellValue(row, 'amountWorked', formulas) + getCellValue(row, '5Premium', formulas)
                    )
                )
            }
        },
        {
            uid: 'totalTax',
            getValue: function (row, formulas) {
                return parseFloat(
                    money.floatToAmount(
                        getCellValue(row, 'tax3', formulas) + getCellValue(row, 'tax10', formulas)
                    )
                )
            }
        },
        {
            uid: 'totalSss',
            getValue: function (row, formulas) {
                return parseFloat(
                    money.floatToAmount(
                        getCellValue(row, 'contributionSss', formulas) + getCellValue(row, 'ecSss', formulas)
                    )
                )
            }
        },
        {
            uid: 'totalDeductions',
            getValue: function (row, formulas) {
                return parseFloat(
                    money.floatToAmount(
                        getCellValue(row, 'totalTax', formulas) + getCellValue(row, 'totalSss', formulas)
                    )
                )
            }
        },
        {
            uid: 'netPay',
            getValue: function (row, formulas) {
                

                return parseFloat(
                    money.floatToAmount(
                        getCellValue(row, 'grossPay', formulas) - getCellValue(row, 'totalDeductions', formulas)
                    )
                )
            }
        },
    ],
    permanent: [
        {
            uid: 'name',
            getValue: function (row) {
                var names = [_.get(row, 'employee.lastName', ''), _.get(row, 'employee.firstName', '')].filter(function (o) {
                    return o !== '';
                })
                return names.join(', ')
            }
        },
        {
            uid: 'position',
            getValue: function (row) {
                return `${_.get(row, 'employment.position', '')}`
            }
        },
        {
            uid: 'basePay',
            getValue: function (row) {
                return parseFloat(_.get(row, 'employment.salary', 0))
            }
        },
        {
            uid: 'peraAca',
            getValue: function (row) {
                
                return 2000
            }
        },
        {
            uid: 'grossPayAllowance',
            getValue: function (row, formulas) {
                

                return parseFloat(
                    money.floatToAmount(
                        getCellValue(row, 'basePay', formulas) + getCellValue(row, 'peraAca', formulas)
                    )
                )
            }
        },
        {
            uid: 'tardiness',
            getValue: function (row, formulas) {
                
                return parseFloat(money.floatToAmount(
                    tardiness(_.get(row, 'employment.salary', 0), _.get(row, 'employment.salaryType'), 22, _.get(row, 'timeRecord.underTimeTotalMinutes', 0))
                ))
            }
        },
        {
            uid: 'grossPay',
            getValue: function (row, formulas) {
                

                return parseFloat(
                    money.floatToAmount(
                        getCellValue(row, 'grossPayAllowance', formulas) - getCellValue(row, 'tardiness', formulas)
                    )
                )
            }
        },
        {
            uid: 'rlipPs9',
            getValue: function (row, formulas) {
                

                return parseFloat(
                    money.floatToAmount(getCellValue(row, 'basePay', formulas) * 0.09)
                )
            }
        },
        {
            uid: 'totalMandatoryDeductions',
            getValue: function (row, formulas) {
                
                var v = []
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
                return v.reduce(function (accum, current) {
                    return accum + current;
                }, 0)

            }
        },

        {
            uid: 'netAfterTotalMandatoryDeductions',
            getValue: function (row, formulas) {
                var v1 = getCellValue(row, 'grossPay', formulas)
                var v2 = getCellValue(row, 'totalMandatoryDeductions', formulas)
                return parseFloat(v1 - v2)
            }
        },
        //
        {
            uid: 'totalNonMandatoryDeductions',
            getValue: function (row, formulas) {
                var v = []
                v.push(getCellValue(row, 'teachersScholars', formulas))
                v.push(getCellValue(row, 'ffaLoan', formulas))
                v.push(getCellValue(row, 'citySavingsBank', formulas))
                return v.reduce(function (accum, current) {
                    return accum + current;
                }, 0)

            }
        },
        {
            uid: 'netPay',
            getValue: function (row, formulas) {
                var v1 = getCellValue(row, 'grossPay', formulas)
                var v2 = getCellValue(row, 'totalMandatoryDeductions', formulas)
                var v3 = getCellValue(row, 'totalNonMandatoryDeductions', formulas)
                return parseFloat(v1 - (v2 + v3))
            }
        },

    ]
}

function getSubTotal(columnUid, range, payroll, formulas) {
    if(!columnUid) return 0
    var cell = {
        columnUid: columnUid,
        range: range
    }
    let column = payroll.columns.find(function (c) {
        return c.uid === cell.columnUid;
    })
    if (!column) {
        throw new Error('Cannot find column "' + cell.columnUid + '" in a subtotal row.');
    }
    let start = _.get(cell, 'range[0]', 0)
    let length = _.get(cell, 'range[1]', payroll.rows.length)
    let values = payroll.rows.slice(start, length).filter(function (r) {
        return r.type === 1;
    }).map(function (row) {
        return getCellValue(row, column, formulas[payroll.template])
    })
    return values.reduce(function (accum, current) {
        return accum + current;
    }, 0)
}

try {
    module.exports = {
        amountWorked: amountWorked,
        formulas: formulas,
        getCellValue: getCellValue,
        getSubTotal: getSubTotal,
        tardiness: tardiness,
    }
} catch (e) { }