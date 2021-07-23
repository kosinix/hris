//// Core modules

//// External modules
const ExcelJS = require('exceljs');
const lodash = require('lodash')
const moment = require('moment')

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
    setCell(cell) {
        this.cell = cell
        return this
    }
    value(s) {
        this.cell.value = s
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

    await workbook.xlsx.writeFile('excel.xlsx');
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
    slex.setCell(cell).value(`2.`).align('top').align('left').font('Arial Narrow').fontSize(8).border('', '', '', 'thin').bgFill('00C0C0C0')

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
    slex.setCell(cell).value(`MIDDLE NAME`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0')


    sheet.mergeCells('D12:N12');
    cell = sheet.getCell('D12')
    cell.value = `${employee.middleName}`;
    slex.setCell(cell).value(`${employee.middleName}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    // bday
    sheet.mergeCells('A13:A14');
    cell = sheet.getCell('A13')
    cell.value = `3.`;
    slex.setCell(cell).value(`3.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', '', 'thin')

    // bday
    sheet.mergeCells('B13:C14');
    cell = sheet.getCell('B13')
    slex.setCell(cell).value(`DATE OF BIRTH\n(mm/dd/yyyy)`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0')

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
    slex.setCell(cell).value(`please indicate the details.`).align('top').align('center').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', 'thin', '', '')

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
    slex.setCell(cell).value(`4.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', '', 'thin')

    sheet.mergeCells('B15:C15');
    cell = sheet.getCell('B15')
    slex.setCell(cell).value(`PLACE OF BIRTH`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0')

    sheet.mergeCells('D15:F15');
    cell = sheet.getCell('D15')
    slex.setCell(cell).value(`${employee.personal.birthPlace}`).align('middle').align('left').font('Arial').fontSize(12).bold(true).border('thin', 'thin', 'thin', 'thin')

    sheet.getRow(4).height = 21.75
    sheet.getRow(6).height = 1
    sheet.getRow(8).height = 1
    sheet.getRow(10).height = 22.5
    sheet.getRow(11).height = 22.5
    sheet.getRow(12).height = 22.5

    // sex
    cell = sheet.getCell('A16')
    slex.setCell(cell).value(`5.`).align('top').align('left').font('Arial Narrow').fontSize(8).bgFill('00C0C0C0').border('', '', '', 'thin')

    sheet.mergeCells('B16:C16');
    cell = sheet.getCell('B16')
    slex.setCell(cell).value(`SEX`).align('top').align('left').wrapText(true).font('Arial Narrow').fontSize(8).bgFill('00C0C0C0')

    sheet.mergeCells('D16:F16');
    cell = sheet.getCell('D16')
    chk = (employee.gender == 'M') ? `✓` : '     '
    chk2 = (employee.gender == 'F') ? `✓` : '     '
    slex.setCell(cell).value(`[${chk}] Male          [${chk2}] Female`).align('middle').align('left').font('Arial Narrow').fontSize(10).border('thin', 'thin', 'thin', 'thin')


    return workbook
}

module.exports = {
    templateJocos: templateJocos,
    templatePds: templatePds,
}