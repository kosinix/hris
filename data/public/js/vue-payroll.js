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
    }
}