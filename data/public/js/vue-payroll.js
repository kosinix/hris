// Define a new component
if (typeof VuePayroll === 'undefined') {
    function VuePayroll() { } // Goes to window.VuePayroll
}
if (typeof money === 'undefined'){
    if(!window.Money) throw new Error('Package money-math needed.')
    var money = window.Money || {}
}
var dtrHelper = {
    amountWorked: function (salary, salaryType, totalMinutes) {
        if (salaryType === 'monthly') {
            return salary;
        } else if (salaryType === 'daily') {
            let perHour = salary / 8;
            let perMin = perHour / 60;
            return (perMin * totalMinutes);
        }
        throw new Error('Invalid condition.');
    },
    tardiness: function (salary, salaryType, workDays, underTimeTotalMinutes) {
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
var getCellValue2 = function (row, column, formulas, defVal = 0) {
    if(typeof column === 'string' || column instanceof String){
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
VuePayroll.mixin = {
    // Same-name data are overwritten
    computed: {

    },
    data: function () {
        return {
            formulas: {
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
                            return JSON.stringify({
                                days: t.renderedDays,
                                hrs: t.renderedHours,
                                mins: t.renderedMinutes,
                            })
                        }
                    },
                    {
                        uid: 'amountWorked',
                        getValue: function (row) {
                            if (row.type !== 1) return ''
                            return parseFloat(money.floatToAmount(
                                dtrHelper.amountWorked(_.get(row, 'employment.salary', 0), _.get(row, 'employment.salaryType'), _.get(row, 'timeRecord.totalMinutes', 0))
                            ))
                        }
                    },
                    {
                        uid: '5Premium',
                        getValue: function (row, formulas) {
                            if (row.type !== 1) return ''
                            var formula = formulas.find(f => f.uid === 'amountWorked')

                            return parseFloat(money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) * 0.05))
                        }
                    },
                    {
                        uid: 'grossPay',
                        getValue: function (row, formulas) {
                            if (row.type !== 1) return ''
                            var formula = formulas.find(f => f.uid === 'amountWorked')
                            var formula2 = formulas.find(f => f.uid === '5Premium')

                            return parseFloat(money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) +
                                _.invoke(formula2, 'getValue', row, formulas)))
                        }
                    },
                    {
                        uid: 'totalTax',
                        getValue: function (row, formulas) {
                            if (row.type !== 1) return ''
                            var cell1 = row.cells.find(c => c.columnUid === 'tax3')
                            var cell2 = row.cells.find(c => c.columnUid === 'tax10')

                            return parseFloat(money.floatToAmount(_.get(cell1, 'value', 0) +
                                _.get(cell2, 'value', 0)))
                        }
                    },
                    {
                        uid: 'totalSss',
                        getValue: function (row, formulas) {
                            if (row.type !== 1) return ''
                            var cell1 = row.cells.find(c => c.columnUid === 'contributionSss')
                            var cell2 = row.cells.find(c => c.columnUid === 'ecSss')

                            return parseFloat(money.floatToAmount(_.get(cell1, 'value', 0) +
                                _.get(cell2, 'value', 0)))
                        }
                    },
                    {
                        uid: 'totalDeductions',
                        getValue: function (row, formulas) {
                            if (row.type !== 1) return ''
                            var formula = formulas.find(f => f.uid === 'totalTax')
                            var formula2 = formulas.find(f => f.uid === 'totalSss')

                            return parseFloat(money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) +
                                _.invoke(formula2, 'getValue', row, formulas)))
                        }
                    },
                    {
                        uid: 'netPay',
                        getValue: function (row, formulas) {
                            if (row.type !== 1) return ''
                            var formula = formulas.find(f => f.uid === 'grossPay')
                            var formula2 = formulas.find(f => f.uid === 'totalDeductions')

                            return parseFloat(money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) -
                                _.invoke(formula2, 'getValue', row, formulas)))
                        }
                    },
                    {
                        uid: 'totalGrossPay',
                        getValue: (rows, formulas) => {
                            if (row.type !== 1) return ''
                            var formula = formulas.find(f => f.uid === 'grossPay')
                            var formula2 = formulas.find(f => f.uid === 'totalDeductions')

                            return parseFloat(money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) -
                                _.invoke(formula2, 'getValue', row, formulas)))
                        }
                    },
                ],
                permanent: [
                    {
                        uid: 'name',
                        getValue: function (row) {
                            var names = [_.get(row, 'employee.lastName', ''), _.get(row, 'employee.firstName', '')].filter(o => o !== '')
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
                            if (row.type !== 1) return ''
                            return 2000
                        }
                    },
                    {
                        uid: 'grossPayAllowance',
                        getValue: function (row, formulas) {
                            if (row.type !== 1) return ''
                            var formula = formulas.find(f => f.uid === 'basePay')
                            var formula2 = formulas.find(f => f.uid === 'peraAca')

                            return parseFloat(money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) +
                                _.invoke(formula2, 'getValue', row, formulas)))
                        }
                    },
                    {
                        uid: 'tardiness',
                        getValue: function (row, formulas) {
                            if (row.type !== 1) return ''
                            var me = this;
                            return parseFloat(money.floatToAmount(
                                dtrHelper.tardiness(_.get(row, 'employment.salary', 0), _.get(row, 'employment.salaryType'), 22, _.get(row, 'timeRecord.underTimeTotalMinutes', 0))
                            ))
                        }
                    },
                    {
                        uid: 'grossPay',
                        getValue: function (row, formulas) {
                            if (row.type !== 1) return ''
                            var formula = formulas.find(f => f.uid === 'grossPayAllowance')
                            var formula2 = formulas.find(f => f.uid === 'tardiness')

                            return parseFloat(money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) -
                                _.invoke(formula2, 'getValue', row, formulas)))
                        }
                    },
                    {
                        uid: 'rlipPs9',
                        getValue: function (row, formulas) {
                            if (row.type !== 1) return ''
                            var formula = formulas.find(f => f.uid === 'basePay')

                            return parseFloat(
                                money.floatToAmount(_.invoke(formula, 'getValue', row, formulas) * 0.09)
                            )
                        }
                    },
                    {
                        uid: 'totalMandatoryDeductions',
                        getValue: function (row, formulas) {
                            if (row.type !== 1) return ''
                            var v = []
                            v.push(getCellValue2(row, 'rlipPs9', formulas))
                            v.push(getCellValue2(row, 'emergencyLoan', formulas))
                            v.push(getCellValue2(row, 'eal', formulas))
                            v.push(getCellValue2(row, 'consoLoan', formulas))
                            v.push(getCellValue2(row, 'ouliPremium', formulas))
                            v.push(getCellValue2(row, 'policyOuliLoan', formulas))
                            v.push(getCellValue2(row, 'regularPolicyLoan', formulas))
                            v.push(getCellValue2(row, 'gfal', formulas))
                            v.push(getCellValue2(row, 'mpl', formulas))
                            v.push(getCellValue2(row, 'cpl', formulas))
                            v.push(getCellValue2(row, 'help', formulas))
                            v.push(getCellValue2(row, 'medicare', formulas))
                            v.push(getCellValue2(row, 'pagibigContribution', formulas))
                            v.push(getCellValue2(row, 'mplLoan', formulas))
                            v.push(getCellValue2(row, 'calamityLoan', formulas))
                            v.push(getCellValue2(row, 'withholdingTax', formulas))
                            return v.reduce((accum, current) => {
                                return accum + current;
                            }, 0)

                        }
                    },

                    {
                        uid: 'netAfterTotalMandatoryDeductions',
                        getValue: function (row, formulas) {
                            if (row.type !== 1) return ''
                            var v1 = getCellValue2(row, 'grossPay', formulas)
                            var v2 = getCellValue2(row, 'totalMandatoryDeductions', formulas)
                            return parseFloat(v1 - v2)
                        }
                    },
                    //
                    {
                        uid: 'totalNonMandatoryDeductions',
                        getValue: function (row, formulas) {
                            if (row.type !== 1) return ''
                            var v = []
                            v.push(getCellValue2(row, 'teachersScholars', formulas))
                            v.push(getCellValue2(row, 'ffaLoan', formulas))
                            v.push(getCellValue2(row, 'citySavingsBank', formulas))
                            return v.reduce((accum, current) => {
                                return accum + current;
                            }, 0)

                        }
                    },
                    {
                        uid: 'netPay',
                        getValue: function (row, formulas) {
                            if (row.type !== 1) return ''
                            var me = this
                            var v1 = getCellValue2(row, 'grossPay', formulas)
                            var v2 = getCellValue2(row, 'totalMandatoryDeductions', formulas)
                            var v3 = getCellValue2(row, 'totalNonMandatoryDeductions', formulas)
                            return parseFloat(v1 - (v2 + v3))
                        }
                    },

                ]
            }
        }
    },
    methods: {
        getCell: function (row, column) {
            return row.cells.find(function (c) {
                return c.columnUid === column.uid;
            });
        },
        getCellValue: getCellValue2,
        getSubTotal: function (columnUid, range) {
            var cell = {
                columnUid: columnUid,
                range: range
            }
            var me = this;
            let column = me.payroll.columns.find(function (c) {
                return c.uid === cell.columnUid;
            })
            if (!column) throw new Error('Cannot find column "' + cell.columnUid + '" in a subtotal row.');
            let start = _.get(cell, 'range[0]', 0)
            let length = _.get(cell, 'range[1]', me.payroll.rows.length)
            let values = me.payroll.rows.slice(start, length).filter(function (r) {
                return r.type === 1;
            }).map(function (row) {
                return getCellValue2(row, column, me.formulas[me.payroll.template])
            })
            return values.reduce((accum, current) => {
                return accum + current;
            }, 0)
        },
        
    }
}