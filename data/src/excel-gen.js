//// Core modules

//// External modules
const ExcelJS = require('exceljs');
const lodash = require('lodash')
const moment = require('moment')
const money = require('money-math')

//// Modules


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
    bgFill(s) {
        lodash.set(this, 'cell.fill', {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: s }
        })

        return this
    }
    border(t, r, b, l) {
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

let currency = (s) => {
    return parseFloat(money.floatToAmount(s))
}
let templateJocos = async (payroll) => {
    const workbook = new ExcelJS.Workbook();
    let sheet = workbook.addWorksheet('igp');
    sheet.views = [
        { zoomScale: 80 }
    ];

    // merge a range of cells
    sheet.mergeCells('A1:Y1');
    sheet.mergeCells('A2:Y2');

    sheet.getCell('A1').value = 'PAYROLL';
    sheet.getCell('A1').alignment = { vertical: 'bottom', horizontal: 'center' };
    sheet.getCell('A1').font = {
        name: 'Arial',
        size: 20,
        bold: true
    };
    sheet.getCell('A2').value = `Salary for the period ${moment(payroll.dateStart).format('MMMM DD')} - ${moment(payroll.dateEnd).format('DD, YYYY')}`;
    sheet.getCell('A2').alignment = { vertical: 'bottom', horizontal: 'center' };
    sheet.getCell('A2').font = {
        name: 'Arial',
        size: 11,
        bold: true
    };

    sheet.mergeCells('B3:C3');
    sheet.getCell('B3').value = `Entity Name: GSC`;
    sheet.getCell('B3').font = {
        name: 'Arial',
        size: 11,
        bold: true
    };

    sheet.mergeCells('B4:C4');
    sheet.getCell('B4').value = `Fund Cluster: IGP`;
    sheet.getCell('B4').font = {
        name: 'Arial',
        size: 11,
        bold: true
    };

    // sheet.mergeCells('A5:K5');
    sheet.getCell('A5').value = `We acknowledge receipt of cash shown opposite our name as full compensation for services rendered for the period covered.`;
    sheet.getCell('A5').font = {
        name: 'Arial',
        size: 10,
    };

    sheet.mergeCells('A6:A8');
    sheet.getCell('A6').value = `NO.`;
    sheet.getCell('A6').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('A6').font = {
        name: 'Arial',
        size: 11,
        bold: true
    };

    sheet.mergeCells('B6:B8');
    sheet.getCell('B6').value = `Source of Fund`;
    sheet.getCell('B6').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('B6').font = {
        name: 'Arial',
        size: 10,
        bold: true
    };

    sheet.mergeCells('C6:C8');
    sheet.getCell('C6').value = `NAME`;
    sheet.getCell('C6').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('C6').font = {
        name: 'Arial',
        size: 11,
        bold: true
    };

    sheet.mergeCells('D6:D8');
    sheet.getCell('D6').value = `POSITION`;
    sheet.getCell('D6').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('D6').font = {
        name: 'Arial',
        size: 11,
        bold: true
    };

    sheet.mergeCells('E6:E8');
    sheet.getCell('E6').value = `DAILY/ \nMONTHLY \nWAGE`;
    sheet.getCell('E6').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    sheet.getCell('E6').font = {
        name: 'Arial',
        size: 11,
        bold: true
    };

    sheet.mergeCells('F6:K8');
    sheet.getCell('F6').value = `No. of Days Rendered`;
    sheet.getCell('F6').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('F6').font = {
        name: 'Arial',
        size: 11,
        bold: true
    };

    sheet.mergeCells('L6:L8');
    sheet.getCell('L6').value = `Gross Amount`;
    sheet.getCell('L6').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('L6').font = {
        name: 'Arial',
        size: 11,
        bold: true
    };

    payroll.employments.forEach((employment, i) => {
        let cellRef = `A${10 + i}`
        sheet.getCell(cellRef).value = i + 1
        sheet.getCell(cellRef).font = {
            name: 'Arial',
            size: 14,
        };

        cellRef = `B${10 + i}`
        sheet.getCell(cellRef).value = `${employment.fundSource}`
        sheet.getCell(cellRef).font = {
            name: 'Arial Narrow',
            size: 14,
        };

        cellRef = `C${10 + i}`
        sheet.getCell(cellRef).value = `${employment.employee.lastName}, ${employment.employee.firstName}`
        sheet.getCell(cellRef).font = {
            name: 'Arial',
            size: 14,
        };

        cellRef = `D${10 + i}`
        sheet.getCell(cellRef).value = `${employment.position}`
        sheet.getCell(cellRef).font = {
            name: 'Arial',
            size: 14,
        };

        cellRef = `E${10 + i}`
        sheet.getCell(cellRef).value = employment.salary
        sheet.getCell(cellRef).font = {
            name: 'Arial',
            size: 14,
        };

        cellRef = `F${10 + i}`
        sheet.getCell(cellRef).value = employment.timeRecord.renderedDays
        sheet.getCell(cellRef).font = {
            name: 'Arial',
            size: 14,
        };
        cellRef = `G${10 + i}`
        sheet.getCell(cellRef).value = `Days`
        sheet.getCell(cellRef).font = {
            name: 'Arial',
            size: 14,
        };
        cellRef = `H${10 + i}`
        sheet.getCell(cellRef).value = employment.timeRecord.renderedHours
        sheet.getCell(cellRef).font = {
            name: 'Arial',
            size: 14,
        };
        cellRef = `I${10 + i}`
        sheet.getCell(cellRef).value = `hours`
        sheet.getCell(cellRef).font = {
            name: 'Arial',
            size: 14,
        };
        cellRef = `J${10 + i}`
        sheet.getCell(cellRef).value = employment.timeRecord.renderedMinutes
        sheet.getCell(cellRef).font = {
            name: 'Arial',
            size: 14,
        };
        cellRef = `K${10 + i}`
        sheet.getCell(cellRef).value = `minutes`
        sheet.getCell(cellRef).font = {
            name: 'Arial',
            size: 14,
        };
        //=F10*E10+H10*E10/8+J10*E10/8/60
        cellRef = `L${10 + i}`
        sheet.getCell(cellRef).value = {
            formula: `F${10 + i}*E${10 + i}+H${10 + i}*E${10 + i}/8+J${10 + i}*E${10 + i}/8/60`,
            result: parseFloat(employment.amountWorked.toFixed(2))
        };
        sheet.getCell(cellRef).font = {
            name: 'Arial',
            size: 14,
        };
    })

    // sheet.columns.forEach(function (column, i) {
    //     if (![0].includes(i)) {
    //         var maxLength = 0;

    //         column.eachCell({ includeEmpty: false }, function (cell, rowNumber) {
    //             if (rowNumber > 5) {
    //                 var columnLength = cell.value ? cell.value.toString().length : 10;
    //                 if (columnLength > maxLength) {
    //                     maxLength = columnLength;
    //                 }
    //             }
    //         });
    //         column.width = maxLength < 10 ? 10 : maxLength;
    //     }
    // });

    return workbook

}

let templatePds = async (employee) => {
    let row = null
    let cell = null
    let chk = null
    let chk2 = null
    let value = null
    let colors = {
        black: { argb: '00000000' }
    }

    const workbook = new ExcelJS.Workbook();
    let sheet = workbook.addWorksheet('C1');
    sheet.views = [
        { zoomScale: 100 }
    ];

    let slex = new Slex(workbook)

    sheet.pageSetup.printArea = 'A1:N61';
    sheet.pageSetup.fitToPage = true
    sheet.pageSetup.paperSize = 9 // A4
    sheet.pageSetup.margins = {
        left: 0.15, right: 0,
        top: 0.25, bottom: 0.12,
        header: 0.24, footer: 0.12
    };

    // A1
    sheet.mergeCells('A1:N1');
    cell = sheet.getCell('A1')
    slex.setCell(cell).value(`CS Form No. 212`).align('top').align('left').font('Calibri').fontSize(11).bold(true).italic(true).border('thin', 'thin', '', 'thin')


    // A2
    sheet.mergeCells('A2:N2');
    cell = sheet.getCell('A2')
    slex.setCell(cell).value(`Revised 2017`).align('top').align('left').font('Calibri').fontSize(9).bold(true).italic(true).border('', 'thin', '', 'thin')


    sheet.mergeCells('A3:N3');
    cell = sheet.getCell('A3')
    slex.setCell(cell).value(`PERSONAL DATA SHEET`).align('top').align('center').font('Arial Black').fontSize(22).bold(true).border('', 'thin', '', 'thin')



    // A4
    sheet.mergeCells('A4:N4');
    cell = sheet.getCell('A4')
    slex.setCell(cell).value(`WARNING: Any misrepresentation made in the Personal Data Sheet and the Work Experience Sheet shall cause the filing of administrative/criminal case/s against the person concerned.`).align('top').align('left').wrapText(true).font('Arial').fontSize(8).bold(true).italic(true).border('', 'thin', '', 'thin')


    sheet.mergeCells('A5:N5');
    cell = sheet.getCell('A5')
    slex.setCell(cell).value(`READ THE ATTACHED GUIDE TO FILLING OUT THE PERSONAL DATA SHEET (PDS) BEFORE ACCOMPLISHING THE PDS FORM.`).align('top').align('left').wrapText(true).font('Arial').fontSize(8).bold(true).italic(true).border('', 'thin', '', 'thin')


    sheet.mergeCells('A7:J7');
    cell = sheet.getCell('A7')
    cell.value = {
        'richText': [
            { 'font': { 'size': 9, 'color': colors.black, 'name': 'Arial Narrow', 'family': 2, 'scheme': 'none' }, 'text': 'Print legibly. Tick appropriate boxes [    ] and use separate sheet if necessary. Indicate N/A if not applicable.  ' },
            { 'font': { 'bold': true, 'size': 9, 'color': colors.black, 'name': 'Arial Narrow', 'scheme': 'none' }, 'text': 'DO NOT ABBREVIATE' },
        ]
    };
    slex.setCell(cell).border('', '', '', 'thin')



    cell = sheet.getCell('K7')
    slex.setCell(cell).value(`1. CS ID No.`).align('middle').align('left').font('Arial Narrow').fontSize(8).border('thin', 'thin', 'thin', 'thin').bgFill('00969696')

    sheet.mergeCells('L7:N7');
    cell = sheet.getCell('L7')
    slex.setCell(cell).value(`(Do not fill up. For CSC use only)`).align('middle').align('right').font('Arial Narrow').fontSize(8).border('thin', 'thin', 'thin', 'thin')

    sheet.mergeCells('A9:N9');
    cell = sheet.getCell('A9')
    slex.setCell(cell).value(`I. PERSONAL INFORMATION`).align('top').align('left').font('Arial Narrow').fontSize(11).bold(true).italic(true).fontColor('FFFFFFFF').border('thin', 'thin', 'thin', 'thin').bgFill('00969696')


    sheet.mergeCells('A10:A12');
    cell = sheet.getCell('A10')
    slex.setCell(cell).value(`2.`).align('top').align('left').font('Arial Narrow').fontSize(8).border('', '', '', 'thin').bgFill('00C0C0C0').border('', '', 'thin', 'thin')

    column = sheet.getColumn('A')
    column.width = cell.value.toString().length

    // surname
    sheet.mergeCells('B10:C10');
    cell = sheet.getCell('B10')
    slex.setCell(cell).value(`SURNAME`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0')

    sheet.mergeCells('D10:N10');
    cell = sheet.getCell('D10')
    slex.setCell(cell).value(`${employee.lastName}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')


    //fname
    sheet.mergeCells('B11:C11');
    cell = sheet.getCell('B11')
    slex.setCell(cell).value(`FIRST NAME`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0')


    sheet.mergeCells('D11:K11');
    cell = sheet.getCell('D11')
    slex.setCell(cell).value(`${employee.firstName}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')


    // suffix
    sheet.mergeCells('L11:N11');
    cell = sheet.getCell('N11')
    cell.value = {
        'richText': [
            { 'font': { 'size': 7, 'color': colors.black, 'name': 'Arial Narrow', 'family': 2, 'scheme': 'none' }, 'text': 'NAME EXTENSION (JR., SR)' },
            { 'font': { 'bold': true, 'size': 11, 'color': colors.black, 'name': 'Arial', 'scheme': 'none' }, 'text': ` ${employee.suffix}` },
        ]
    };
    slex.setCell(cell).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(7).bgFill('00C0C0C0').border('', 'thin', '', '')


    // middle
    sheet.mergeCells('B12:C12');
    cell = sheet.getCell('B12')
    slex.setCell(cell).value(`MIDDLE NAME`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', '')


    sheet.mergeCells('D12:N12');
    cell = sheet.getCell('D12')
    cell.value = `${employee.middleName}`;
    slex.setCell(cell).value(`${employee.middleName}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // bday
    sheet.mergeCells('A13:A14');
    cell = sheet.getCell('A13')
    cell.value = `3.`;
    slex.setCell(cell).value(`3.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

    // bday
    sheet.mergeCells('B13:C14');
    cell = sheet.getCell('B13')
    slex.setCell(cell).value(`DATE OF BIRTH\n(mm/dd/yyyy)`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', '')

    sheet.mergeCells('D13:F14');
    cell = sheet.getCell('D13')
    slex.setCell(cell).value(`${moment(employee.birthDate).format('MM/DD/YYYY')}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')


    // CITIZENSHIP
    sheet.mergeCells('G13:I14');
    cell = sheet.getCell('G13')
    slex.setCell(cell).value(`16. CITIZENSHIP`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', '', '')

    sheet.mergeCells('J13:K14');
    cell = sheet.getCell('J13')
    chk = (employee.personal.citizenship.includes('filipino')) ? `✓` : '     '
    slex.setCell(cell).value(`[${chk}] Filipino`).align('top').align('center').font('Arial Narrow').fontSize(10)

    sheet.mergeCells('L13:N13');
    cell = sheet.getCell('L13')
    chk = (employee.personal.citizenship.includes('dual')) ? `✓` : '     '
    slex.setCell(cell).value(`[${chk}] Dual Citizenship`).align('top').align('left').font('Arial Narrow').fontSize(10).border('', 'thin', '', '')

    sheet.mergeCells('L14:N14');
    cell = sheet.getCell('L14')
    chk = (employee.personal.citizenshipSource.includes('birth')) ? `✓` : '     '
    chk2 = (employee.personal.citizenshipSource.includes('naturalization')) ? `✓` : '     '
    value = `[${chk}] by Birth      [${chk2}] by Naturalization`
    slex.setCell(cell).value(value).align('top').align('center').font('Arial Narrow').fontSize(10).border('', 'thin', '', '')

    sheet.mergeCells('G15:I15');
    cell = sheet.getCell('G15')
    slex.setCell(cell).value(`If holder of dual citizenship,`).align('top').align('center').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', '', '')

    sheet.mergeCells('G16:I16');
    cell = sheet.getCell('G16')
    slex.setCell(cell).value(`please indicate the details.`).align('top').align('center').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    sheet.mergeCells('L15:N15');
    cell = sheet.getCell('L15')
    slex.setCell(cell).value(`Pls. indicate country:`).align('top').align('left').font('Arial Narrow').fontSize(10).border('', 'thin', '', '')

    sheet.mergeCells('J16:N16');
    cell = sheet.getCell('J16')
    value = (employee.personal.citizenship.includes('dual')) ? employee.personal.citizenshipCountry : '     '
    slex.setCell(cell).value(value).align('top').align('center').font('Arial').fontSize(12).bold(true).border('', 'thin', '', '')

    // bplace
    cell = sheet.getCell('A15')
    cell.value = `4.`;
    slex.setCell(cell).value(`4.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

    sheet.mergeCells('B15:C15');
    cell = sheet.getCell('B15')
    slex.setCell(cell).value(`PLACE OF BIRTH`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', '')

    sheet.mergeCells('D15:F15');
    cell = sheet.getCell('D15')
    slex.setCell(cell).value(`${employee.personal.birthPlace}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    sheet.getRow(4).height = 21.75
    sheet.getRow(6).height = 1
    sheet.getRow(8).height = 1
    sheet.getRow(10).height = 22.5
    sheet.getRow(11).height = 22.5
    sheet.getRow(12).height = 22.5
    sheet.getRow(37).height = 26
    sheet.getRow(36).height = 24

    // sex
    cell = sheet.getCell('A16')
    slex.setCell(cell).value(`5.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

    sheet.mergeCells('B16:C16');
    cell = sheet.getCell('B16')
    slex.setCell(cell).value(`SEX`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', '')

    cell = sheet.getCell('D16')
    chk = (employee.gender == 'M') ? `✓` : '     '
    slex.setCell(cell).value(`[${chk}] Male`).align('middle').align('left').font('Arial Narrow').fontSize(10).border('', '', 'thin', 'thin')
    sheet.getColumn('D').width = 15

    sheet.mergeCells('E16:F16');
    cell = sheet.getCell('E16')
    chk2 = (employee.gender == 'F') ? `✓` : '     '
    slex.setCell(cell).value(`[${chk2}] Female`).align('middle').align('left').font('Arial Narrow').fontSize(10).border('thin', 'thin', 'thin', '')



    // civil st
    sheet.mergeCells('A17:A21');
    cell = sheet.getCell('A17')
    slex.setCell(cell).value(`6.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', '', 'thin')

    sheet.mergeCells('B17:C21');
    cell = sheet.getCell('B17')
    slex.setCell(cell).value(`CIVIL STATUS`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0')


    cell = sheet.getCell('D17');
    chk = (employee.civilStatus == 'Single') ? `✓` : '     '
    slex.setCell(cell).value(`[${chk}] Single`).align('middle').align('left').font('Arial Narrow').fontSize(10).border('', '', '', 'thin')
    sheet.mergeCells('E17:F17');
    cell = sheet.getCell('E17');
    chk2 = (employee.civilStatus == 'Married') ? `✓` : '     '
    slex.setCell(cell).value(`[${chk2}] Married`).align('middle').align('left').font('Arial Narrow').fontSize(10).border('', 'thin', '', '')


    cell = sheet.getCell('D18');
    chk = (employee.civilStatus == 'Widowed') ? `✓` : '     '
    slex.setCell(cell).value(`[${chk}] Widowed`).align('middle').align('left').font('Arial Narrow').fontSize(10).border('', '', '', 'thin')
    sheet.mergeCells('E18:F18');
    cell = sheet.getCell('E18');
    chk2 = (employee.civilStatus == 'Separated') ? `✓` : '     '
    slex.setCell(cell).value(`[${chk2}] Separated`).align('middle').align('left').font('Arial Narrow').fontSize(10).border('', 'thin', '', '')

    sheet.mergeCells('D19:F21');
    cell = sheet.getCell('D19');
    chk = (employee.civilStatus == 'Others') ? `✓` : '     '
    slex.setCell(cell).value(`[${chk}] Others`).align('top').align('left').font('Arial Narrow').fontSize(10).border('', 'thin', 'thin', 'thin')


    // residential addr
    sheet.mergeCells('G17:H23');
    cell = sheet.getCell('G17')
    slex.setCell(cell).value(`17. RESIDENTIAL ADDRESS`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', '', '')

    // unit
    sheet.mergeCells('I17:K17');
    cell = sheet.getCell('I17')
    slex.setCell(cell).value(`${lodash.get(employee, 'addresses[1].unit', '')}`).align('bottom').align('center').font('Arial Narrow').fontSize(8).bold(true).border('thin', '', '', '')

    sheet.mergeCells('I18:K18');
    cell = sheet.getCell('I18')
    slex.setCell(cell).value(`House/Block/Lot No.`).align('top').align('center').font('Arial Narrow').italic(true).fontSize(8).border('thin', '', '', '')

    // street
    sheet.mergeCells('L17:N17');
    cell = sheet.getCell('L17')
    slex.setCell(cell).value(`${lodash.get(employee, 'addresses[1].street', '')}`).align('bottom').align('center').font('Arial Narrow').bold(true).fontSize(8).border('thin', 'thin', '', '')

    sheet.mergeCells('L18:N18');
    cell = sheet.getCell('L18')
    slex.setCell(cell).value(`Street`).align('top').align('center').font('Arial Narrow').italic(true).fontSize(8).border('thin', 'thin', '', '')

    // village
    sheet.mergeCells('I19:K20');
    cell = sheet.getCell('I19')
    slex.setCell(cell).value(`${lodash.get(employee, 'addresses[1].village', '')}`).align('bottom').align('center').font('Arial Narrow').fontSize(8).bold(true).border('thin', '', '', '')

    sheet.mergeCells('I21:K21');
    cell = sheet.getCell('I21')
    slex.setCell(cell).value(`Subdivision/Village`).align('top').align('center').font('Arial Narrow').italic(true).fontSize(8).border('thin', '', '', '')

    // brgy
    sheet.mergeCells('L19:N20');
    cell = sheet.getCell('L19')
    slex.setCell(cell).value(`${lodash.get(employee, 'addresses[1].brgy', '')}`).align('bottom').align('center').font('Arial Narrow').fontSize(8).bold(true).border('thin', 'thin', '', '')

    sheet.mergeCells('L21:N21');
    cell = sheet.getCell('L21')
    slex.setCell(cell).value(`Barangay`).align('top').align('center').font('Arial Narrow').italic(true).fontSize(8).border('thin', 'thin', '', '')

    // city mun
    sheet.mergeCells('I22:K22');
    cell = sheet.getCell('I22')
    slex.setCell(cell).value(`${lodash.get(employee, 'addresses[1].cityMun', '')}`).align('bottom').align('center').font('Arial Narrow').fontSize(8).bold(true).border('thin', '', '', '')

    sheet.mergeCells('I23:K23');
    cell = sheet.getCell('I23')
    slex.setCell(cell).value(`City/Municipality`).align('top').align('center').font('Arial Narrow').italic(true).fontSize(8).border('thin', '', '', '')

    // province
    sheet.mergeCells('L22:N22');
    cell = sheet.getCell('L22')
    slex.setCell(cell).value(`${lodash.get(employee, 'addresses[1].province', '')}`).align('bottom').align('center').font('Arial Narrow').fontSize(8).bold(true).border('thin', 'thin', '', '')

    sheet.mergeCells('L23:N23');
    cell = sheet.getCell('L23')
    slex.setCell(cell).value(`Province`).align('top').align('center').font('Arial Narrow').italic(true).fontSize(8).border('thin', 'thin', '', '')

    // zip
    sheet.mergeCells('G24:H24');
    cell = sheet.getCell('G24')
    slex.setCell(cell).value(`ZIP CODE`).align('top').align('center').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', '')

    sheet.mergeCells('I24:N24');
    cell = sheet.getCell('I24')
    slex.setCell(cell).value(`${lodash.get(employee, 'addresses[1].zipCode', '')}`).align('middle').align('center').font('Arial Narrow').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')


    // permanent addr
    sheet.mergeCells('G25:H30');
    cell = sheet.getCell('G25')
    slex.setCell(cell).value(`18. PERMANENT ADDRESS`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', '', '')

    // unit
    sheet.mergeCells('I25:K25');
    cell = sheet.getCell('I25')
    slex.setCell(cell).value(`${lodash.get(employee, 'addresses[0].unit', '')}`).align('bottom').align('center').font('Arial Narrow').fontSize(8).bold(true).border('thin', '', '', '')

    sheet.mergeCells('I26:K26');
    cell = sheet.getCell('I26')
    slex.setCell(cell).value(`House/Block/Lot No.`).align('top').align('center').font('Arial Narrow').italic(true).fontSize(8).border('thin', '', '', '')

    // street
    sheet.mergeCells('L25:N25');
    cell = sheet.getCell('L25')
    slex.setCell(cell).value(`${lodash.get(employee, 'addresses[0].street', '')}`).align('bottom').align('center').font('Arial Narrow').bold(true).fontSize(8).border('thin', 'thin', '', '')

    sheet.mergeCells('L26:N26');
    cell = sheet.getCell('L26')
    slex.setCell(cell).value(`Street`).align('top').align('center').font('Arial Narrow').italic(true).fontSize(8).border('thin', 'thin', '', '')

    // village
    sheet.mergeCells('I27:K27');
    cell = sheet.getCell('I27')
    slex.setCell(cell).value(`${lodash.get(employee, 'addresses[0].village', '')}`).align('bottom').align('center').font('Arial Narrow').fontSize(8).bold(true).border('thin', '', '', '')

    sheet.mergeCells('I28:K28');
    cell = sheet.getCell('I28')
    slex.setCell(cell).value(`Subdivision/Village`).align('top').align('center').font('Arial Narrow').italic(true).fontSize(8).border('thin', '', '', '')

    // brgy
    sheet.mergeCells('L27:N27');
    cell = sheet.getCell('L27')
    slex.setCell(cell).value(`${lodash.get(employee, 'addresses[0].brgy', '')}`).align('bottom').align('center').font('Arial Narrow').fontSize(8).bold(true).border('thin', 'thin', '', '')

    sheet.mergeCells('L28:N28');
    cell = sheet.getCell('L28')
    slex.setCell(cell).value(`Barangay`).align('top').align('center').font('Arial Narrow').italic(true).fontSize(8).border('thin', 'thin', '', '')

    // city mun
    sheet.mergeCells('I29:K29');
    cell = sheet.getCell('I29')
    slex.setCell(cell).value(`${lodash.get(employee, 'addresses[0].cityMun', '')}`).align('bottom').align('center').font('Arial Narrow').fontSize(8).bold(true).border('thin', '', '', '')

    sheet.mergeCells('I30:K30');
    cell = sheet.getCell('I30')
    slex.setCell(cell).value(`City/Municipality`).align('top').align('center').font('Arial Narrow').italic(true).fontSize(8).border('thin', '', '', '')

    // province
    sheet.mergeCells('L29:N29');
    cell = sheet.getCell('L29')
    slex.setCell(cell).value(`${lodash.get(employee, 'addresses[0].province', '')}`).align('bottom').align('center').font('Arial Narrow').fontSize(8).bold(true).border('thin', 'thin', '', '')

    sheet.mergeCells('L30:N30');
    cell = sheet.getCell('L30')
    slex.setCell(cell).value(`Province`).align('top').align('center').font('Arial Narrow').italic(true).fontSize(8).border('thin', 'thin', '', '')

    // zip
    sheet.mergeCells('G31:H31');
    cell = sheet.getCell('G31')
    slex.setCell(cell).value(`ZIP CODE`).align('top').align('center').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', '')

    sheet.mergeCells('I31:N31');
    cell = sheet.getCell('I31')
    slex.setCell(cell).value(`${lodash.get(employee, 'addresses[0].zipCode', '')}`).align('middle').align('center').font('Arial Narrow').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')


    // height
    sheet.mergeCells('A22:A23');
    cell = sheet.getCell('A22')
    slex.setCell(cell).value(`7.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', '', 'thin', 'thin')

    sheet.mergeCells('B22:C23');
    cell = sheet.getCell('B22')
    slex.setCell(cell).value(`HEIGHT (m)`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    sheet.mergeCells('D22:F23');
    cell = sheet.getCell('D22')
    slex.setCell(cell).value(`${employee.personal.height}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // weight
    cell = sheet.getCell('A24')
    slex.setCell(cell).value(`8.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', '', 'thin', 'thin')

    sheet.mergeCells('B24:C24');
    cell = sheet.getCell('B24')
    slex.setCell(cell).value(`WEIGHT (kg)`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    sheet.mergeCells('D24:F24');
    cell = sheet.getCell('D24')
    slex.setCell(cell).value(`${employee.personal.weight}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // blood
    sheet.mergeCells('A25:A26');
    cell = sheet.getCell('A25')
    slex.setCell(cell).value(`9.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', '', 'thin', 'thin')

    sheet.mergeCells('B25:C26');
    cell = sheet.getCell('B25')
    slex.setCell(cell).value(`BLOOD TYPE`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    sheet.mergeCells('D25:F26');
    cell = sheet.getCell('D25')
    slex.setCell(cell).value(`${employee.personal.bloodType}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // gsis
    sheet.mergeCells('A27:A28');
    cell = sheet.getCell('A27')
    slex.setCell(cell).value(`10.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', '', 'thin', 'thin')

    sheet.mergeCells('B27:C28');
    cell = sheet.getCell('B27')
    slex.setCell(cell).value(`GSIS ID NO.`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    sheet.mergeCells('D27:F28');
    cell = sheet.getCell('D27')
    slex.setCell(cell).value(`${employee.personal.gsis}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // pagibig
    sheet.mergeCells('A29:A30');
    cell = sheet.getCell('A29')
    slex.setCell(cell).value(`11.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', '', 'thin', 'thin')

    sheet.mergeCells('B29:C30');
    cell = sheet.getCell('B29')
    slex.setCell(cell).value(`PAG-IBIG ID NO.`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    sheet.mergeCells('D29:F30');
    cell = sheet.getCell('D29')
    slex.setCell(cell).value(`${employee.personal.pagibig}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // philhealth
    cell = sheet.getCell('A31')
    slex.setCell(cell).value(`12.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', '', 'thin', 'thin')

    sheet.mergeCells('B31:C31');
    cell = sheet.getCell('B31')
    slex.setCell(cell).value(`PHILHEALTH NO.`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    sheet.mergeCells('D31:F31');
    cell = sheet.getCell('D31')
    slex.setCell(cell).value(`${employee.personal.philHealth}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // sss
    cell = sheet.getCell('A32')
    slex.setCell(cell).value(`13.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', '', 'thin', 'thin')

    sheet.mergeCells('B32:C32');
    cell = sheet.getCell('B32')
    slex.setCell(cell).value(`SSS NO.`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    sheet.mergeCells('D32:F32');
    cell = sheet.getCell('D32')
    slex.setCell(cell).value(`${employee.personal.sss}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // tin
    cell = sheet.getCell('A33')
    slex.setCell(cell).value(`14.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', '', 'thin', 'thin')

    sheet.mergeCells('B33:C33');
    cell = sheet.getCell('B33')
    slex.setCell(cell).value(`TIN NO.`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    sheet.mergeCells('D33:F33');
    cell = sheet.getCell('D33')
    slex.setCell(cell).value(`${employee.personal.tin}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // agency emp
    cell = sheet.getCell('A34')
    slex.setCell(cell).value(`15.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', '', 'thin', 'thin')

    sheet.mergeCells('B34:C34');
    cell = sheet.getCell('B34')
    slex.setCell(cell).value(`AGENCY EMPLOYEE NO.`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    sheet.mergeCells('D34:F34');
    cell = sheet.getCell('D34')
    slex.setCell(cell).value(`${employee.personal.agencyEmployeeNumber}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // telephone
    sheet.mergeCells('G32:H32');
    cell = sheet.getCell('G32')
    slex.setCell(cell).value(`19. TELEPHONE NO.`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    sheet.mergeCells('I32:N32');
    cell = sheet.getCell('I32')
    slex.setCell(cell).value(`${employee.phoneNumber}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // mobile
    sheet.mergeCells('G33:H33');
    cell = sheet.getCell('G33')
    slex.setCell(cell).value(`20. MOBILE NO.`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    sheet.mergeCells('I33:N33');
    cell = sheet.getCell('I33')
    slex.setCell(cell).value(`${employee.mobileNumber}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // email
    sheet.mergeCells('G34:H34');
    cell = sheet.getCell('G34')
    slex.setCell(cell).value(`21. E-MAIL ADDRESS (if any)`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    sheet.mergeCells('I34:N34');
    cell = sheet.getCell('I34')
    slex.setCell(cell).value(`${employee.email}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    sheet.mergeCells('A35:N35');
    cell = sheet.getCell('A35')
    slex.setCell(cell).value(`II.  FAMILY BACKGROUND`).align('top').align('left').font('Arial Narrow').fontSize(11).bold(true).italic(true).fontColor('FFFFFFFF').border('thin', 'thin', 'thin', 'thin').bgFill('00969696')

    // II. FAMILY

    cell = sheet.getCell('A36')
    slex.setCell(cell).value(`22.`).align('left').align('middle').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', '', 'thin')
    sheet.mergeCells('A37:A38');
    cell = sheet.getCell('A37')
    slex.setCell(cell).bgFill('00C0C0C0').border('', '', 'thin', 'thin')


    sheet.mergeCells('B36:C36');
    cell = sheet.getCell('B36')
    slex.setCell(cell).value(`SPOUSE'S SURNAME`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0')

    sheet.mergeCells('D36:H36');
    cell = sheet.getCell('D36')
    slex.setCell(cell).value(`${employee.personal.spouse.lastName}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    sheet.mergeCells('B37:C37');
    cell = sheet.getCell('B37')
    slex.setCell(cell).value(`FIRST NAME`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0')

    sheet.mergeCells('D37:F37');
    cell = sheet.getCell('D37')
    slex.setCell(cell).value(`${employee.personal.spouse.firstName}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    //
    sheet.mergeCells('G37:H37');
    cell = sheet.getCell('G37')
    cell.value = {
        'richText': [
            { 'font': { 'size': 7, 'color': colors.black, 'name': 'Arial Narrow', 'family': 2, 'scheme': 'none' }, 'text': 'NAME EXTENSION (JR., SR)' },
            { 'font': { 'bold': true, 'size': 9, 'color': colors.black, 'name': 'Arial', 'scheme': 'none' }, 'text': `\n${employee.personal.spouse.suffix}` },
        ]
    };
    slex.setCell(cell).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(7).bgFill('00C0C0C0').border('', 'thin', '', '')

    sheet.mergeCells('B38:C38');
    cell = sheet.getCell('B38')
    slex.setCell(cell).value(`MIDDLE NAME`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', '')

    sheet.mergeCells('D38:H38');
    cell = sheet.getCell('D38')
    slex.setCell(cell).value(`${employee.personal.spouse.middleName}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    sheet.mergeCells('I36:L36');
    cell = sheet.getCell('I36')
    slex.setCell(cell).value(`23. NAME of CHILDREN  (Write full name and list all)`).align('middle').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    sheet.mergeCells('M36:N36');
    cell = sheet.getCell('M36')
    slex.setCell(cell).value(`DATE OF BIRTH\n(mm/dd/yyyy) `).align('top').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    let offset = 37
    for (x = 0; x < 12; x++) {
        let name = lodash.get(employee, `personal.children[${x}].name`, '')
        let birthDate = lodash.get(employee, `personal.children[${x}].birthDate`, '')

        if (birthDate) {
            birthDate = moment(birthDate).format('MM/DD/YYYY')
        }
        row = offset + x
        sheet.mergeCells(`I${row}:L${row}`);
        cell = sheet.getCell(`I${row}`)
        slex.setCell(cell).value(`${name}`).align('middle').align('left').font('Arial').fontSize(11).bold(true).border('thin', 'thin', 'thin', 'thin')

        sheet.mergeCells(`M${row}:N${row}`);
        cell = sheet.getCell(`M${row}`)
        slex.setCell(cell).value(`${birthDate}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')
    }

    sheet.mergeCells('I49:N49');
    cell = sheet.getCell('I49')
    slex.setCell(cell).value(`(Continue on separate sheet if necessary)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).fontColor('00FF0000').bold(true).italic(true).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    sheet.mergeCells('A59:N59');
    cell = sheet.getCell('A59')
    slex.setCell(cell).value(`(Continue on separate sheet if necessary)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).fontColor('00FF0000').bold(true).italic(true).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    // end children

    cell = sheet.getCell('A39')
    slex.setCell(cell).value(``).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

    sheet.mergeCells('B39:C39');
    cell = sheet.getCell('B39')
    slex.setCell(cell).value(`OCCUPATION`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', '')

    sheet.mergeCells('D39:H39');
    cell = sheet.getCell('D39')
    slex.setCell(cell).value(`${employee.personal.spouse.occupation}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    //
    cell = sheet.getCell('A40')
    slex.setCell(cell).value(``).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

    sheet.mergeCells('B40:C40');
    cell = sheet.getCell('B40')
    slex.setCell(cell).value(`EMPLOYER/BUSINESS NAME`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', '')

    sheet.mergeCells('D40:H40');
    cell = sheet.getCell('D40')
    slex.setCell(cell).value(`${employee.personal.spouse.employerOrBusinessName}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    //
    cell = sheet.getCell('A41')
    slex.setCell(cell).value(``).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

    sheet.mergeCells('B41:C41');
    cell = sheet.getCell('B41')
    slex.setCell(cell).value(`BUSINESS ADDRESS`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', '')

    sheet.mergeCells('D41:H41');
    cell = sheet.getCell('D41')
    slex.setCell(cell).value(`${employee.personal.spouse.businessAddress}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    //
    cell = sheet.getCell('A42')
    slex.setCell(cell).value(``).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

    sheet.mergeCells('B42:C42');
    cell = sheet.getCell('B42')
    slex.setCell(cell).value(`TELEPHONE NO.`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', '')

    sheet.mergeCells('D42:H42');
    cell = sheet.getCell('D42')
    slex.setCell(cell).value(`${employee.personal.spouse.phone}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')


    // 
    cell = sheet.getCell('A43')
    slex.setCell(cell).value(`24.`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', '', 'thin')
    sheet.mergeCells('A44:A45');
    cell = sheet.getCell('A44')
    slex.setCell(cell).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

    sheet.mergeCells('B43:C43');
    cell = sheet.getCell('B43')
    slex.setCell(cell).value(`FATHER'S SURNAME`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0')

    sheet.mergeCells('D43:H43');
    cell = sheet.getCell('D43')
    slex.setCell(cell).value(`${employee.personal.father.lastName}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    sheet.mergeCells('B44:C44');
    cell = sheet.getCell('B44')
    slex.setCell(cell).value(`FIRST NAME`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0')

    sheet.mergeCells('D44:F44');
    cell = sheet.getCell('D44')
    slex.setCell(cell).value(`${employee.personal.father.firstName}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    sheet.mergeCells('G44:H44');
    cell = sheet.getCell('G44')
    cell.value = {
        'richText': [
            { 'font': { 'size': 7, 'color': colors.black, 'name': 'Arial Narrow', 'family': 2, 'scheme': 'none' }, 'text': 'NAME EXTENSION (JR., SR)' },
            { 'font': { 'bold': true, 'size': 9, 'color': colors.black, 'name': 'Arial', 'scheme': 'none' }, 'text': `\n${employee.personal.father.suffix}` },
        ]
    };
    slex.setCell(cell).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(7).bgFill('00C0C0C0').border('', 'thin', '', '')

    sheet.mergeCells('B45:C45');
    cell = sheet.getCell('B45')
    slex.setCell(cell).value(`MIDDLE NAME`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', '')

    sheet.mergeCells('D45:H45');
    cell = sheet.getCell('D45')
    slex.setCell(cell).value(`${employee.personal.father.middleName}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // 
    cell = sheet.getCell('A46')
    slex.setCell(cell).value(`25.`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', '', 'thin')
    sheet.mergeCells('A47:A49');
    cell = sheet.getCell('A47')
    slex.setCell(cell).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

    sheet.mergeCells('B46:H46');
    cell = sheet.getCell('B46')
    slex.setCell(cell).value(`MOTHER'S MAIDEN NAME`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0')

    sheet.mergeCells('B47:C47');
    cell = sheet.getCell('B47')
    slex.setCell(cell).value(`LAST NAME`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0')

    sheet.mergeCells('D47:H47');
    cell = sheet.getCell('D47')
    slex.setCell(cell).value(`${employee.personal.mother.lastName}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    sheet.mergeCells('B48:C48');
    cell = sheet.getCell('B48')
    slex.setCell(cell).value(`FIRST NAME`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0')

    sheet.mergeCells('D48:H48');
    cell = sheet.getCell('D48')
    slex.setCell(cell).value(`${employee.personal.mother.firstName}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    sheet.mergeCells('B49:C49');
    cell = sheet.getCell('B49')
    slex.setCell(cell).value(`MIDDLE NAME`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', '')

    sheet.mergeCells('D49:H49');
    cell = sheet.getCell('D49')
    slex.setCell(cell).value(`${employee.personal.mother.middleName}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // III. EDUCATION
    sheet.mergeCells('A50:N50');
    cell = sheet.getCell('A50')
    slex.setCell(cell).value(`III.  EDUCATIONAL BACKGROUND`).align('top').align('left').font('Arial Narrow').fontSize(11).bold(true).italic(true).fontColor('FFFFFFFF').border('thin', 'thin', 'thin', 'thin').bgFill('00969696')

    sheet.mergeCells('A51:A53');
    cell = sheet.getCell('A51')
    slex.setCell(cell).value(`26.`).align('middle').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

    sheet.mergeCells('B51:C53');
    cell = sheet.getCell('B51')
    slex.setCell(cell).value(`LEVEL`).align('middle').align('center').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    sheet.mergeCells('D51:F53');
    cell = sheet.getCell('D51')
    slex.setCell(cell).value(`NAME OF SCHOOL\n(Write in full)`).align('middle').align('center').font('Arial Narrow').fontSize(8).wrapText(true).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    sheet.mergeCells('G51:I53');
    cell = sheet.getCell('G51')
    slex.setCell(cell).value(`BASIC EDUCATION/DEGREE/COURSE\n(Write in full)`).align('middle').align('center').font('Arial Narrow').fontSize(8).wrapText(true).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    sheet.mergeCells('J51:K52');
    cell = sheet.getCell('J51')
    slex.setCell(cell).value(`PERIOD OF ATTENDANCE`).align('middle').align('center').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    sheet.mergeCells('L51:L53');
    cell = sheet.getCell('L51')
    slex.setCell(cell).value(`HIGHEST LEVEL/UNITS EARNED\n(if not graduated)`).align('middle').align('center').font('Arial Narrow').fontSize(8).wrapText(true).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    sheet.mergeCells('M51:M53');
    cell = sheet.getCell('M51')
    slex.setCell(cell).value(`YEAR GRADUATED`).align('middle').align('center').font('Arial Narrow').fontSize(8).wrapText(true).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    sheet.mergeCells('N51:N53');
    cell = sheet.getCell('N51')
    slex.setCell(cell).value(`SCHOLARSHIP/ ACADEMIC HONORS RECEIVED`).align('middle').align('center').font('Arial Narrow').fontSize(8).wrapText(true).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    cell = sheet.getCell('J53')
    slex.setCell(cell).value(`From`).align('middle').align('center').font('Arial Narrow').fontSize(8).wrapText(true).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    cell = sheet.getCell('K53')
    slex.setCell(cell).value(`To`).align('middle').align('center').font('Arial Narrow').fontSize(8).wrapText(true).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    let printSchool = (row, school, title) => {
        sheet.mergeCells(`A${row}:C${row}`);
        cell = sheet.getCell(`A${row}`)
        slex.setCell(cell).value(`${title}`).align('middle').align('center').font('Arial Narrow').fontSize(8).wrapText(true).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

        sheet.mergeCells(`D${row}:F${row}`);
        cell = sheet.getCell(`D${row}`)
        slex.setCell(cell).value(`${school.name}`).align('middle').align('center').font('Arial').fontSize(10).bold(true).border('thin', 'thin', 'thin', 'thin')

        sheet.mergeCells(`G${row}:I${row}`);
        cell = sheet.getCell(`G${row}`)
        slex.setCell(cell).value(`${school.course}`).align('middle').align('center').font('Arial').fontSize(10).bold(true).border('thin', 'thin', 'thin', 'thin')

        cell = sheet.getCell(`J${row}`)
        date = (school.periodFrom) ? moment(school.periodFrom).format('MM/DD/YYYY') : ''
        slex.setCell(cell).value(`${date}`).align('middle').align('center').font('Arial').fontSize(9).bold(true).border('thin', 'thin', 'thin', 'thin')

        cell = sheet.getCell(`K${row}`)
        date = (school.periodTo) ? moment(school.periodTo).format('MM/DD/YYYY') : ''
        slex.setCell(cell).value(`${date}`).align('middle').align('center').font('Arial').fontSize(9).bold(true).border('thin', 'thin', 'thin', 'thin')

        cell = sheet.getCell(`L${row}`)
        slex.setCell(cell).value(`${school.unitsEarned}`).align('middle').align('center').font('Arial').fontSize(10).bold(true).border('thin', 'thin', 'thin', 'thin')

        cell = sheet.getCell(`M${row}`)
        slex.setCell(cell).value(`${school.yearGraduated}`).align('middle').align('center').font('Arial').fontSize(10).bold(true).border('thin', 'thin', 'thin', 'thin')

        cell = sheet.getCell(`N${row}`)
        slex.setCell(cell).value(`${school.honors}`).align('middle').align('center').font('Arial').fontSize(10).bold(true).border('thin', 'thin', 'thin', 'thin')
    }
    for (let x = 0; x < 5; x++) {
        let school = employee.personal.schools[x]
        if (lodash.get(school, 'level') === 'Elementary') {
            printSchool(54, school, 'ELEMENTARY')
        } else if (lodash.get(school, 'level') === 'Secondary') {
            printSchool(55, school, 'SECONDARY')
        } else if (lodash.get(school, 'level') === 'Vocational') {
            printSchool(56, school, `VOCATIONAL / TRADE COURSE`)
        } else if (lodash.get(school, 'level') === 'College') {
            printSchool(57, school, `COLLEGE`)
        } else if (lodash.get(school, 'level') === 'Graduate Studies') {
            printSchool(58, school, `GRADUATE STUDIES`)
        }
    }
    // 
    sheet.mergeCells('A60:C60');
    cell = sheet.getCell('A60')
    slex.setCell(cell).value(`SIGNATURE`).align('middle').align('center').font('Arial Narrow').fontSize(11).bold(true).italic(true).bgFill('00C0C0C0').border('thin', 'thin', 'thin', 'thin')

    // 

    sheet.mergeCells('D60:I60');
    cell = sheet.getCell('D60')
    slex.setCell(cell).value(``).align('middle').align('center').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    //
    sheet.mergeCells('J60:K60');
    cell = sheet.getCell('J60')
    slex.setCell(cell).value(`DATE`).align('middle').align('center').font('Arial Narrow').fontSize(11).bold(true).italic(true).bgFill('00C0C0C0').border('thin', 'thin', 'thin', 'thin')
    // 

    sheet.mergeCells('L60:N60');
    cell = sheet.getCell('L60')
    slex.setCell(cell).value(``).align('middle').align('center').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    //

    sheet.mergeCells('A61:N61');
    cell = sheet.getCell('A61')
    slex.setCell(cell).value(`CS FORM 212 (Revised 2017), Page 1 of 4`).align('middle').align('right').font('Arial Narrow').fontSize(7).italic(true).border('thin', 'thin', 'thin', 'thin')


    /////////// C2
    sheet = workbook.addWorksheet('C2');
    slex.setSheet(sheet)

    sheet.views = [
        { zoomScale: 100 }
    ];

    column = sheet.getColumn('A')
    column.width = 3

    sheet.getRow(1).height = 1
    sheet.getRow(3).height = 24


    slex.mergeCells('A2:M2')
        .getCell('A2').value(`IV.  CIVIL SERVICE ELIGIBILITY`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(11).bold(true).italic(true).fontColor('FFFFFFFF').border('thin', 'thin', 'thin', 'thin').bgFill('00969696')

    slex.mergeCells('A3:A4')
        .getCell('A4').value(`27.`).align('middle').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

    slex.mergeCells('B3:E4')
        .getCell('B3').value(`CAREER SERVICE/ RA 1080 (BOARD/ BAR) UNDER SPECIAL LAWS/ CES/ CSEE\nBARANGAY ELIGIBILITY / DRIVER'S LICENSE`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    slex.mergeCells('F3:F4')
        .getCell('F3').value(`RATING\n(If Applicable)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    slex.mergeCells('G3:H4')
        .getCell('G3').value(`DATE OF EXAMINATION / CONFERMENT`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    slex.mergeCells('I3:K4')
        .getCell('I3').value(`PLACE OF EXAMINATION / CONFERMENT`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    slex.mergeCells('L3:M4')
        .getCell('L3').value(`LICENSE (if applicable)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    slex.getCell('L4').value(`NUMBER`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')
    slex.getCell('M4').value(`Date of\nValidity`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    offset = 5
    for (x = 0; x < 7; x++) {
        let name = lodash.get(employee, `personal.eligibilities[${x}].name`, '')
        let rating = lodash.get(employee, `personal.eligibilities[${x}].rating`, '')
        let examDate = lodash.get(employee, `personal.eligibilities[${x}].examDate`, '')
        let examPlace = lodash.get(employee, `personal.eligibilities[${x}].examPlace`, '')
        let licenseNumber = lodash.get(employee, `personal.eligibilities[${x}].licenseNumber`, '')
        let licenseValidity = lodash.get(employee, `personal.eligibilities[${x}].licenseValidity`, '')

        if (examDate) {
            examDate = moment(examDate).format('MM/DD/YYYY')
        }
        if (licenseValidity) {
            licenseValidity = moment(licenseValidity).format('MM/DD/YYYY')
        }
        row = offset + x
        slex.mergeCells(`A${row}:E${row}`)
            .getCell(`A${row}`).value(`${name}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`F${row}`).value(`${rating}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

        slex.mergeCells(`G${row}:H${row}`)
            .getCell(`G${row}`).value(`${examDate}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

        slex.mergeCells(`I${row}:K${row}`)
            .getCell(`I${row}`).value(`${examPlace}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`L${row}`).value(`${licenseNumber}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`M${row}`).value(`${licenseValidity}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

    }

    slex.mergeCells('A12:M12').value(`(Continue on separate sheet if necessary)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).fontColor('00FF0000').bold(true).italic(true).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    slex.mergeCells('A13:M13').value(`V. WORK EXPERIENCE`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(11).bold(true).italic(true).fontColor('FFFFFFFF').border('thin', 'thin', '', 'thin').bgFill('00969696')
    slex.mergeCells('A14:M14').value(`(Include private employment. Start from your recent work) Description of duties should be indicated in the attached Work Experience sheet.`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(10).bold(true).italic(true).fontColor('FFFFFFFF').border('', 'thin', 'thin', 'thin').bgFill('00969696')

    slex.mergeCells('A15:A16').value(`28.`).align('middle').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', '', '', 'thin')
    slex.mergeCells('B15:C16').value(`INCLUSIVE DATES\n(mm/dd/yyyy)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', '')
    slex.mergeCells('A17:B17').value(`From`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', 'thin')
    slex.getCell('C17').value(`To`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('thin', 'thin', 'thin', 'thin')

    slex.mergeCells('D15:F17').value(`POSITION TITLE\n(Write in full/Do not abbreviate)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')
    slex.mergeCells('G15:I17').value(`DEPARTMENT / AGENCY / OFFICE / COMPANY\n(Write in full/Do not abbreviate)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')
    slex.mergeCells('J15:J17').value(`MONTHLY SALARY`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(7).bgFill('00C0C0C0').border('', '', 'thin', 'thin')
    slex.mergeCells('K15:K17').value(`SALARY/ JOB/ PAY GRADE (if applicable)& STEP  (Format "00-0")/ INCREMENT`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(6).bgFill('00C0C0C0').border('', '', 'thin', 'thin')
    slex.mergeCells('L15:L17').value(`STATUS OF APPOINTMENT`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(7).bgFill('00C0C0C0').border('', '', 'thin', 'thin')
    slex.mergeCells('M15:M17').value(`GOV'T SERVICE\n(Y/ N)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(7).bgFill('00C0C0C0').border('', 'thin', 'thin', 'thin')

    offset = 18
    for (x = 0; x < 28; x++) {
        let fromDate = lodash.get(employee, `personal.workExperiences[${x}].fromDate`, '')
        let toDate = lodash.get(employee, `personal.workExperiences[${x}].toDate`, '')
        let positionTitle = lodash.get(employee, `personal.workExperiences[${x}].positionTitle`, '')
        let department = lodash.get(employee, `personal.workExperiences[${x}].department`, '')
        let salary = lodash.get(employee, `personal.workExperiences[${x}].salary`, '')
        let payGrade = lodash.get(employee, `personal.workExperiences[${x}].payGrade`, '')
        let appointmentStatus = lodash.get(employee, `personal.workExperiences[${x}].appointmentStatus`, '')
        let isGov = lodash.get(employee, `personal.workExperiences[${x}].isGov`, '')
        if (fromDate) {
            fromDate = moment(fromDate).format('MM/DD/YYYY')
        }
        if (toDate) {
            toDate = moment(toDate).format('MM/DD/YYYY')
        }

        row = offset + x
        slex.mergeCells(`A${row}:B${row}`)
            .value(`${fromDate}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`C${row}`)
            .value(`${toDate}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

        slex.mergeCells(`D${row}:F${row}`)
            .value(`${positionTitle}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

        slex.mergeCells(`G${row}:I${row}`)
            .value(`${department}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`J${row}`)
            .value(`${salary}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`K${row}`)
            .value(`${payGrade}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`L${row}`)
            .value(`${appointmentStatus}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`M${row}`)
            .value(`${isGov}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

    }

    slex.mergeCells('A46:M46').value(`(Continue on separate sheet if necessary)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).fontColor('00FF0000').bold(true).italic(true).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

    slex.mergeCells('A47:C47').value(`SIGNATURE`).align('middle').align('center').font('Arial Narrow').fontSize(11).bold(true).italic(true).bgFill('00C0C0C0').border('thin', 'thin', 'thin', 'thin')

    slex.mergeCells('D47:H47').value(``).align('middle').align('center').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    slex.getCell('I47').value(`DATE`).align('middle').align('center').font('Arial Narrow').fontSize(11).bold(true).italic(true).bgFill('00C0C0C0').border('thin', 'thin', 'thin', 'thin')

    slex.mergeCells('J47:M47').value(``).align('middle').align('center').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    slex.mergeCells('A48:M48').value(`CS FORM 212 (Revised 2017), Page 2 of 4`).align('middle').align('right').font('Arial Narrow').fontSize(7).italic(true).border('thin', 'thin', 'thin', 'thin')


    /////////// C3
    sheet = workbook.addWorksheet('C3');
    slex.setSheet(sheet)

    sheet.views = [
        { zoomScale: 100 }
    ];

    column = sheet.getColumn('A')
    column.width = 3

    sheet.getRow(1).height = 1
    sheet.getRow(3).height = 24

    slex.mergeCells('A2:K2')
        .value(`VI. VOLUNTARY WORK OR INVOLVEMENT IN CIVIC / NON-GOVERNMENT / PEOPLE / VOLUNTARY ORGANIZATION/S`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(11).bold(true).italic(true).fontColor('FFFFFFFF').border('thin', 'thin', 'thin', 'thin').bgFill('00969696')

        .mergeCells('A3:A5')
        .value(`29.`).align('middle').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

        .mergeCells('B3:D5')
        .value(`NAME & ADDRESS OF ORGANIZATION\n(Write in full)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

        .mergeCells('E3:F4')
        .value(`INCLUSIVE DATES\n(mm/dd/yyyy)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

        .getCell('E5')
        .value(`From`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

        .getCell('F5')
        .value(`To`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

        .mergeCells('G3:G5')
        .value(`NUMBER OF HOURS`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

        .mergeCells('H3:K5')
        .value(`POSITION / NATURE OF WORK`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    offset = 6
    for (x = 0; x < 7; x++) {
        let o = lodash.get(employee, `personal.voluntaryWorks[${x}]`)
        row = offset + x

        slex.mergeCells(`A${row}:D${row}`)
            .value(`${lodash.get(o, 'name', '')}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`E${row}`)
            .value(`${lodash.get(o, 'fromDate', '')}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`F${row}`)
            .value(`${lodash.get(o, 'toDate', '')}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`G${row}`)
            .value(`${lodash.get(o, 'hours', '')}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .mergeCells(`H${row}:K${row}`)
            .value(`${lodash.get(o, 'position', '')}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

    }

    slex.mergeCells('A13:K13')
        .value(`(Continue on separate sheet if necessary)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).fontColor('00FF0000').bold(true).italic(true).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

        .mergeCells('A14:K14')
        .value(`VII.  LEARNING AND DEVELOPMENT (L&D) INTERVENTIONS/TRAINING PROGRAMS ATTENDED`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(11).bold(true).italic(true).fontColor('FFFFFFFF').border('thin', 'thin', 'thin', 'thin').bgFill('00969696')

        .mergeCells('A15:A17')
        .value(`30.`).align('middle').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

        .mergeCells('B15:D17')
        .value(`TITLE OF LEARNING AND DEVELOPMENT INTERVENTIONS/TRAINING PROGRAMS\n(Write in full)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

        .mergeCells('E15:F16')
        .value(`INCLUSIVE DATES OF ATTENDANCE\n(mm/dd/yyyy)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

        .getCell('E17')
        .value(`From`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

        .getCell('F17')
        .value(`To`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

        .mergeCells('G15:G17')
        .value(`NUMBER OF HOURS`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

        .mergeCells('H15:H17')
        .value(`Type of LD\n( Managerial/ Supervisory/\nTechnical/etc)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

        .mergeCells('I15:K17')
        .value(` CONDUCTED/ SPONSORED BY\n(Write in full)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

    offset = 18
    for (x = 0; x < 21; x++) {
        let o = lodash.get(employee, `personal.trainings[${x}]`)
        row = offset + x

        slex.mergeCells(`A${row}:D${row}`)
            .value(`${lodash.get(o, 'name', '')}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`E${row}`)
            .value(`${lodash.get(o, 'fromDate', '')}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`F${row}`)
            .value(`${lodash.get(o, 'toDate', '')}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`G${row}`)
            .value(`${lodash.get(o, 'hours', '')}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .getCell(`H${row}`)
            .value(`${lodash.get(o, 'type', '')}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

            .mergeCells(`I${row}:K${row}`)
            .value(`${lodash.get(o, 'sponsor', '')}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

    }

    slex.mergeCells('A39:K39')
        .value(`(Continue on separate sheet if necessary)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).fontColor('00FF0000').bold(true).italic(true).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

        // 
        .mergeCells('A40:K40')
        .value(`VIII.  OTHER INFORMATION`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(11).bold(true).italic(true).fontColor('FFFFFFFF').border('thin', 'thin', 'thin', 'thin').bgFill('00969696')

        .getCell('A41')
        .value(`31.`).align('middle').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

        .getCell('B41')
        .value(`SPECIAL SKILLS and HOBBIES`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

        .getCell('C41')
        .value(`32.`).align('middle').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

        .mergeCells('D41:H41')
        .value(`NON-ACADEMIC DISTINCTIONS / RECOGNITION\n(Write in full)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')

        .getCell('I41')
        .value(`33.`).align('middle').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', 'thin', 'thin')

        .mergeCells('J41:K41')
        .value(`MEMBERSHIP IN ASSOCIATION/ORGANIZATION\n(Write in full)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', 'thin', '')


    offset = 42
    for (x = 0; x < 7; x++) {
        let o = lodash.get(employee, `personal.extraCurriculars[${x}]`)
        row = offset + x

        if (lodash.get(o, 'type') == 'skillHobbies') {

            slex.mergeCells(`A${row}:B${row}`)
                .value(`${lodash.get(o, 'detail', '')}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

        } else {

            slex.mergeCells(`A${row}:B${row}`)
                .value(``).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

        }
    }
    for (x = 0; x < 7; x++) {
        let o = lodash.get(employee, `personal.extraCurriculars[${x}]`)
        row = offset + x

        if (lodash.get(o, 'type') == 'nonAcademic') {

            slex.mergeCells(`C${row}:H${row}`)
                .value(`${lodash.get(o, 'detail', '')}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

        } else {

            slex.mergeCells(`C${row}:H${row}`)
                .value(``).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

        }
    }
    for (x = 0; x < 7; x++) {
        let o = lodash.get(employee, `personal.extraCurriculars[${x}]`)
        row = offset + x

        if (lodash.get(o, 'type') == 'organization') {

            slex.mergeCells(`I${row}:K${row}`)
                .value(`${lodash.get(o, 'detail', '')}`).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

        } else {

            slex.mergeCells(`I${row}:K${row}`)
                .value(``).align('middle').align('left').font('Arial').fontSize(8).bold(true).border('thin', 'thin', 'thin', 'thin')

        }
    }

    slex.mergeCells('A49:K49')
        .value(`(Continue on separate sheet if necessary)`).align('middle').align('center').wrapText(true).font('Arial Narrow').fontSize(8).fontColor('00FF0000').bold(true).italic(true).bgFill('00C0C0C0').border('thin', 'thin', 'thin', '')

        .mergeCells('A50:B50')
        .value(`SIGNATURE`).align('middle').align('center').font('Arial Narrow').fontSize(11).bold(true).italic(true).bgFill('00C0C0C0').border('thin', 'thin', 'thin', 'thin')

        .mergeCells('C50:F50')
        .value(``).align('middle').align('center').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

        .mergeCells('G50:H50')
        .value(`DATE`).align('middle').align('center').font('Arial Narrow').fontSize(11).bold(true).italic(true).bgFill('00C0C0C0').border('thin', 'thin', 'thin', 'thin')

        .mergeCells('I50:K50')
        .value(``).align('middle').align('center').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

        .mergeCells('A51:K51')
        .value(`CS FORM 212 (Revised 2017), Page 3 of 4`).align('middle').align('right').font('Arial Narrow').fontSize(7).italic(true).border('thin', 'thin', 'thin', 'thin')


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

let templateCos = async (payroll) => {
    const workbook = new ExcelJS.Workbook();
    let sheet = workbook.addWorksheet('igp');
    sheet.views = [
        { zoomScale: 80 }
    ];

    let slex = new Slex(workbook)
    slex.setSheet(sheet)

    // merge a range of cells
    slex.mergeCells('A1:Y1')
        .value('PAYROLL').align('bottom').align('center').font('Arial').fontSize(20).bold(true)

    slex.mergeCells('A2:Y2')
        .value(`Salary for the period ${moment(payroll.dateStart).format('MMMM DD')} - ${moment(payroll.dateEnd).format('DD, YYYY')}`).align('bottom').align('center').font('Arial').fontSize(10).bold(true)

    slex.mergeCells('B3:C3')
        .value(`Entity Name: GSC`).align('bottom').align('left').font('Arial').fontSize(11).bold(true)

    slex.mergeCells('B4:C4')
        .value(`Fund Cluster: `).align('bottom').align('left').font('Arial').fontSize(11).bold(true)


    // sheet.mergeCells('A5:K5');
    slex.mergeCells('A5:R5')
        .value(`We acknowledge receipt of cash shown opposite our name as full compensation for services rendered for the period covered.`)
        .align('bottom').font('Arial').fontSize(10)

    slex.mergeCells('A6:A8')
        .value(`NO.`).align('middle').align('center').font('Arial').fontSize(10).bold(true)

    slex.mergeCells('B6:B8')
        .value(`Source of Fund`).align('middle').align('center').font('Arial').fontSize(10).bold(true)

    slex.mergeCells('C6:C8')
        .value(`NAME`).align('middle').align('center').font('Arial').fontSize(11).bold(true)

    slex.mergeCells('D6:D8')
        .value(`POSITION`).align('middle').align('center').font('Arial').fontSize(11).bold(true)

    slex.mergeCells('E6:E8')
        .value(`DAILY/ \nMONTHLY \nWAGE`).align('middle').align('center').font('Arial').fontSize(11).bold(true).wrapText(true)

    slex.mergeCells('F6:K8')
        .value(`No. of Days Rendered`).align('middle').align('center').font('Arial').fontSize(11).bold(true).wrapText(true)

    slex.mergeCells('L6:L8')
        .value(`Gross Amount`).align('middle').align('center').font('Arial').fontSize(11).bold(true).wrapText(true)

    slex.mergeCells('M6:M8')
        .value(`5% premium\nJune 1 - 15, 2021`).align('middle').align('center').font('Arial').fontSize(11).bold(true).wrapText(true)

    slex.mergeCells('N6:N8')
        .value(`Total`).align('middle').align('center').font('Arial').fontSize(11).bold(true).wrapText(true)

    slex.mergeCells('O6:U6')
        .value(`Deductions`).align('middle').align('center').font('Arial').fontSize(11).bold(true).wrapText(true)
    slex.mergeCells('O7:Q7')
        .value(`Tax`).align('middle').align('center').font('Arial').fontSize(11).bold(true).wrapText(true)

    let offset = 10
    payroll.rows.forEach((row, i) => {

        slex.getCell(`A${offset + i}`)
            .value(i + 1).font('Arial').fontSize(14).align('bottom').align('center')

        slex.getCell(`B${offset + i}`)
            .value(`${row.employment.fundSource}`).font('Arial').fontSize(14)

        slex.getCell(`C${offset + i}`)
            .value(`${row.employee.lastName}, ${row.employee.firstName}`).font('Arial').fontSize(14)

        slex.getCell(`D${offset + i}`)
            .value(`${row.employment.position}`).font('Arial').fontSize(14).align('center')

        slex.getCell(`E${offset + i}`)
            .value(currency(row.employment.salary)).font('Arial').fontSize(14).numFmt('0.00')

        slex.getCell(`F${offset + i}`)
            .value(lodash.get(row, 'timeRecord.renderedDays', 0)).font('Arial').fontSize(14).align('center').align('bottom')
        slex.getCell(`G${offset + i}`)
            .value(`days`).font('Arial').fontSize(14).align('center').align('bottom')

        slex.getCell(`H${offset + i}`)
            .value(lodash.get(row, 'timeRecord.renderedHours', 0)).font('Arial').fontSize(14).align('center').align('bottom')
        slex.getCell(`I${offset + i}`)
            .value(`hrs`).font('Arial').fontSize(14).align('center').align('bottom')

        slex.getCell(`J${offset + i}`)
            .value(lodash.get(row, 'timeRecord.renderedMinutes', 0)).font('Arial').fontSize(14).align('center').align('bottom')
        slex.getCell(`K${offset + i}`)
            .value(`mins`).font('Arial').fontSize(14).align('center').align('bottom')

        //=F10*E10+H10*E10/8+J10*E10/8/60
        slex.getCell(`L${offset + i}`)
            .value({
                formula: `F${10 + i}*E${10 + i}+H${10 + i}*E${10 + i}/8+J${10 + i}*E${10 + i}/8/60`,
                result: parseFloat(row.computed.amountWorked.toFixed(2))
            }).font('Arial').fontSize(14).numFmt('0.00')

    })

    // sheet.columns.forEach(function (column, i) {
    //     if (![0].includes(i)) {
    //         var maxLength = 0;

    //         column.eachCell({ includeEmpty: false }, function (cell, rowNumber) {
    //             if (rowNumber > 5) {
    //                 var columnLength = cell.value ? cell.value.toString().length : 10;
    //                 if (columnLength > maxLength) {
    //                     maxLength = columnLength;
    //                 }
    //             }
    //         });
    //         column.width = maxLength < 10 ? 10 : maxLength;
    //     }
    // });

    return workbook

}
module.exports = {
    templateHdf: templateHdf,
    templateCos: templateCos,
    templateJocos: templateJocos,
    templatePds: templatePds,
}