//// Core modules

//// External modules

//// Modules

let _cosStaffColumns = [
    {
        uid: 'fundSource',
        title: 'Fund',
        computed: true,
    },
    {
        uid: 'name',
        title: 'Name',
        computed: true,
    },
    {
        uid: 'position',
        title: 'Position',
        computed: true,
    },
    {
        uid: 'basePay',
        title: 'Salary',
        computed: true,
    },
    {
        uid: 'attendance',
        title: 'Time worked',
        computed: true,
    },
    {
        uid: 'amountWorked',
        title: 'Gross Pay',
        computed: true,
    },
    {
        uid: '5Premium',
        title: '5% Premium',
        computed: true,
    },
    {
        uid: 'grossPay',
        title: 'Total',
        computed: true,
    },
    {
        uid: 'tax3',
        title: '3% Tax',
        computed: false,
    },
    {
        uid: 'tax10',
        title: '10% Tax',
        computed: false,
    },
    {
        uid: 'totalTax',
        title: 'Total Tax',
        computed: true,
    },
    {
        uid: 'contributionSss',
        title: 'Contribution',
        computed: false,
    },
    {
        uid: 'ecSss',
        title: 'EC',
        computed: false,
    },
    {
        uid: 'totalSss',
        title: 'Total SSS',
        computed: true,
    },
    {
        uid: 'totalDeductions',
        title: 'Total Deductions',
        computed: true,
    },
    {
        uid: 'netPay',
        title: 'Net Amnt ',
        computed: true,
    },
]

// row.name = 'Grand Total >>>>'
let _cosStaffColumnsGrandTotal = [
    {},
    {},
    {},
    {},
    {},
    {
        uid: 'amountWorked',
        title: 'Gross Pay',
        computed: true,
    },
    {
        uid: '5Premium',
        title: '5% Premium',
        computed: true,
    },
    {
        uid: 'grossPay',
        title: 'Total',
        computed: true,
    },
    {
        uid: 'tax3',
        title: '3% Tax',
        computed: false,
    },
    {
        uid: 'tax10',
        title: '10% Tax',
        computed: false,
    },
    {
        uid: 'totalTax',
        title: 'Total Tax',
        computed: true,
    },
    {
        uid: 'contributionSss',
        title: 'Contribution',
        computed: false,
    },
    {
        uid: 'ecSss',
        title: 'EC',
        computed: false,
    },
    {
        uid: 'totalSss',
        title: 'Total SSS',
        computed: true,
    },
    {
        uid: 'totalDeductions',
        title: 'Total Deductions',
        computed: true,
    },
    {
        uid: 'netPay',
        title: 'Net Amnt ',
        computed: true,
    },
]

let getColumns = (template) => {
    let columns = []
    if(template === 'cos_staff'){
        columns = _cosStaffColumns
    } else {
        throw new Error(`Template "${template}" not found.`)
    }
    return columns
}
let getColumnsGrandTotal = (template) => {
    let columns = []
    if(template === 'cos_staff'){
        columns = _cosStaffColumnsGrandTotal
    } else {
        throw new Error(`Template "${template}" not found.`)
    }
    return columns
}

module.exports = {
    getColumns: getColumns,
    getColumnsGrandTotal: getColumnsGrandTotal,
}