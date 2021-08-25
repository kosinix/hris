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
        getSubTotal: function (columnUid, range) {
            var cell = {
                columnUid: columnUid,
                range: range
            }
            var me = this;
            let column = me.payroll.columns.find(function (c) {
                return c.uid === cell.columnUid;
            })
            if (!column) {
                console.log('Cannot find column "' + cell.columnUid + '" in a subtotal row.');
                return 0;
            }
            let start = _.get(cell, 'range[0]', 0)
            let length = _.get(cell, 'range[1]', me.payroll.rows.length)
            let values = me.payroll.rows.slice(start, length).filter(function (r) {
                return r.type === 1;
            }).map(function (row) {
                return getCellValue(row, column, me.formulas[me.payroll.template])
            })
            return values.reduce(function (accum, current) {
                return accum + current;
            }, 0)
        }

    }
}