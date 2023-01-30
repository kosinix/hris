//// Core modules
const util = require('util');

//// External modules
const ExcelJS = require('exceljs');
const lodash = require('lodash')
const moment = require('moment')
const money = require('money-math')

//// Modules
const payrollJs = require('../public/js/payroll');

class Slex {
    workbook
    sheet
    cell
    constructor(workbook) {
        this.workbook = workbook;
    }
    setSheet(sheet) {
        this.sheet = sheet
        return this
    }
    mergeCells(range) {
        this.sheet.mergeCells(range)
        let cells = range.split(':')
        this.getCell(cells[0])
        return this
    }
    setCell(cell) {
        this.cell = cell
        return this
    }
    getCell(cell) {
        this.cell = this.sheet.getCell(cell)
        return this
    }
    value(s) {
        this.cell.value = s
        return this
    }
    numFmt(s) {
        this.cell.numFmt = s
        return this
    }
    align(pos) {
        if (['top', 'middle', 'bottom'].includes(pos)) {
            lodash.set(this, 'cell.alignment.vertical', pos)
        }
        if (['left', 'center', 'right'].includes(pos)) {
            lodash.set(this, 'cell.alignment.horizontal', pos)
        }
        return this
    }
    wrapText(s) {
        lodash.set(this, 'cell.alignment.wrapText', s)
        return this
    }
    font(s) {
        lodash.set(this, 'cell.font.name', s)
        return this
    }
    fontSize(s) {
        lodash.set(this, 'cell.font.size', s)
        return this
    }
    fontColor(s) {
        lodash.set(this, 'cell.font.color.argb', s)
        return this
    }
    bold(s) {
        lodash.set(this, 'cell.font.bold', s)
        return this
    }
    italic(s) {
        lodash.set(this, 'cell.font.italic', s)
        return this
    }
    underline(s) {
        lodash.set(this, 'cell.font.underline', s)
        return this
    }
    bgFill(s) {
        lodash.set(this, 'cell.fill', {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: s }
        })

        return this
    }
    border(t, r, b, l) {
        if (t && r === undefined && b === undefined && l === undefined) {
            lodash.set(this, 'cell.border.top.style', t)
            lodash.set(this, 'cell.border.right.style', t)
            lodash.set(this, 'cell.border.bottom.style', t)
            lodash.set(this, 'cell.border.left.style', t)
            return this
        }
        if (t) {
            lodash.set(this, 'cell.border.top.style', t)
        }
        if (r) {
            lodash.set(this, 'cell.border.right.style', r)
        }
        if (b) {
            lodash.set(this, 'cell.border.bottom.style', b)
        }
        if (l) {
            lodash.set(this, 'cell.border.left.style', l)
        }
        return this
    }
}

let rowAdditions = (activeRowIndexes, letter) => {
    let references = activeRowIndexes.map((o) => {
        return `${letter}${o}`
    })
    return references.join('+')
}

let templateCos = async (payroll) => {
    let workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(`${CONFIG.app.dirs.view}/payroll/template_cos_staff.xlsx`);
    let slex = new Slex(workbook)

    let worksheet = await workbook.getWorksheet('igp')

    let startRowIndex = 9

    if (worksheet) {

        // Set Print Area for a sheet
        worksheet.pageSetup.printArea = `A1:Y${startRowIndex + payroll.rows.length + 12}`;

        slex.setSheet(worksheet)

        let rowCount = payroll.rows.length
        // let rowCount = payroll.rows.filter(r => r.type === 1).length

        worksheet.duplicateRow(startRowIndex, rowCount - 1, true);

        slex.getCell('A2')
            .value(`Salary for the period ${moment(payroll.dateStart).format('MMMM DD')} - ${moment(payroll.dateEnd).format('DD, YYYY')}`)

        let numbering = 0
        payroll.rows.forEach((row, rowIndex) => {

            let curRowIndex = startRowIndex + rowIndex
            let wsRow = worksheet.getRow(curRowIndex)

            if (row.type === 3) {

                wsRow.eachCell(function (cell, colNumber) {
                    cell.value = ''
                });

                slex.mergeCells(`A${curRowIndex}:B${curRowIndex}`)
                    .value(row.name)

            } else if (row.type === 1) {

                numbering++
                let attendance = payrollJs.getCellValue(row, 'attendance', payrollJs.formulas, payroll.columns)

                //=F10*E10+H10*E10/8+J10*E10/8/60
                let amount = payrollJs.amountWorked(lodash.get(row, 'employment.salary', 0), lodash.get(row, 'employment.salaryType', 0), lodash.get(row, 'timeRecord.totalMinutes', 0))

                slex.getCell(`A${curRowIndex}`)
                    .value(numbering)
                    .getCell(`B${curRowIndex}`)
                    .value(payrollJs.getCellValue(row, 'fundSource', payrollJs.formulas, payroll.columns))
                    .getCell(`C${curRowIndex}`)
                    .value(payrollJs.getCellValue(row, 'name', payrollJs.formulas, payroll.columns))
                    .getCell(`D${curRowIndex}`)
                    .value(payrollJs.getCellValue(row, 'position', payrollJs.formulas, payroll.columns))
                    .getCell(`E${curRowIndex}`)
                    .value(payrollJs.getCellValue(row, 'basePay', payrollJs.formulas, payroll.columns))
                    .getCell(`F${curRowIndex}`)
                    .value(attendance.days)
                    .getCell(`H${curRowIndex}`)
                    .value(attendance.hrs)
                    .getCell(`J${curRowIndex}`)
                    .value(attendance.mins)
                    .getCell(`L${curRowIndex}`)
                    .value({
                        formula: `=F${curRowIndex}*E${curRowIndex}+H${curRowIndex}*E${curRowIndex}/8+J${curRowIndex}*E${curRowIndex}/8/60`,
                        result: parseFloat(amount.toFixed(2))
                    })
                    .getCell(`M${curRowIndex}`)
                    .value({
                        formula: `=L${curRowIndex}*0.05`,
                        result: payrollJs.getCellValue(row, '5Premium', payrollJs.formulas, payroll.columns)
                    })
                    .getCell(`N${curRowIndex}`)
                    .value({
                        formula: `=SUM(L${curRowIndex}:M${curRowIndex})`,
                        result: payrollJs.getCellValue(row, 'grossPay', payrollJs.formulas, payroll.columns)
                    })
                    .getCell(`O${curRowIndex}`)
                    .value(payrollJs.getCellValue(row, 'tax3', payrollJs.formulas, payroll.columns))
                    .getCell(`P${curRowIndex}`)
                    .value(payrollJs.getCellValue(row, 'tax10', payrollJs.formulas, payroll.columns))
                    .getCell(`Q${curRowIndex}`)
                    .value({
                        formula: `=SUM(O${curRowIndex}:P${curRowIndex})`,
                        result: payrollJs.getCellValue(row, 'totalTax', payrollJs.formulas, payroll.columns)
                    })
                    .getCell(`R${curRowIndex}`)
                    .value(payrollJs.getCellValue(row, 'contributionSss', payrollJs.formulas, payroll.columns))
                    .getCell(`S${curRowIndex}`)
                    .value(payrollJs.getCellValue(row, 'ecSss', payrollJs.formulas, payroll.columns))
                    .getCell(`T${curRowIndex}`)
                    .value({
                        formula: `=SUM(R${curRowIndex}:S${curRowIndex})`,
                        result: payrollJs.getCellValue(row, 'totalSss', payrollJs.formulas, payroll.columns)
                    })
                    .getCell(`U${curRowIndex}`)
                    .value({
                        formula: `=Q${curRowIndex}+T${curRowIndex}`,
                        result: payrollJs.getCellValue(row, 'totalDeductions', payrollJs.formulas, payroll.columns)
                    })
                    .getCell(`V${curRowIndex}`)
                    .value({
                        formula: `=N${curRowIndex}+U${curRowIndex}`,
                        result: payrollJs.getCellValue(row, 'netPay', payrollJs.formulas, payroll.columns)
                    })
                    .getCell(`W${curRowIndex}`)
                    .value({
                        formula: `=A${curRowIndex}`,
                        result: numbering
                    })

            } else if (row.type === 2) {
                wsRow.eachCell(function (cell, colNumber) {
                    cell.value = ''
                });
                try {
                    worksheet.unMergeCells(`A${curRowIndex}:K${curRowIndex}`)
                    worksheet.mergeCells(`A${curRowIndex}:K${curRowIndex}`)
                } catch (err) { }
                worksheet.getCell(`A${curRowIndex}`).font = {
                    name: 'Arial',
                    size: 12,
                    bold: true,
                }
                worksheet.getCell(`A${curRowIndex}`).alignment = {
                    horizontal: 'left'
                }
                worksheet.getCell(`A${curRowIndex}`).value = 'Subtotal'

                let start = 0
                // Start from current row and move backwards
                // Until a non row.type === 1 is found
                for (let y = rowIndex - 1; y >= 0; y--) {
                    let row = payroll.rows[y]
                    if (row.type !== 1) {
                        start = y + 1
                        break
                    }
                }
                let end = rowIndex // rowIndex - 1 is actual end index because of Array.slice

                let activeRowIndexes = []
                // Start first row until grand total row.
                // Compile all rows that are type 1
                for (let y = start; y < end; y++) {
                    let row = payroll.rows[y]
                    if (row.type === 1) {
                        activeRowIndexes.push(y + startRowIndex)
                    }
                }

                // account for excel data row starting index
                let range = [start + startRowIndex, end + startRowIndex]

                slex.getCell(`L${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'L')}`,
                        result: payrollJs.getSubTotal('amountWorked', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`M${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'M')}`,
                        result: payrollJs.getSubTotal('5Premium', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`N${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'N')}`,
                        result: payrollJs.getSubTotal('grossPay', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`O${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'O')}`,
                        result: payrollJs.getSubTotal('tax3', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`P${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'P')}`,
                        result: payrollJs.getSubTotal('tax10', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`Q${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'Q')}`,
                        result: payrollJs.getSubTotal('totalTax', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`R${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'R')}`,
                        result: payrollJs.getSubTotal('contributionSss', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`S${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'S')}`,
                        result: payrollJs.getSubTotal('ecSss', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`T${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'T')}`,
                        result: payrollJs.getSubTotal('totalSss', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`U${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'U')}`,
                        result: payrollJs.getSubTotal('totalDeductions', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`V${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'V')}`,
                        result: payrollJs.getSubTotal('netPay', rowIndex, payroll, payrollJs.formulas)
                    })
            } else if (row.type === 4) {
                wsRow.eachCell(function (cell, colNumber) {
                    cell.value = ''
                });
                try {
                    worksheet.unMergeCells(`A${curRowIndex}:K${curRowIndex}`)
                    worksheet.mergeCells(`A${curRowIndex}:K${curRowIndex}`)
                } catch (err) { }
                worksheet.getCell(`A${curRowIndex}`).font = {
                    name: 'Arial',
                    size: 12,
                    bold: true,
                }
                worksheet.getCell(`A${curRowIndex}`).alignment = {
                    horizontal: 'left'
                }
                worksheet.getCell(`A${curRowIndex}`).value = 'GRAND TOTAL > > > > > >'

                let start = 0
                let end = rowIndex

                let activeRowIndexes = []
                // Start first row until grand total row.
                // Compile all rows that are type 1
                for (let y = start; y < end; y++) {
                    let row = payroll.rows[y]
                    if (row.type === 1) {
                        activeRowIndexes.push(y + startRowIndex)
                    }
                }

                // account for excel data row starting index
                let range = [start + startRowIndex, end + startRowIndex]

                slex.getCell(`L${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'L')}`,
                        result: payrollJs.getGrandTotal('amountWorked', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`M${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'M')}`,
                        result: payrollJs.getGrandTotal('5Premium', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`N${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'N')}`,
                        result: payrollJs.getGrandTotal('grossPay', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`O${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'O')}`,
                        result: payrollJs.getGrandTotal('tax3', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`P${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'P')}`,
                        result: payrollJs.getGrandTotal('tax10', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`Q${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'Q')}`,
                        result: payrollJs.getGrandTotal('totalTax', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`R${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'R')}`,
                        result: payrollJs.getGrandTotal('contributionSss', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`S${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'S')}`,
                        result: payrollJs.getGrandTotal('ecSss', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`T${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'T')}`,
                        result: payrollJs.getGrandTotal('totalSss', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`U${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'U')}`,
                        result: payrollJs.getGrandTotal('totalDeductions', rowIndex, payroll, payrollJs.formulas)
                    })
                slex.getCell(`V${curRowIndex}`)
                    .value({
                        formula: `=${rowAdditions(activeRowIndexes, 'V')}`,
                        result: payrollJs.getGrandTotal('netPay', rowIndex, payroll, payrollJs.formulas)
                    })
            }
        })
    }

    return workbook
}

let templateHdf = async (healthDeclarations) => {
    let row = null
    let cell = null
    let chk = null
    let chk2 = null
    let value = null
    let colors = {
        black: { argb: '00000000' }
    }

    const workbook = new ExcelJS.Workbook();
    let sheet = workbook.addWorksheet('hdf');
    sheet.views = [
        { zoomScale: 100 }
    ];

    sheet.pageSetup.printArea = 'A1:N61';
    sheet.pageSetup.fitToPage = true
    sheet.pageSetup.paperSize = 9 // A4
    sheet.pageSetup.margins = {
        left: 0.15, right: 0,
        top: 0.25, bottom: 0.12,
        header: 0.24, footer: 0.12
    };

    let slex = new Slex(workbook)
    slex.setSheet(sheet)

    slex.getCell('A1').value(`Last Name`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('B1').value(`First Name`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('C1').value(`Age`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('D1').value(`Sex`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('E1').value(`Civil Status`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('F1').value(`Address`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('G1').value(`Contact`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('H1').value(`Department`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('I1').value(`Temp`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('J1').value(`Symptoms`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('K1').value(`Visited Med. Facility`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('L1').value(`Visit Details`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('M1').value(`Suspected COVID Patient`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('N1').value(`Date/Place`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('O1').value(`Sick Family Member`).align('top').align('left').font('Calibri').fontSize(11).bold(true)
    slex.getCell('P1').value(`Details`).align('top').align('left').font('Calibri').fontSize(11).bold(true)


    offset = 2
    for (x = 0; x < healthDeclarations.length; x++) {
        let hdf = healthDeclarations[x]

        row = offset + x
        slex.getCell(`A${row}`)
            .value(`${hdf.data.ln}`).align('middle').align('left').font('Calibri').fontSize(11)

        slex.getCell(`B${row}`)
            .value(`${hdf.data.fn}`).align('middle').align('left').font('Calibri').fontSize(11)

        slex.getCell(`C${row}`)
            .value(`${hdf.data.age}`).align('middle').align('left').font('Calibri').fontSize(11)

        slex.getCell(`D${row}`)
            .value(`${hdf.data.sex}`).align('middle').align('left').font('Calibri').fontSize(11)

        slex.getCell(`E${row}`)
            .value(`${hdf.data.cs}`).align('middle').align('left').font('Calibri').fontSize(11)

        slex.getCell(`F${row}`)
            .value(`${hdf.data.adr}`).align('middle').align('left').font('Calibri').fontSize(11)

        slex.getCell(`G${row}`)
            .value(`${hdf.data.cnt}`).align('middle').align('left').font('Calibri').fontSize(11)

        slex.getCell(`H${row}`)
            .value(`${hdf.data.dep}`).align('middle').align('left').font('Calibri').fontSize(11)

        slex.getCell(`I${row}`)
            .value(`${hdf.data.tmp}`).align('middle').align('left').font('Calibri').fontSize(11)

        slex.getCell(`J${row}`)
            .value(`${lodash.get(hdf, 'data.sym', []).join(', ')}`).align('middle').align('left').font('Calibri').fontSize(11)

        slex.getCell(`K${row}`)
            .value(`${hdf.data.vmf}`).align('middle').align('left').font('Calibri').fontSize(11)
        slex.getCell(`L${row}`)
            .value(`${lodash.get(hdf, 'data.vmp', []).join(', ')}`).align('middle').align('left').font('Calibri').fontSize(11)
        slex.getCell(`M${row}`)
            .value(`${hdf.data.sus}`).align('middle').align('left').font('Calibri').fontSize(11)
        slex.getCell(`N${row}`)
            .value(`${hdf.data.sud}`).align('middle').align('left').font('Calibri').fontSize(11)
        slex.getCell(`O${row}`)
            .value(`${hdf.data.sfm}`).align('middle').align('left').font('Calibri').fontSize(11)
        slex.getCell(`P${row}`)
            .value(`${hdf.data.sfd}`).align('middle').align('left').font('Calibri').fontSize(11)

    }

    return workbook

}

let toPDSDate = (date) => {
    if(date) {
        return moment(date).format('MM/DD/YYYY')
    }
    return ''
}
let templatePds = async (employee) => {
    let tmpVar = null
    let value = null
    let chk = ''
    let chk2 = ''
    let colors = {
        black: { argb: '00000000' }
    }
    let workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(`${CONFIG.app.dirs.view}/e-profile/pds.xlsx`);
    let slex = new Slex(workbook)
    
    let worksheet = workbook.getWorksheet('C1')
    if (worksheet) {
        slex.setSheet(worksheet)
        slex.getCell('D10').value(`${lodash.get(employee, 'lastName', '')}`)
        slex.getCell('D11').value(`${lodash.get(employee, 'firstName', '')}`)
        slex.getCell('L11').value({
            'richText': [
                { 'font': { 'size': 7, 'color': colors.black, 'name': 'Arial Narrow', 'family': 2, 'scheme': 'none' }, 'text': 'NAME EXTENSION (JR., SR)' },
                { 'font': { 'bold': true, 'size': 11, 'color': colors.black, 'name': 'Arial', 'scheme': 'none' }, 'text': ` ${lodash.get(employee, 'suffix', '')}` },
            ]
        })
        slex.getCell('D12').value(`${lodash.get(employee, 'middleName', '')}`)

        value = lodash.get(employee, 'birthDate', '')
        tmpVar = (value) ? moment(value).format('MM/DD/YYYY') : ''
        slex.getCell('D13').value(`${tmpVar}`)

        value = lodash.get(employee, 'personal.citizenship', [])
        tmpVar = (value.includes('filipino')) ? `[✓] Filipino` : `[${'     '}] Filipino`
        slex.getCell('J13').value(tmpVar)

        value = lodash.get(employee, 'personal.citizenship', [])
        tmpVar = (value.includes('dual')) ? `[✓] Dual Citizenship` : `[${'     '}] Dual Citizenship`
        slex.getCell('L13').value(tmpVar)

        value = lodash.get(employee, 'personal.citizenshipSource', [])
        chk = (value.includes('birth')) ? `✓` : '     '
        chk2 = (value.includes('naturalization')) ? `✓` : '     '
        slex.getCell('L14').value(`[${chk}] by Birth      [${chk2}] by Naturalization`)

        value = lodash.get(employee, 'personal.citizenship', [])
        tmpVar = (value.includes('dual')) ? lodash.get(employee, 'personal.citizenshipCountry', '') : '     '
        slex.getCell('J16').value(tmpVar)

        tmpVar = lodash.get(employee, 'personal.birthPlace', '')
        slex.getCell('D15').value(tmpVar)

        // gender
        value = lodash.get(employee, 'gender', '')

        tmpVar = (value === 'M') ? `[✓] Male` : `[${'     '}] Male`
        slex.getCell('D16').value(tmpVar)

        tmpVar = (value === 'F') ? `[✓] Female` : `[${'     '}] Female`
        slex.getCell('E16').value(tmpVar)


        // civilStatus
        value = lodash.get(employee, 'civilStatus', '')

        tmpVar = (value === 'Single') ? `[✓] Single` : `[${'     '}] Single`
        slex.getCell('D17').value(tmpVar)

        tmpVar = (value === 'Married') ? `[✓] Married` : `[${'     '}] Married`
        slex.getCell('E17').value(tmpVar)

        tmpVar = (value === 'Widowed') ? `[✓] Widowed` : `[${'     '}] Widowed`
        slex.getCell('D18').value(tmpVar)

        tmpVar = (value === 'Separated') ? `[✓] Separated` : `[${'     '}] Separated`
        slex.getCell('E18').value(tmpVar)

        tmpVar = (value === 'Others') ? `[✓] Others` : `[${'     '}] Others`
        slex.getCell('D19').value(tmpVar)

        // residential addr
        value = lodash.get(employee, 'addresses[1].unit', '')
        slex.getCell('I17').value(value)

        value = lodash.get(employee, 'addresses[1].street', '')
        slex.getCell('L17').value(value)

        value = lodash.get(employee, 'addresses[1].village', '')
        slex.getCell('I19').value(value)

        value = lodash.get(employee, 'addresses[1].brgy', '')
        slex.getCell('L19').value(value)

        value = lodash.get(employee, 'addresses[1].cityMun', '')
        slex.getCell('I22').value(value)

        value = lodash.get(employee, 'addresses[1].province', '')
        slex.getCell('L22').value(value)

        value = lodash.get(employee, 'addresses[1].zipCode', '')
        slex.getCell('I24').value(value)


        // residential addr
        value = lodash.get(employee, 'addresses[0].unit', '')
        slex.getCell('I25').value(value)

        value = lodash.get(employee, 'addresses[0].street', '')
        slex.getCell('L25').value(value)

        value = lodash.get(employee, 'addresses[0].village', '')
        slex.getCell('I27').value(value)

        value = lodash.get(employee, 'addresses[0].brgy', '')
        slex.getCell('L27').value(value)

        value = lodash.get(employee, 'addresses[0].cityMun', '')
        slex.getCell('I29').value(value)

        value = lodash.get(employee, 'addresses[0].province', '')
        slex.getCell('L29').value(value)

        value = lodash.get(employee, 'addresses[0].zipCode', '')
        slex.getCell('I31').value(value)

        // height
        value = lodash.get(employee, 'personal.height', '')
        value = (value > 0) ? value : ''
        slex.getCell('D22').value(value)

        // weight
        value = lodash.get(employee, 'personal.weight', '')
        slex.getCell('D24').value(value)

        // blood
        value = lodash.get(employee, 'personal.bloodType', '')
        slex.getCell('D25').value(value)

        // gsis
        value = lodash.get(employee, 'personal.gsis', '')
        slex.getCell('D27').value(value)

        // pagibig
        value = lodash.get(employee, 'personal.pagibig', '')
        slex.getCell('D29').value(value)

        // philhealth
        value = lodash.get(employee, 'personal.philHealth', '')
        slex.getCell('D31').value(value)

        // sss
        value = lodash.get(employee, 'personal.sss', '')
        slex.getCell('D32').value(value)

        // tin
        value = lodash.get(employee, 'personal.tin', '')
        slex.getCell('D33').value(value)

        // agencyEmployeeNumber
        value = lodash.get(employee, 'personal.agencyEmployeeNumber', '')
        slex.getCell('D34').value(value)

        // phoneNumber
        value = lodash.get(employee, 'phoneNumber', '')
        slex.getCell('I32').value(value)

        // mobile
        value = lodash.get(employee, 'mobileNumber', '')
        slex.getCell('I33').value(value)

        // email
        value = lodash.get(employee, 'email', '')
        slex.getCell('I34').value(value)

        // II. FAMILY

        // spouse
        value = lodash.get(employee, 'personal.spouse.lastName', '')
        slex.getCell('D36').value(value)

        value = lodash.get(employee, 'personal.spouse.firstName', '')
        slex.getCell('D37').value(value)

        slex.getCell('G37').value({
            'richText': [
                { 'font': { 'size': 7, 'color': colors.black, 'name': 'Arial Narrow', 'family': 2, 'scheme': 'none' }, 'text': 'NAME EXTENSION (JR., SR)' },
                { 'font': { 'bold': true, 'size': 9, 'color': colors.black, 'name': 'Arial', 'scheme': 'none' }, 'text': `\n${lodash.get(employee, 'personal.spouse.suffix', '')}` },
            ]
        })

        value = lodash.get(employee, 'personal.spouse.middleName', '')
        slex.getCell('D38').value(value)

        value = lodash.get(employee, 'personal.spouse.occupation', '')
        slex.getCell('D39').value(value)

        value = lodash.get(employee, 'personal.spouse.employerOrBusinessName', '')
        slex.getCell('D40').value(value)

        value = lodash.get(employee, 'personal.spouse.businessAddress', '')
        slex.getCell('D41').value(value)

        value = lodash.get(employee, 'personal.spouse.phone', '')
        slex.getCell('D42').value(value)

        // children
        let offset = 37
        for (x = 0; x < 12; x++) {
            let child = lodash.get(employee, `personal.children[${x}]`)
            let name = lodash.get(child, `name`, '')
            let birthDate = lodash.get(child, `birthDate`, '')

            if (birthDate) {
                birthDate = moment(birthDate).format('MM/DD/YYYY')
            }
            row = offset + x
            slex.getCell(`I${row}`).value(name)
            slex.getCell(`M${row}`).value(birthDate)
        }

        // father
        value = lodash.get(employee, 'personal.father.lastName', '')
        slex.getCell('D43').value(value)

        value = lodash.get(employee, 'personal.father.firstName', '')
        slex.getCell('D44').value(value)

        slex.getCell('G44').value({
            'richText': [
                { 'font': { 'size': 7, 'color': colors.black, 'name': 'Arial Narrow', 'family': 2, 'scheme': 'none' }, 'text': 'NAME EXTENSION (JR., SR)' },
                { 'font': { 'bold': true, 'size': 9, 'color': colors.black, 'name': 'Arial', 'scheme': 'none' }, 'text': `\n${lodash.get(employee, 'personal.father.suffix', '')}` },
            ]
        })

        value = lodash.get(employee, 'personal.father.middleName', '')
        slex.getCell('D45').value(value)

        // mother
        value = lodash.get(employee, 'personal.mother.lastName', '')
        slex.getCell('D47').value(value)

        value = lodash.get(employee, 'personal.mother.firstName', '')
        slex.getCell('D48').value(value)

        value = lodash.get(employee, 'personal.mother.middleName', '')
        slex.getCell('D49').value(value)

        // III. EDUCATION
        for (let x = 0; x < 5; x++) {
            let school = lodash.get(employee, `personal.schools[${x}]`, { name: '', periodFrom: '', periodTo: '', unitsEarned: '', yearGraduated: '', honors: '' })
            let rowY = 0
            if (lodash.get(school, 'level') === 'Elementary') {
                rowY = 54
            } else if (lodash.get(school, 'level') === 'Secondary') {
                rowY = 55
            } else if (lodash.get(school, 'level') === 'Vocational') {
                rowY = 56
            } else if (lodash.get(school, 'level') === 'College') {
                rowY = 57
            } else if (lodash.get(school, 'level') === 'Graduate Studies') {
                rowY = 58
            }
            if (rowY > 0) {

                slex.getCell(`D${rowY}`).value(school.name)
                slex.getCell(`G${rowY}`).value(school.course)

                value = school.periodFrom
                slex.getCell(`J${rowY}`).value(value)

                value = school.periodTo
                slex.getCell(`K${rowY}`).value(value)

                slex.getCell(`L${rowY}`).value(school.unitsEarned)
                slex.getCell(`M${rowY}`).value(school.yearGraduated)
                slex.getCell(`N${rowY}`).value(school.honors)
            }
        }

        slex.getCell('L60').value(toPDSDate(lodash.get(employee, 'personal.datePdsFilled', '')))

    }


    /////////// C2
    worksheet = workbook.getWorksheet('C2')
    if (worksheet) {
        slex.setSheet(worksheet)

        let offset = 5
        for (x = 0; x < 7; x++) {
            let eligibility = lodash.get(employee, `personal.eligibilities[${x}]`)
            let name = lodash.get(eligibility, `name`, '')
            let rating = lodash.get(eligibility, `rating`, '')
            let examDate = lodash.get(eligibility, `examDate`, '')
            let examPlace = lodash.get(eligibility, `examPlace`, '')
            let licenseNumber = lodash.get(eligibility, `licenseNumber`, '')
            let licenseValidity = lodash.get(eligibility, `licenseValidity`, '')

            if (examDate) {
                examDate = moment(examDate).format('MM/DD/YYYY')
            }
            if (licenseValidity) {
                licenseValidity = moment(licenseValidity).format('MM/DD/YYYY')
            }
            let row = offset + x
            slex.getCell(`A${row}`).value(`${name}`)
                .getCell(`F${row}`).value(`${rating}`)
                .getCell(`G${row}`).value(`${examDate}`)
                .getCell(`I${row}`).value(`${examPlace}`)
                .getCell(`L${row}`).value(`${licenseNumber}`)
                .getCell(`M${row}`).value(`${licenseValidity}`)
        }

        offset = 18
        for (x = 0; x < 28; x++) {
            let workExperience = lodash.get(employee, `personal.workExperiences[${x}]`)
            let fromDate = lodash.get(workExperience, `fromDate`, '')
            let toDate = lodash.get(workExperience, `toDate`, '')
            let positionTitle = lodash.get(workExperience, `positionTitle`, '')
            let department = lodash.get(workExperience, `department`, '')
            let salary = lodash.get(workExperience, `salary`, '')
            let payGrade = lodash.get(workExperience, `payGrade`, '')
            let appointmentStatus = lodash.get(workExperience, `appointmentStatus`, '')
            let isGov = lodash.get(workExperience, `isGov`, '')
            let isPresent = lodash.get(workExperience, `present`, '')


            if(isPresent){
                toDate = `Present`
            } else {
                toDate = toPDSDate(toDate)
            }
            let row = offset + x
            slex.getCell(`A${row}`).value(`${toPDSDate(fromDate)}`)
                .getCell(`C${row}`).value(`${toDate}`)
                .getCell(`D${row}`).value(`${positionTitle}`)
                .getCell(`G${row}`).value(`${department}`)
                .getCell(`J${row}`).value(`${salary}`)
                .getCell(`K${row}`).value(`${payGrade}`)
                .getCell(`L${row}`).value(`${appointmentStatus}`)
                .getCell(`M${row}`).value(`${isGov}`)
        }

        slex.getCell('J47').value(toPDSDate(lodash.get(employee, 'personal.datePdsFilled', '')))

    }

    /////////// C3
    worksheet = workbook.getWorksheet('C3')
    if (worksheet) {
        slex.setSheet(worksheet)

        let offset = 6
        let voluntaryworks = lodash.get(employee, `personal.voluntaryWorks`, [])
        for (x = 0; x < voluntaryworks.length; x++) {
            if (x >= 7) break
            let voluntarywork = voluntaryworks[x]
            let row = offset + x

            slex.getCell(`A${row}`).value(`${lodash.get(voluntarywork, 'name', '')}`)
                .getCell(`E${row}`).value(`${toPDSDate(lodash.get(voluntarywork, 'fromDate', ''))}`)
                .getCell(`F${row}`).value(`${toPDSDate(lodash.get(voluntarywork, 'toDate', ''))}`)
                .getCell(`G${row}`).value(`${lodash.get(voluntarywork, 'hours', '')}`)
                .getCell(`H${row}`).value(`${lodash.get(voluntarywork, 'position', '')}`)
        }
        // 
        offset = 18
        let trainings = lodash.get(employee, `personal.trainings`, [])
        for (x = 0; x < trainings.length; x++) {
            if (x < 21) {
                let training = trainings[x]
                let row = offset + x

                slex.getCell(`A${row}`).value(`${lodash.get(training, 'title', '')}`)
                    .getCell(`E${row}`).value(`${toPDSDate(lodash.get(training, 'fromDate', ''))}`)
                    .getCell(`F${row}`).value(`${toPDSDate(lodash.get(training, 'toDate', ''))}`)
                    .getCell(`G${row}`).value(`${lodash.get(training, 'hours', '')}`)
                    .getCell(`H${row}`).value(`${lodash.get(training, 'type', '')}`)
                    .getCell(`I${row}`).value(`${lodash.get(training, 'sponsor', '')}`)

            } else {
                let worksheet2 = workbook.getWorksheet('L&D Cont.')
                let slex2 = new Slex(workbook)
                slex2.setSheet(worksheet2)
                let training = trainings[x]
                let offset = 5
                let row = offset + x - 21

                slex2.getCell(`A${row}`).value(`${lodash.get(training, 'title', '')}`)
                    .getCell(`E${row}`).value(`${toPDSDate(lodash.get(training, 'fromDate', ''))}`)
                    .getCell(`F${row}`).value(`${toPDSDate(lodash.get(training, 'toDate', ''))}`)
                    .getCell(`G${row}`).value(`${lodash.get(training, 'hours', '')}`)
                    .getCell(`H${row}`).value(`${lodash.get(training, 'type', '')}`)
                    .getCell(`I${row}`).value(`${lodash.get(training, 'sponsor', '')}`)
            }
        }
        if(trainings.length <= 21) {
            workbook.removeWorksheet('L&D Cont.')
        }

        // 
        offset = 42
        let extraCurriculars = lodash.get(employee, `personal.extraCurriculars`, []).filter(o => lodash.get(o, 'type') === 'skillHobbies')
        for (let x = 0; x < extraCurriculars.length; x++) {
            if (x >= 7) break // limit to 7
            let o = extraCurriculars[x]
            let row = offset + x
            slex.getCell(`A${row}`).value(`${lodash.get(o, 'detail', '')}`)
        }
        extraCurriculars = lodash.get(employee, `personal.extraCurriculars`, []).filter(o => lodash.get(o, 'type') === 'nonAcademic')
        for (let x = 0; x < extraCurriculars.length; x++) {
            if (x >= 7) break // limit to 7
            let o = extraCurriculars[x]
            let row = offset + x
            slex.getCell(`C${row}`).value(`${lodash.get(o, 'detail', '')}`)
        }
        extraCurriculars = lodash.get(employee, `personal.extraCurriculars`, []).filter(o => lodash.get(o, 'type') === 'organization')
        for (let x = 0; x < extraCurriculars.length; x++) {
            if (x >= 7) break // limit to 7
            let o = extraCurriculars[x]
            let row = offset + x
            slex.getCell(`I${row}`).value(`${lodash.get(o, 'detail', '')}`)
        }

        slex.getCell('J50').value(toPDSDate(lodash.get(employee, 'personal.datePdsFilled', '')))

    }

    /////////// C4
    worksheet = workbook.getWorksheet('C4')
    if (worksheet) {
        slex.setSheet(worksheet)

        value = lodash.get(employee, 'personal.relatedThirdDegree', '')
        tmpVar = (value === 'Yes') ? `[✓] Yes` : `[${'     '}] Yes`
        slex.getCell('H6').value(tmpVar)
        tmpVar = (value === 'No') ? `[✓] No` : `[${'     '}] No`
        slex.getCell('J6').value(tmpVar)

        value = lodash.get(employee, 'personal.relatedFourthDegree', '')
        tmpVar = (value === 'Yes') ? `[✓] Yes` : `[${'     '}] Yes`
        slex.getCell('H8').value(tmpVar)
        tmpVar = (value === 'Yes') ? lodash.get(employee, 'personal.relatedFourthDegreeDetails', '') : ''
        slex.getCell('H11').value(tmpVar)
        tmpVar = (value === 'No') ? `[✓] No` : `[${'     '}] No`
        slex.getCell('J8').value(tmpVar)

        value = lodash.get(employee, 'personal.guiltyAdmin', '')
        tmpVar = (value === 'Yes') ? `[✓] Yes` : `[${'     '}] Yes`
        slex.getCell('H13').value(tmpVar)
        tmpVar = (value === 'Yes') ? lodash.get(employee, 'personal.guiltyAdminDetails', '') : ''
        slex.getCell('H15').value(tmpVar)
        tmpVar = (value === 'No') ? `[✓] No` : `[${'     '}] No`
        slex.getCell('J13').value(tmpVar)

        value = lodash.get(employee, 'personal.criminalCharge', '')
        tmpVar = (value === 'Yes') ? `[✓] Yes` : `[${'     '}] Yes`
        slex.getCell('H18').value(tmpVar)
        tmpVar = (value === 'Yes') ? lodash.get(employee, 'personal.criminalChargeDetails', '') : ''
        slex.getCell('K20').value(tmpVar)
        tmpVar = (value === 'Yes') ? lodash.get(employee, 'personal.criminalChargeDate', '') : ''
        tmpVar = (tmpVar) ? moment(tmpVar).format('MMM DD, YYYY') : ''
        slex.getCell('K21').value(tmpVar)
        tmpVar = (value === 'No') ? `[✓] No` : `[${'     '}] No`
        slex.getCell('J18').value(tmpVar)

        value = lodash.get(employee, 'personal.convicted', '')
        tmpVar = (value === 'Yes') ? `[✓] Yes` : `[${'     '}] Yes`
        slex.getCell('H23').value(tmpVar)
        tmpVar = (value === 'Yes') ? lodash.get(employee, 'personal.convictedDetails', '') : ''
        slex.getCell('H25').value(tmpVar)
        tmpVar = (value === 'No') ? `[✓] No` : `[${'     '}] No`
        slex.getCell('J23').value(tmpVar)

        value = lodash.get(employee, 'personal.problematicHistory', '')
        tmpVar = (value === 'Yes') ? `[✓] Yes` : `[${'     '}] Yes`
        slex.getCell('H27').value(tmpVar)
        tmpVar = (value === 'Yes') ? lodash.get(employee, 'personal.problematicHistoryDetails', '') : ''
        slex.getCell('H29').value(tmpVar)
        tmpVar = (value === 'No') ? `[✓] No` : `[${'     '}] No`
        slex.getCell('J27').value(tmpVar)

        value = lodash.get(employee, 'personal.electionCandidate', '')
        tmpVar = (value === 'Yes') ? `[✓] Yes` : `[${'     '}] Yes`
        slex.getCell('H31').value(tmpVar)
        tmpVar = (value === 'Yes') ? lodash.get(employee, 'personal.electionCandidateDetails', '') : ''
        slex.getCell('K32').value(tmpVar)
        tmpVar = (value === 'No') ? `[✓] No` : `[${'     '}] No`
        slex.getCell('J31').value(tmpVar)

        value = lodash.get(employee, 'personal.electionResigned', '')
        tmpVar = (value === 'Yes') ? `[✓] Yes` : `[${'     '}] Yes`
        slex.getCell('H34').value(tmpVar)
        tmpVar = (value === 'Yes') ? lodash.get(employee, 'personal.electionResignedDetails', '') : ''
        slex.getCell('K35').value(tmpVar)
        tmpVar = (value === 'No') ? `[✓] No` : `[${'     '}] No`
        slex.getCell('J34').value(tmpVar)

        value = lodash.get(employee, 'personal.dualCitizen', '')
        tmpVar = (value === 'Yes') ? `[✓] Yes` : `[${'     '}] Yes`
        slex.getCell('H37').value(tmpVar)
        tmpVar = (value === 'Yes') ? lodash.get(employee, 'personal.dualCitizenDetails', '') : ''
        slex.getCell('H39').value(tmpVar)
        tmpVar = (value === 'No') ? `[✓] No` : `[${'     '}] No`
        slex.getCell('J37').value(tmpVar)

        value = lodash.get(employee, 'personal.indigenousGroup', '')
        tmpVar = (value === 'Yes') ? `[✓] Yes` : `[${'     '}] Yes`
        slex.getCell('H43').value(tmpVar)
        tmpVar = (value === 'Yes') ? lodash.get(employee, 'personal.indigenousGroupDetails', '') : ''
        slex.getCell('L44').value(tmpVar)
        tmpVar = (value === 'No') ? `[✓] No` : `[${'     '}] No`
        slex.getCell('J43').value(tmpVar)

        value = lodash.get(employee, 'personal.pwd', '')
        tmpVar = (value === 'Yes') ? `[✓] Yes` : `[${'     '}] Yes`
        slex.getCell('H45').value(tmpVar)
        tmpVar = (value === 'Yes') ? lodash.get(employee, 'personal.pwdDetails', '') : ''
        slex.getCell('L46').value(tmpVar)
        tmpVar = (value === 'No') ? `[✓] No` : `[${'     '}] No`
        slex.getCell('J45').value(tmpVar)

        value = lodash.get(employee, 'personal.soloParent', '')
        tmpVar = (value === 'Yes') ? `[✓] Yes` : `[${'     '}] Yes`
        slex.getCell('H47').value(tmpVar)
        tmpVar = (value === 'Yes') ? lodash.get(employee, 'personal.soloParentDetails', '') : ''
        slex.getCell('L48').value(tmpVar)
        tmpVar = (value === 'No') ? `[✓] No` : `[${'     '}] No`
        slex.getCell('J47').value(tmpVar)

        offset = 52
        let references = lodash.get(employee, `personal.references`, [])
        for (let x = 0; x < references.length; x++) {
            if (x >= 3) break // limit to 3
            let o = references[x]
            let row = offset + x
            slex.getCell(`A${row}`).value(`${lodash.get(o, 'name', '')}`)
            slex.getCell(`F${row}`).value(`${lodash.get(o, 'address', '')}`)
            slex.getCell(`G${row}`).value(`${lodash.get(o, 'phoneNumber', '')}`)
        }

        slex.getCell('D61').value(lodash.get(employee, 'personal.governmentId', ''))
        slex.getCell('D62').value(lodash.get(employee, 'personal.governmentIdNumber', ''))
        slex.getCell('D64').value(lodash.get(employee, 'personal.governmentIdDatePlace', ''))

        slex.getCell('F68').value(lodash.get(employee, 'personal.personAdministeringOath', ''))

        slex.getCell('F64').value(toPDSDate(lodash.get(employee, 'personal.datePdsFilled', '')))

    }

    return workbook

}

let templatePermanent = async (payroll) => {
    let workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(`${CONFIG.app.dirs.view}/payroll/template_permanent2.xlsx`);
    let slex = new Slex(workbook)

    let worksheet = await workbook.getWorksheet('Permanent')

    let startRowIndex = 11

    if (worksheet) {

        // Set Print Area for a sheet
        // worksheet.pageSetup.printArea = `A1:AM${startRowIndex + payroll.rows.length + 12}`;

        slex.setSheet(worksheet)

        // worksheet.duplicateRow(startRowIndex, rowCount - 1 + (pageLength * pages), true);

        slex.getCell('A2')
            .value(`Salary for the period ${moment(payroll.dateStart).format('MMMM DD')} - ${moment(payroll.dateEnd).format('DD, YYYY')}`)

        let numbering = 0
        payroll.rows.filter(r => r.type === 1).slice(0, 58).forEach((row, rowIndex) => {
            numbering++

            let curRowIndex = startRowIndex + rowIndex

            let wsRow = worksheet.getRow(curRowIndex)



            // let attendance = payrollJs.getCellValue(row, 'attendance', payrollJs.formulas, payroll.columns)

            //=F10*E10+H10*E10/8+J10*E10/8/60
            // let amount = payrollJs.amountWorked(lodash.get(row, 'employment.salary', 0), lodash.get(row, 'employment.salaryType', 0), lodash.get(row, 'timeRecord.totalMinutes', 0))


            let grossPayAllowance = payrollJs.getCellValue(row, 'grossPayAllowance', payrollJs.formulas, payroll.columns)

            // console.log(`A${curRowIndex}`, numbering)
            slex.getCell(`A${curRowIndex}`)
                .value(numbering)

                .getCell(`B${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'name', payrollJs.formulas, payroll.columns))
                .getCell(`C${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'position', payrollJs.formulas, payroll.columns))
                .getCell(`D${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'basePay', payrollJs.formulas, payroll.columns))
                .getCell(`E${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'peraAca', payrollJs.formulas, payroll.columns))
                .getCell(`F${curRowIndex}`)
                .value({
                    formula: `=D${curRowIndex}+E${curRowIndex}`,
                    result: parseFloat(grossPayAllowance.toFixed(2))
                })
                .getCell(`G${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'tardiness', payrollJs.formulas, payroll.columns))
                .getCell(`H${curRowIndex}`)
                .value({
                    formula: `=F${curRowIndex}-G${curRowIndex}`,
                    result: parseFloat(payrollJs.getCellValue(row, 'grossPayAllowance', payrollJs.formulas, payroll.columns).toFixed(2))
                })
                .getCell(`I${curRowIndex}`)
                .value({
                    formula: `=D${curRowIndex}*9%`,
                    result: parseFloat(payrollJs.getCellValue(row, 'rlipPs9', payrollJs.formulas, payroll.columns).toFixed(2))
                })
                .getCell(`J${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'emergencyLoan', payrollJs.formulas, payroll.columns))
                .getCell(`K${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'eal', payrollJs.formulas, payroll.columns))
                .getCell(`L${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'consoLoan', payrollJs.formulas, payroll.columns))
                .getCell(`M${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'ouliPremium', payrollJs.formulas, payroll.columns))
                .getCell(`N${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'policyOuliLoan', payrollJs.formulas, payroll.columns))
                .getCell(`O${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'regularPolicyLoan', payrollJs.formulas, payroll.columns))
                .getCell(`P${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'gfal', payrollJs.formulas, payroll.columns))
                .getCell(`Q${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'mpl', payrollJs.formulas, payroll.columns))
                .getCell(`R${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'cpl', payrollJs.formulas, payroll.columns))
                .getCell(`S${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'help', payrollJs.formulas, payroll.columns))
                .getCell(`T${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'medicare', payrollJs.formulas, payroll.columns))
                .getCell(`U${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'pagibigContribution', payrollJs.formulas, payroll.columns))
                .getCell(`V${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'mplLoan', payrollJs.formulas, payroll.columns))
                .getCell(`W${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'calamityLoan', payrollJs.formulas, payroll.columns))
                .getCell(`X${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'withholdingTax', payrollJs.formulas, payroll.columns))
                .getCell(`Y${curRowIndex}`)
                .value({
                    formula: `=SUM(J${curRowIndex}:X${curRowIndex})+I${curRowIndex}`,
                    result: parseFloat(payrollJs.getCellValue(row, 'totalMandatoryDeductions', payrollJs.formulas, payroll.columns).toFixed(2))
                })
                .getCell(`Z${curRowIndex}`)
                .value({
                    formula: `=F${curRowIndex}-Y${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'netAfterTotalMandatoryDeductions', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AC${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'teachersScholars', payrollJs.formulas, payroll.columns))
                .getCell(`AD${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'ffaLoan', payrollJs.formulas, payroll.columns))
                .getCell(`AG${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'citySavingsBank', payrollJs.formulas, payroll.columns))
                .getCell(`AH${curRowIndex}`)
                .value({
                    formula: `=SUM(AC${curRowIndex}:AG${curRowIndex})`,
                    result: payrollJs.getCellValue(row, 'totalNonMandatoryDeductions', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AI${curRowIndex}`)
                .value({
                    formula: `=A${curRowIndex}`,
                    result: numbering
                })
                .getCell(`AJ${curRowIndex}`)
                .value({
                    formula: `=Z${curRowIndex}-AH${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'netPay', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AK${curRowIndex}`)
                .value('')
                .getCell(`AL${curRowIndex}`)
                .value('')
                .getCell(`AM${curRowIndex}`)
                .value('')
                .getCell(`AN${curRowIndex}`)
                .value({
                    formula: `=AK${curRowIndex}+AL${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'totalQuincena', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AO${curRowIndex}`)
                .value({
                    formula: `=AJ${curRowIndex}-AN${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'variance', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AP${curRowIndex}`)
                .value({
                    formula: `=Y${curRowIndex}+AH${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'totalDeductions', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AS${curRowIndex}`)
                .value({
                    formula: `=Y${curRowIndex}+AH${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'totalDeductions', payrollJs.formulas, payroll.columns)
                })


        })
        startRowIndex = 81
        payroll.rows.filter(r => r.type === 1).slice(58, 110).forEach((row, rowIndex) => {
            numbering++

            let curRowIndex = startRowIndex + rowIndex

            let wsRow = worksheet.getRow(curRowIndex)



            // let attendance = payrollJs.getCellValue(row, 'attendance', payrollJs.formulas, payroll.columns)

            //=F10*E10+H10*E10/8+J10*E10/8/60
            // let amount = payrollJs.amountWorked(lodash.get(row, 'employment.salary', 0), lodash.get(row, 'employment.salaryType', 0), lodash.get(row, 'timeRecord.totalMinutes', 0))


            let grossPayAllowance = payrollJs.getCellValue(row, 'grossPayAllowance', payrollJs.formulas, payroll.columns)

            // console.log(`A${curRowIndex}`, numbering)
            slex.getCell(`A${curRowIndex}`)
                .value(numbering)

                .getCell(`B${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'name', payrollJs.formulas, payroll.columns))
                .getCell(`C${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'position', payrollJs.formulas, payroll.columns))
                .getCell(`D${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'basePay', payrollJs.formulas, payroll.columns))
                .getCell(`E${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'peraAca', payrollJs.formulas, payroll.columns))
                .getCell(`F${curRowIndex}`)
                .value({
                    formula: `=D${curRowIndex}+E${curRowIndex}`,
                    result: parseFloat(grossPayAllowance.toFixed(2))
                })
                .getCell(`G${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'tardiness', payrollJs.formulas, payroll.columns))
                .getCell(`H${curRowIndex}`)
                .value({
                    formula: `=F${curRowIndex}-G${curRowIndex}`,
                    result: parseFloat(payrollJs.getCellValue(row, 'grossPayAllowance', payrollJs.formulas, payroll.columns).toFixed(2))
                })
                .getCell(`I${curRowIndex}`)
                .value({
                    formula: `=D${curRowIndex}*9%`,
                    result: parseFloat(payrollJs.getCellValue(row, 'rlipPs9', payrollJs.formulas, payroll.columns).toFixed(2))
                })
                .getCell(`J${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'emergencyLoan', payrollJs.formulas, payroll.columns))
                .getCell(`K${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'eal', payrollJs.formulas, payroll.columns))
                .getCell(`L${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'consoLoan', payrollJs.formulas, payroll.columns))
                .getCell(`M${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'ouliPremium', payrollJs.formulas, payroll.columns))
                .getCell(`N${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'policyOuliLoan', payrollJs.formulas, payroll.columns))
                .getCell(`O${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'regularPolicyLoan', payrollJs.formulas, payroll.columns))
                .getCell(`P${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'gfal', payrollJs.formulas, payroll.columns))
                .getCell(`Q${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'mpl', payrollJs.formulas, payroll.columns))
                .getCell(`R${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'cpl', payrollJs.formulas, payroll.columns))
                .getCell(`S${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'help', payrollJs.formulas, payroll.columns))
                .getCell(`T${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'medicare', payrollJs.formulas, payroll.columns))
                .getCell(`U${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'pagibigContribution', payrollJs.formulas, payroll.columns))
                .getCell(`V${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'mplLoan', payrollJs.formulas, payroll.columns))
                .getCell(`W${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'calamityLoan', payrollJs.formulas, payroll.columns))
                .getCell(`X${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'withholdingTax', payrollJs.formulas, payroll.columns))
                .getCell(`Y${curRowIndex}`)
                .value({
                    formula: `=SUM(J${curRowIndex}:X${curRowIndex})+I${curRowIndex}`,
                    result: parseFloat(payrollJs.getCellValue(row, 'totalMandatoryDeductions', payrollJs.formulas, payroll.columns).toFixed(2))
                })
                .getCell(`Z${curRowIndex}`)
                .value({
                    formula: `=F${curRowIndex}-Y${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'netAfterTotalMandatoryDeductions', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AC${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'teachersScholars', payrollJs.formulas, payroll.columns))
                .getCell(`AD${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'ffaLoan', payrollJs.formulas, payroll.columns))
                .getCell(`AG${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'citySavingsBank', payrollJs.formulas, payroll.columns))
                .getCell(`AH${curRowIndex}`)
                .value({
                    formula: `=SUM(AC${curRowIndex}:AG${curRowIndex})`,
                    result: payrollJs.getCellValue(row, 'totalNonMandatoryDeductions', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AI${curRowIndex}`)
                .value({
                    formula: `=A${curRowIndex}`,
                    result: numbering
                })
                .getCell(`AJ${curRowIndex}`)
                .value({
                    formula: `=Z${curRowIndex}-AH${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'netPay', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AK${curRowIndex}`)
                .value('')
                .getCell(`AL${curRowIndex}`)
                .value('')
                .getCell(`AM${curRowIndex}`)
                .value('')
                .getCell(`AN${curRowIndex}`)
                .value({
                    formula: `=AK${curRowIndex}+AL${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'totalQuincena', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AO${curRowIndex}`)
                .value({
                    formula: `=AJ${curRowIndex}-AN${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'variance', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AP${curRowIndex}`)
                .value({
                    formula: `=Y${curRowIndex}+AH${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'totalDeductions', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AS${curRowIndex}`)
                .value({
                    formula: `=Y${curRowIndex}+AH${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'totalDeductions', payrollJs.formulas, payroll.columns)
                })


        })
        startRowIndex = 155
        numbering = 0;
        payroll.rows.filter(r => r.type === 1).slice(110).forEach((row, rowIndex) => {
            numbering++

            let curRowIndex = startRowIndex + rowIndex

            let wsRow = worksheet.getRow(curRowIndex)



            // let attendance = payrollJs.getCellValue(row, 'attendance', payrollJs.formulas, payroll.columns)

            //=F10*E10+H10*E10/8+J10*E10/8/60
            // let amount = payrollJs.amountWorked(lodash.get(row, 'employment.salary', 0), lodash.get(row, 'employment.salaryType', 0), lodash.get(row, 'timeRecord.totalMinutes', 0))


            let grossPayAllowance = payrollJs.getCellValue(row, 'grossPayAllowance', payrollJs.formulas, payroll.columns)

            // console.log(`A${curRowIndex}`, numbering)
            slex.getCell(`A${curRowIndex}`)
                .value(numbering)

                .getCell(`B${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'name', payrollJs.formulas, payroll.columns))
                .getCell(`C${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'position', payrollJs.formulas, payroll.columns))
                .getCell(`D${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'basePay', payrollJs.formulas, payroll.columns))
                .getCell(`E${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'peraAca', payrollJs.formulas, payroll.columns))
                .getCell(`F${curRowIndex}`)
                .value({
                    formula: `=D${curRowIndex}+E${curRowIndex}`,
                    result: parseFloat(grossPayAllowance.toFixed(2))
                })
                .getCell(`G${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'tardiness', payrollJs.formulas, payroll.columns))
                .getCell(`H${curRowIndex}`)
                .value({
                    formula: `=F${curRowIndex}-G${curRowIndex}`,
                    result: parseFloat(payrollJs.getCellValue(row, 'grossPayAllowance', payrollJs.formulas, payroll.columns).toFixed(2))
                })
                .getCell(`I${curRowIndex}`)
                .value({
                    formula: `=D${curRowIndex}*9%`,
                    result: parseFloat(payrollJs.getCellValue(row, 'rlipPs9', payrollJs.formulas, payroll.columns).toFixed(2))
                })
                .getCell(`J${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'emergencyLoan', payrollJs.formulas, payroll.columns))
                .getCell(`K${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'eal', payrollJs.formulas, payroll.columns))
                .getCell(`L${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'consoLoan', payrollJs.formulas, payroll.columns))
                .getCell(`M${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'ouliPremium', payrollJs.formulas, payroll.columns))
                .getCell(`N${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'policyOuliLoan', payrollJs.formulas, payroll.columns))
                .getCell(`O${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'regularPolicyLoan', payrollJs.formulas, payroll.columns))
                .getCell(`P${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'gfal', payrollJs.formulas, payroll.columns))
                .getCell(`Q${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'mpl', payrollJs.formulas, payroll.columns))
                .getCell(`R${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'cpl', payrollJs.formulas, payroll.columns))
                .getCell(`S${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'help', payrollJs.formulas, payroll.columns))
                .getCell(`T${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'medicare', payrollJs.formulas, payroll.columns))
                .getCell(`U${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'pagibigContribution', payrollJs.formulas, payroll.columns))
                .getCell(`V${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'mplLoan', payrollJs.formulas, payroll.columns))
                .getCell(`W${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'calamityLoan', payrollJs.formulas, payroll.columns))
                .getCell(`X${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'withholdingTax', payrollJs.formulas, payroll.columns))
                .getCell(`Y${curRowIndex}`)
                .value({
                    formula: `=SUM(J${curRowIndex}:X${curRowIndex})+I${curRowIndex}`,
                    result: parseFloat(payrollJs.getCellValue(row, 'totalMandatoryDeductions', payrollJs.formulas, payroll.columns).toFixed(2))
                })
                .getCell(`Z${curRowIndex}`)
                .value({
                    formula: `=F${curRowIndex}-Y${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'netAfterTotalMandatoryDeductions', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AC${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'teachersScholars', payrollJs.formulas, payroll.columns))
                .getCell(`AD${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'ffaLoan', payrollJs.formulas, payroll.columns))
                .getCell(`AG${curRowIndex}`)
                .value(payrollJs.getCellValue(row, 'citySavingsBank', payrollJs.formulas, payroll.columns))
                .getCell(`AH${curRowIndex}`)
                .value({
                    formula: `=SUM(AC${curRowIndex}:AG${curRowIndex})`,
                    result: payrollJs.getCellValue(row, 'totalNonMandatoryDeductions', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AI${curRowIndex}`)
                .value({
                    formula: `=A${curRowIndex}`,
                    result: numbering
                })
                .getCell(`AJ${curRowIndex}`)
                .value({
                    formula: `=Z${curRowIndex}-AH${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'netPay', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AK${curRowIndex}`)
                .value('')
                .getCell(`AL${curRowIndex}`)
                .value('')
                .getCell(`AM${curRowIndex}`)
                .value('')
                .getCell(`AN${curRowIndex}`)
                .value({
                    formula: `=AK${curRowIndex}+AL${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'totalQuincena', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AO${curRowIndex}`)
                .value({
                    formula: `=AJ${curRowIndex}-AN${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'variance', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AP${curRowIndex}`)
                .value({
                    formula: `=Y${curRowIndex}+AH${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'totalDeductions', payrollJs.formulas, payroll.columns)
                })
                .getCell(`AS${curRowIndex}`)
                .value({
                    formula: `=Y${curRowIndex}+AH${curRowIndex}`,
                    result: payrollJs.getCellValue(row, 'totalDeductions', payrollJs.formulas, payroll.columns)
                })


        })
    }

    return workbook

}

let templateAttendanceDaily = async (mCalendar, attendances) => {

    let workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(`${CONFIG.app.dirs.view}/attendance/daily.xlsx`);
    let slex = new Slex(workbook)

    let worksheet = workbook.getWorksheet('main')
    if (worksheet) {
        slex.setSheet(worksheet)
        slex.getCell('A2').value(`${mCalendar.format('dddd - MMM DD, YYYY')}`)

        let offset = 5
        for (x = 0; x < attendances.length; x++) {
            let attendance = attendances[x]

            row = offset + x
            slex.getCell(`A${row}`).value(x + 1)
            slex.getCell(`B${row}`).value(lodash.capitalize(attendance.employment.campus))
            slex.getCell(`C${row}`).value(`${attendance.employee.firstName} ${attendance.employee.lastName} ${attendance.employee.suffix}`)
            slex.getCell(`D${row}`).value((attendance.employee.gender === 'M' ? '✓' : ''))
            slex.getCell(`E${row}`).value((attendance.employee.gender === 'F' ? '✓' : ''))

            // 'hh:mm'
            let morningIn = moment(lodash.get(attendance, 'logs[0].dateTime', null))
            let morningOut = moment(lodash.get(attendance, 'logs[1].dateTime', null))
            let afternoonIn = moment(lodash.get(attendance, 'logs[2].dateTime', null))
            let afternoonOut = moment(lodash.get(attendance, 'logs[3].dateTime', null))

            morningIn = morningIn.isValid() ? morningIn.format('hh:mm') : ''
            morningOut = morningOut.isValid() ? morningOut.format('hh:mm') : ''
            afternoonIn = afternoonIn.isValid() ? afternoonIn.format('hh:mm') : ''
            afternoonOut = afternoonOut.isValid() ? afternoonOut.format('hh:mm') : ''

            if (attendance.type === 'normal') {
                slex.getCell(`F${row}`).value(morningIn)
                slex.getCell(`H${row}`).value(morningOut)
                slex.getCell(`J${row}`).value(afternoonIn)
                slex.getCell(`L${row}`).value(afternoonOut)
            } else {
                slex.getCell(`F${row}`).value(`${attendance.type} ${morningIn}`)
                slex.getCell(`H${row}`).value(morningOut)
                slex.getCell(`J${row}`).value(afternoonIn)
                slex.getCell(`L${row}`).value(afternoonOut)
            }
        }

    }

    return workbook

}
let templateAttendanceFlag = async (mCalendar, attendances) => {

    let workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(`${CONFIG.app.dirs.view}/attendance/flag.xlsx`);
    let slex = new Slex(workbook)

    let worksheet = workbook.getWorksheet('main')
    if (worksheet) {
        slex.setSheet(worksheet)
        slex.getCell('A2').value(`${mCalendar.format('dddd - MMM DD, YYYY')}`)

        let offset = 4
        for (x = 0; x < attendances.length; x++) {
            let attendance = attendances[x]

            row = offset + x
            slex.getCell(`A${row}`).value(x + 1)
            slex.getCell(`B${row}`).value(`${attendance.employee.firstName}`)
            let lastName = [attendance.employee.lastName]
            if(attendance.employee.suffix) {
                lastName.push(attendance.employee.suffix)
            }
            slex.getCell(`C${row}`).value(`${lastName.join(', ')}`)
            slex.getCell(`D${row}`).value((attendance.employee.gender === 'M' ? 'M' : 'F'))
            slex.getCell(`E${row}`).value(lodash.get(attendance, 'logTime', ''))

        }

    }

    return workbook

}

let templateGenderReport = async (employees) => {

    let workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(`${CONFIG.app.dirs.view}/reports/rsp/gender/table.xlsx`);
    let slex = new Slex(workbook)

    let worksheet = workbook.getWorksheet('Sheet1')
    if (worksheet) {
        slex.setSheet(worksheet)

        let offset = 2
        for (x = 0; x < employees.length; x++) {
            let employee = employees[x]

            row = offset + x
            slex.getCell(`A${row}`).value(x + 1)

            let lastName = employee.lastName
            lastName = (employee.suffix) ? lodash.capitalize(lastName) + ', ' + employee.suffix : lodash.capitalize(lastName)

            slex.getCell(`B${row}`).value(lastName)
            slex.getCell(`C${row}`).value(lodash.capitalize(employee.middleName))
            slex.getCell(`D${row}`).value(lodash.capitalize(employee.firstName))
            slex.getCell(`E${row}`).value(lodash.get(employee, 'employments[0].position', ''))

            let birthDate = moment(lodash.get(employee, 'birthDate', null))
            birthDate = (birthDate.isValid()) ? birthDate.format('MMM DD, YYYY') : ''
            slex.getCell(`F${row}`).value(birthDate)
            slex.getCell(`G${row}`).value(lodash.get(employee, 'gender', ''))

        }

    }

    return workbook

}

let templateReportTardinessOverall = async (employees, periodString, pagination) => {

    let workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(`${CONFIG.app.dirs.view}/reports/pm/tardiness/overall.xlsx`);
    let slex = new Slex(workbook)

    let worksheet = workbook.getWorksheet('Sheet1')
    if (worksheet) {
        slex.setSheet(worksheet)

        let off = 3
        for(let i = 0; i < employees.length; i++){
            let employee = employees[i]
            let r = off + i
            slex.getCell(`A1`).value(periodString)
            slex.getCell(`A${r}`).value((i+1) + (pagination.page - 1) * (pagination.perPage|0))
            slex.getCell(`B${r}`).value(employee.lastName + ' ' + employee.firstName)
            slex.getCell(`C${r}`).value(employee.undertimeFreq)
            slex.getCell(`D${r}`).value(`${employee.underDays} days ${employee.underHours} hrs ${employee.underMinutes} mins`)
        }
    }

    return workbook

}
let templateReportTardinessPerEmployee = async (employee, periodString, undertimeFreq, timeRecordSummary) => {

    let workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(`${CONFIG.app.dirs.view}/reports/pm/tardiness/per-employee.xlsx`);
    let slex = new Slex(workbook)

    let worksheet = workbook.getWorksheet('Sheet1')
    if (worksheet) {
        slex.setSheet(worksheet)
        slex.getCell(`A1`).value(periodString)
        slex.getCell(`A3`).value(employee.lastName + ' ' + employee.firstName)
        slex.getCell(`B3`).value(undertimeFreq)
        slex.getCell(`C3`).value(`${timeRecordSummary.underDays} days ${timeRecordSummary.underHours} hrs ${timeRecordSummary.underMinutes} mins`)
    }

    return workbook

}

let templateReportTrainingAll = async (employees, pagination) => {

    let workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(`${CONFIG.app.dirs.view}/reports/lad/training/all.xlsx`);
    let slex = new Slex(workbook)

    let worksheet = workbook.getWorksheet('Sheet1')
    if (worksheet) {
        slex.setSheet(worksheet)

        let off = 2
        for(let i = 0; i < employees.length; i++){
            let employee = employees[i]
            let r = off + i

            let highest = ''
            let lastSchool = lodash.get(employee, 'lastSchool')
            if (lastSchool){
                highest = `${lastSchool.course} \n${lastSchool.name} (${lastSchool.periodFrom}-${lastSchool.periodTo}) \n${lastSchool.honors} - ${lastSchool.level}`
            }

            let eligibilities = lodash.get(employee, 'personal.eligibilities', [])
            if(!eligibilities) eligibilities = []

            eligibilities = eligibilities.map(o=>{
                return `${o.name}\nRating: ${o.rating}\nExam Date: ${o.examDate}\nExam Place: ${o.examPlace}\nNumber: ${o.licenseNumber}\nValidity: ${o.licenseValidity}\n`
            }).join("\n")

            let trainings = lodash.get(employee, 'personal.trainings', []).map(o=>{
                return `${o.title}\n`
            }).join("\n")

            slex.getCell(`A${r}`).value((i+1) + (pagination.page - 1) * (pagination.perPage|0))
            slex.getCell(`B${r}`).value(employee.lastName + ', ' + employee.firstName)
            slex.getCell(`C${r}`).value(highest)
            slex.getCell(`D${r}`).value(eligibilities)
            slex.getCell(`E${r}`).value(trainings)
        }
    }

    return workbook

}

module.exports = {
    templateCos: templateCos,
    templateHdf: templateHdf,
    templatePds: templatePds,
    templatePermanent: templatePermanent,
    templateAttendanceDaily: templateAttendanceDaily,
    templateAttendanceFlag: templateAttendanceFlag,
    templateGenderReport: templateGenderReport,
    templateReportTardinessOverall: templateReportTardinessOverall,
    templateReportTardinessPerEmployee: templateReportTardinessPerEmployee,
    templateReportTrainingAll: templateReportTrainingAll,
}