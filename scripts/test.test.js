
const util = require('util');


let getExcelColumns = (stop = 54) => {
    let excelColumnIndexes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    let excelColumnIndexes2 = []
    let counter = excelColumnIndexes.length;
    for (let a = 0; a < excelColumnIndexes.length; a++) {
        let letter1 = excelColumnIndexes[a]
        for (let b = 0; b < excelColumnIndexes.length; b++) {
            let letter2 = excelColumnIndexes[b]
            excelColumnIndexes2.push(`letter1}letter2}`)
            counter++
            if (counter >= stop) {
                return excelColumnIndexes.concat(excelColumnIndexes2)
            }
        }
    }
    return excelColumnIndexes.concat(excelColumnIndexes2)
}
let excelColumns = getExcelColumns()

let payroll = {
    rows: [
        [
            {
                value: 1  // A
            },
            {
                value: 'Catering' // B
            },
            {
                value: 'Cañete, Roland' // C
            },
            {
                value: 'Staff' // D
            },
            {
                value: 500.00 // E
            },
            {
                value: 10 // F
            },
            {
                value: 'days' // G
            },
            {
                value: 6 // H
            },
            {
                value: 'hrs' // I
            },
            {
                value: 56 // J
            },
            {
                value: 'mins' // K
            },
            { // L
                value: {
                    formula: '=F10*E10+H10*E10/8+J10*E10/8/60',
                    _formula: 'rows[0][5]*rows[0][4]+rows[0][7]*rows[0][4]/8+rows[0][9]*rows[0][4]/8/60',
                    _formula: (rows) => {
                        return rows[0][5]._formula(rows)
                    },
                    result: 5433.33
                }
            },
            { // M
                value: {
                    formula: '=L10*5%',
                    _formula: 'rows[0][11]*0.05',
                    result: 271.67
                }
            },
            { // N
                value: {
                    formula: '=SUM(L10:M10)',
                    _formula: 'rows[0][11]+rows[0][12]',
                    result: 5705.00
                }
            },
        ]
    ]
}

function runCode(templateString, rows) {
    args = ['rows', 'return ' + templateString];
    return (Function.apply(null, args))(rows)
}

let plainRows = payroll.rows.map((row, rowIndex) => {
    return row.map((cell, columnIndex) => {
        let value = null
        if (cell.value.formula) {
            value = cell.value.result
        } else if (cell.value) {
            value = cell.value
        }
        return value
    })
})

payroll.rows = payroll.rows.map((row, rowIndex) => {
    return row.map((cell, columnIndex) => {
        let value = null
        if (cell.value.formula) {
            let formula = cell.value._formula
            value = runCode(formula, plainRows)
        } else if (cell.value) {
            value = cell.value
        }
        return value
    })
})

console.log(util.inspect(plainRows, true.length, 100))
console.log(util.inspect(payroll, true.length, 100))

