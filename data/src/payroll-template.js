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
    // {
    //     uid: '5Premium',
    //     title: '5% Premium',
    //     computed: true,
    // },
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

let _permanentColumns = [
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
        uid: 'peraAca',
        title: 'Allowance PERA/ACA',
        computed: true,
    },
    {
        uid: 'grossPayAllowance',
        title: 'Total',
        computed: true,
    },
    {
        uid: 'tardiness',
        title: 'Less: Late/Tardiness',
        computed: true,
    },
    {
        uid: 'grossPayPermanent',
        title: 'Grant Total',
        computed: true,
    },
    {
        uid: 'rlipPs9',
        title: 'RLIP PS 9%',
        computed: true,
    },
    // 
    {
        uid: 'emergencyLoan',
        title: 'Emergency Loan',
        computed: false,
    },
    {
        uid: 'eal',
        title: 'EAL',
        computed: false,
    },
    {
        uid: 'consoLoan',
        title: 'CONSO LOAN',
        computed: false,
    },
    {
        uid: 'ouliPremium',
        title: 'OULI Premium',
        computed: false,
    },
    {
        uid: 'policyOuliLoan',
        title: 'Policy OULI Loan',
        computed: false,
    },
    {
        uid: 'regularPolicyLoan',
        title: 'Regular Policy Loan',
        computed: false,
    },
    {
        uid: 'gfal',
        title: 'GFAL',
        computed: false,
    },
    {
        uid: 'mpl',
        title: 'MPL',
        computed: false,
    },
    {
        uid: 'cpl',
        title: 'CPL',
        computed: false,
    },
    {
        uid: 'help',
        title: 'HELP',
        computed: false,
    },
    {
        uid: 'medicare',
        title: 'Medicare',
        computed: false,
    },
    {
        uid: 'pagibigContribution',
        title: 'PAGIBIG Contribution',
        computed: false,
    },
    {
        uid: 'mplLoan',
        title: 'MPL Loan',
        computed: false,
    },
    {
        uid: 'calamityLoan',
        title: 'Calamity Loan',
        computed: false,
    },
    {
        uid: 'withholdingTax',
        title: 'Withholding Tax',
        computed: false,
    },
    // //
    {
        uid: 'totalMandatoryDeductions',
        title: 'Total Mandatory Deductions',
        computed: true,
    },
    {
        uid: 'netAfterTotalMandatoryDeductions',
        title: 'Net Amount After Deductions',
        computed: true,
    },
    // //
    {
        uid: 'teachersScholars',
        title: 'Teachers Scholars',
        computed: false,
    },
    {
        uid: 'ffaLoan',
        title: 'FFA Loan and Others',
        computed: false,
    },
    {
        uid: 'citySavingsBank',
        title: 'City Savings Bank',
        computed: false,
    },
    // //
    {
        uid: 'totalNonMandatoryDeductions',
        title: 'Total Non-Mandatory Deductions',
        computed: true,
    },
    {
        uid: 'netPayPermanent',
        title: 'Net Amnt ',
        computed: true,
    },
    /////
    {
        uid: 'firstQuincena',
        title: '1st Quincena',
        computed: false,
        hidden: true,
    },
    {
        uid: 'secondQuincena',
        title: '2nd Quincena',
        computed: false,
        hidden: true,
    },
]

let getColumns = (template) => {
    let columns = []
    if (template === 'cos_staff') {
        columns = _cosStaffColumns
    } else if (template === 'permanent') {
        columns = _permanentColumns
    } else {
        throw new Error(`Template "${template}" not found.`)
    }
    return columns
}

module.exports = {
    getColumns: getColumns,
}