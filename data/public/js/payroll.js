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
    } else if (salaryType === 'hourly') {
        var perHour = salary;
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

var getCellValue = function (row, columnUid, formulas, columns) {
    // If columnUid is not on payroll columns, return 0
    var column = columns.find(function (_column) {
        return _column.uid === columnUid;
    })
    if (!column) return 0

    var cell = row.cells.find(function (_cell) {
        return _cell.columnUid === columnUid;
    })

    var cellVal = _.get(cell, 'value');
    if (cellVal) return cellVal;

    // Get formula key from column.formula
    var formula = formulas.find(function (f) {
        return f.uid === columnUid;
    })
    return _.invoke(formula, 'getValue', row, columnUid, formulas, columns) || 0;
}

// Formulas
var formulas = [
    {
        uid: 'fundSource',
        getValue: function (row, columnUid, formulas, columns) {
            return _.get(row, 'employment.fundSource', '');
        }
    },
    {
        uid: 'name',
        getValue: function (row, columnUid, formulas, columns) {
            var names = [_.get(row, 'employee.lastName', ''), _.get(row, 'employee.firstName', '')].filter(function (o) {
                return o !== '';
            })
            return names.join(', ');
        }
    },
    {
        uid: 'position',
        getValue: function (row, columnUid, formulas, columns) {
            return _.get(row, 'employment.position', '');
        }
    },
    {
        uid: 'basePay',
        getValue: function (row, columnUid, formulas, columns) {
            return parseFloat(_.get(row, 'employment.salary', 0));
        }
    },
    {
        uid: 'attendance',
        getValue: function (row, columnUid, formulas, columns) {
            var t = _.get(row, 'timeRecord')
            return {
                days: _.get(t, 'renderedDays', 0),
                hrs: _.get(t, 'renderedHours', 0),
                mins: _.get(t, 'renderedMinutes', 0),
            }
        }
    },
    {
        uid: 'amountWorked',
        getValue: function (row, columnUid, formulas, columns) {
            let amount = 0
            try{
                amount = amountWorked(_.get(row, 'employment.salary', 0), _.get(row, 'employment.salaryType'), _.get(row, 'timeRecord.totalMinutes', 0))
            } catch (err){
                console.warn(`Error at rowUid ${row.uid}, colUid ${columnUid}:`, err)
            }
            return parseFloat(money.floatToAmount(
                amount
            ))
        }
    },
    {
        uid: '5Premium',
        getValue: function (row, columnUid, formulas, columns) {
            return parseFloat(
                money.floatToAmount(
                    getCellValue(row, 'amountWorked', formulas, columns) * 0.05
                )
            )
        }
    },
    {
        uid: 'grossPay',
        getValue: function (row, columnUid, formulas, columns) {
            return parseFloat(
                money.floatToAmount(
                    getCellValue(row, 'amountWorked', formulas, columns) + getCellValue(row, '5Premium', formulas, columns)
                )
            )
        }
    },
    {
        uid: 'totalTax',
        getValue: function (row, columnUid, formulas, columns) {
            return parseFloat(
                money.floatToAmount(
                    getCellValue(row, 'tax3', formulas, columns) + getCellValue(row, 'tax10', formulas, columns)
                )
            )
        }
    },
    {
        uid: 'totalSss',
        getValue: function (row, columnUid, formulas, columns) {
            return parseFloat(
                money.floatToAmount(
                    getCellValue(row, 'contributionSss', formulas, columns) + getCellValue(row, 'ecSss', formulas, columns)
                )
            )
        }
    },
    {
        uid: 'totalDeductions',
        getValue: function (row, columnUid, formulas, columns) {
            return parseFloat(
                money.floatToAmount(
                    getCellValue(row, 'totalTax', formulas, columns) + getCellValue(row, 'totalSss', formulas, columns)
                )
            )
        }
    },
    {
        uid: 'netPay',
        getValue: function (row, columnUid, formulas, columns) {
            return parseFloat(
                money.floatToAmount(
                    getCellValue(row, 'grossPay', formulas, columns) - getCellValue(row, 'totalDeductions', formulas, columns)
                )
            )
        }
    },
    /////////////////
    {
        uid: 'peraAca',
        getValue: function (row, columnUid, formulas, columns) {
            return 2000
        }
    },
    {
        uid: 'grossPayAllowance',
        getValue: function (row, columnUid, formulas, columns) {
            return parseFloat(
                money.floatToAmount(
                    getCellValue(row, 'basePay', formulas, columns) + getCellValue(row, 'peraAca', formulas, columns)
                )
            )
        }
    },
    {
        uid: 'tardiness',
        getValue: function (row, columnUid, formulas, columns) {
            return parseFloat(money.floatToAmount(
                tardiness(_.get(row, 'employment.salary', 0), _.get(row, 'employment.salaryType'), 22, _.get(row, 'timeRecord.underTimeTotalMinutes', 0))
            ))
        }
    },
    {
        uid: 'grossPayPermanent',
        getValue: function (row, columnUid, formulas, columns) {
            return parseFloat(
                money.floatToAmount(
                    getCellValue(row, 'grossPayAllowance', formulas, columns) - getCellValue(row, 'tardiness', formulas, columns)
                )
            )
        }
    },
    {
        uid: 'rlipPs9',
        getValue: function (row, columnUid, formulas, columns) {
            return parseFloat(
                money.floatToAmount(getCellValue(row, 'basePay', formulas, columns) * 0.09)
            )
        }
    },
    {
        uid: 'totalMandatoryDeductions',
        getValue: function (row, columnUid, formulas, columns) {
            var v = []
            v.push(getCellValue(row, 'rlipPs9', formulas, columns))
            v.push(getCellValue(row, 'emergencyLoan', formulas, columns))
            v.push(getCellValue(row, 'eal', formulas, columns))
            v.push(getCellValue(row, 'consoLoan', formulas, columns))
            v.push(getCellValue(row, 'ouliPremium', formulas, columns))
            v.push(getCellValue(row, 'policyOuliLoan', formulas, columns))
            v.push(getCellValue(row, 'regularPolicyLoan', formulas, columns))
            v.push(getCellValue(row, 'gfal', formulas, columns))
            v.push(getCellValue(row, 'mpl', formulas, columns))
            v.push(getCellValue(row, 'cpl', formulas, columns))
            v.push(getCellValue(row, 'help', formulas, columns))
            v.push(getCellValue(row, 'medicare', formulas, columns))
            v.push(getCellValue(row, 'pagibigContribution', formulas, columns))
            v.push(getCellValue(row, 'mplLoan', formulas, columns))
            v.push(getCellValue(row, 'calamityLoan', formulas, columns))
            v.push(getCellValue(row, 'withholdingTax', formulas, columns))
            return v.reduce(function (accum, current) {
                return accum + current;
            }, 0)

        }
    },

    {
        uid: 'netAfterTotalMandatoryDeductions',
        getValue: function (row, columnUid, formulas, columns) {
            var v1 = getCellValue(row, 'grossPayPermanent', formulas, columns)
            var v2 = getCellValue(row, 'totalMandatoryDeductions', formulas, columns)
            return parseFloat(v1 - v2)
        }
    },
    //
    {
        uid: 'totalNonMandatoryDeductions',
        getValue: function (row, columnUid, formulas, columns) {
            var v = []
            v.push(getCellValue(row, 'teachersScholars', formulas, columns))
            v.push(getCellValue(row, 'ffaLoan', formulas, columns))
            v.push(getCellValue(row, 'citySavingsBank', formulas, columns))
            return v.reduce(function (accum, current) {
                return accum + current;
            }, 0)

        }
    },
    {
        uid: 'netPayPermanent',
        getValue: function (row, columnUid, formulas, columns) {
            var v1 = getCellValue(row, 'grossPayPermanent', formulas, columns)
            var v2 = getCellValue(row, 'totalMandatoryDeductions', formulas, columns)
            var v3 = getCellValue(row, 'totalNonMandatoryDeductions', formulas, columns)
            return parseFloat(v1 - (v2 + v3))
        }
    },
    // Outside
    {
        uid: 'totalQuincena',
        getValue: function (row, columnUid, formulas, columns) {
            var v1 = getCellValue(row, 'firstQuincena', formulas, columns)
            var v2 = getCellValue(row, 'secondQuincena', formulas, columns)
            return v1 + v2
        }
    },
    {
        uid: 'variance',
        getValue: function (row, columnUid, formulas, columns) {
            var v1 = getCellValue(row, 'totalQuincena', formulas, columns)
            var v2 = getCellValue(row, 'netPayPermanent', formulas, columns)
            return v1 - v2
        }
    },
    {
        uid: 'totalDeductionsPermanent',
        getValue: function (row, columnUid, formulas, columns) {
            var v1 = getCellValue(row, 'totalMandatoryDeductions', formulas, columns)
            var v2 = getCellValue(row, 'totalNonMandatoryDeductions', formulas, columns)
            return v1 + v2
        }
    },

]


function getSubTotal(columnUid, rowIndex, payroll, formulas) {
    let column = payroll.columns.find(function (c) {
        return c.uid === columnUid;
    })
    if (!column) {
        console.error('Cannot find column "' + columnUid + '" in a subtotal row.');
        return 0;
    }

    if (rowIndex > payroll.rows.length - 1) throw new Error('Out of bounds.')

    let start = 0
    // Start from before current row
    // Until a non row.type === 1 is found
    for (let y = rowIndex - 1; y >= 0; y--) {
        let row = payroll.rows[y]
        if (row.type !== 1) {
            start = y + 1
            break
        }
    }
    let end = rowIndex // rowIndex - 1 is actual end index

    let values = payroll.rows.slice(start, end).filter(function (row) {
        return row.type === 1;
    }).map(function (row) {
        return getCellValue(row, columnUid, formulas, payroll.columns);
    })
    return values.reduce(function (accum, current) {
        return accum + current;
    }, 0)
}

function getGrandTotal(columnUid, rowIndex, payroll, formulas) {

    let column = payroll.columns.find(function (c) {
        return c.uid === columnUid;
    })
    if (!column) {
        console.error('Cannot find column "' + columnUid + '" in a subtotal row.');
        return 0;
    }

    if (rowIndex > payroll.rows.length - 1) throw new Error('Out of bounds.')

    let values = payroll.rows.slice(0, rowIndex).filter(function (row) {
        return row.type === 1;
    }).map(function (row) {
        return getCellValue(row, columnUid, formulas, payroll.columns);
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
        getGrandTotal: getGrandTotal,
        getSubTotal: getSubTotal,
        tardiness: tardiness,
    }
} catch (e) { }