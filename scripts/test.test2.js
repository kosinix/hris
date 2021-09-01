const { extend } = require("lodash")

let payroll = {
    rows: [
        {
            type: 3, // 0
        },
        {
            type: 1, // 1
        },
        {
            type: 1, // 2
        },
        {
            type: 2, // 3
        },
        {
            type: 2, // 4
        },
    ]
}


let rowIndex = -5


console.log(rowIndex, payroll.rows.length)
if(rowIndex > payroll.rows.length - 1) throw new Error('Out of bounds.')
let start = 0

// Start from before current row
// Until a non row.type === 1 is found
for (let y = rowIndex - 1; y >= 0; y--) {
    let row = payroll.rows[y]
    console.log(y, row)
    if (row.type !== 1) {
        start = y + 1
        break
    }
}
let end = rowIndex // rowIndex - 1 is actual end index

console.log(start, end)
console.log(payroll.rows.slice(start, end))