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
        visibleColumns: function(column){
            return _.get(column, 'hidden', false) === false;
        },
        attendanceLink: function(row, payroll, rowIndex, columnIndex){
            try{
                return '/attendance/employment/' + row.employment._id + '?start=' + payroll.dateStart + '&end=' + payroll.dateEnd
            } catch (err) {
                console.warn(`Some props returned null at rowIndex,columnIndex: ${rowIndex},${columnIndex}:`)
                return `/attendance/employee/${_.get(row, 'employee._id','')}/employment/${_.get(row, 'employment._id')}?start=${_.get(payroll, 'dateStart')}&end=${_.get(payroll, 'dateEnd')}`

            }
        }
    }
}