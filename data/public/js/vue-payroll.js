// Define a new component
if (typeof VuePayroll === 'undefined') {
    function VuePayroll() { } // Goes to window.VuePayroll
}

VuePayroll.mixin = {
    // Same-name data are overwritten
    computed: {

    },
    data: function () {
        return {
            formulas: formulas
        }
    },
    methods: {
        getCell: function (row, column) {
            return row.cells.find(function (c) {
                return c.columnUid === column.uid;
            });
        },
        getCellValue: getCellValue,
        getSubTotal: getSubTotal,
        getGrandTotal: getGrandTotal,
        getSubTotal2: function (cell, rowIndex) {
            if (!cell) {
                return ''
            }

            var me = this;
            let column = me.payroll.columns.find(function (c) {
                return c.uid === cell.columnUid;
            })
            if (!column) {
                console.log('Cannot find column "' + cell.columnUid + '" in a subtotal row.');
                return 0;
            }

            if (rowIndex > me.payroll.rows.length - 1) throw new Error('Out of bounds.')


            let start = 0
            // Start from before current row
            // Until a non row.type === 1 is found
            for (let y = rowIndex - 1; y >= 0; y--) {
                let row = me.payroll.rows[y]
                if (row.type !== 1) {
                    start = y + 1
                    break
                }
            }
            let end = rowIndex // rowIndex - 1 is actual end index

            let values = me.payroll.rows.slice(start, end).filter(function (row) {
                return row.type === 1;
            }).map(function (row) {
                return getCellValue(row, column, me.formulas[me.payroll.template]);
            })
            return values.reduce(function (accum, current) {
                return accum + current;
            }, 0)
        }

    }
}