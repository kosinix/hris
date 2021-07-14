//// Core modules

//// External modules
const ExcelJS = require('exceljs');
const moment = require('moment')

//// Modules


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
        sheet.getCell(cellRef).value = `Catering`
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
    const workbook = new ExcelJS.Workbook();
    let sheet = workbook.addWorksheet('C1');
    let row = null
    let cell = null
    let black = { argb: '00000000' }
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

    // A1
    sheet.mergeCells('A1:N1');
    cell = sheet.getCell('A1')
    cell.value = 'CS Form No. 212';
    cell.alignment = {
        vertical: 'top',
        horizontal: 'left'
    };
    cell.font = {
        name: 'Calibri',
        size: 11,
        bold: true,
        italic: true,
    };

    // A2
    sheet.mergeCells('A2:N2');
    cell = sheet.getCell('A2')
    cell.value = 'Revised 2017';
    cell.alignment = {
        vertical: 'top',
        horizontal: 'left'
    };
    cell.font = {
        name: 'Calibri',
        size: 9,
        bold: true,
        italic: true,
    };

    sheet.mergeCells('A3:N3');
    cell = sheet.getCell('A3')
    cell.value = 'PERSONAL DATA SHEET';
    cell.alignment = {
        vertical: 'top',
        horizontal: 'center'
    };
    cell.font = {
        name: 'Arial Black',
        size: 22,
        bold: true,
    };


    // A4
    sheet.mergeCells('A4:N4');
    cell = sheet.getCell('A4')
    cell.value = 'WARNING: Any misrepresentation made in the Personal Data Sheet and the Work Experience Sheet shall cause the filing of administrative/criminal case/s against the person concerned.';
    cell.alignment = {
        vertical: 'top',
        horizontal: 'left',
        wrapText: true
    };
    cell.font = {
        name: 'Arial',
        size: 8,
        bold: true,
        italic: true,
    };

    sheet.mergeCells('A5:N5');
    cell = sheet.getCell('A5')
    cell.value = 'READ THE ATTACHED GUIDE TO FILLING OUT THE PERSONAL DATA SHEET (PDS) BEFORE ACCOMPLISHING THE PDS FORM.';
    cell.alignment = {
        vertical: 'top',
        horizontal: 'left'
    };
    cell.font = {
        name: 'Arial',
        size: 8,
        bold: true,
        italic: true,
    };



    sheet.mergeCells('A7:J7');
    cell = sheet.getCell('A7')
    cell.value = {
        'richText': [
            { 'font': { 'size': 9, 'color': black, 'name': 'Arial Narrow', 'family': 2, 'scheme': 'none' }, 'text': 'Print legibly. Tick appropriate boxes [    ] and use separate sheet if necessary. Indicate N/A if not applicable.  ' },
            { 'font': { 'bold': true, 'size': 9, 'color': black, 'name': 'Arial Narrow', 'scheme': 'none' }, 'text': 'DO NOT ABBREVIATE' },
        ]
    };
    cell.font = {
        name: 'Arial Narrow',
        size: 9,
    };

    cell = sheet.getCell('K7')
    cell.value = `1. CS ID No.`;
    cell.alignment = {
        vertical: 'middle',
        horizontal: 'left'
    };
    cell.font = {
        name: 'Arial Narrow',
        size: 8,
    };
    cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '00969696' }
    };

    sheet.mergeCells('L7:N7');
    cell = sheet.getCell('L7')
    cell.value = `(Do not fill up. For CSC use only)`;
    cell.alignment = {
        vertical: 'middle',
        horizontal: 'right'
    };
    cell.font = {
        name: 'Arial Narrow',
        size: 8,
    };
    cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };

    sheet.mergeCells('A9:N9');
    cell = sheet.getCell('A9')
    cell.value = `I. PERSONAL INFORMATION`;
    cell.alignment = {
        vertical: 'top',
        horizontal: 'left'
    };
    cell.font = {
        name: 'Arial Narrow',
        size: 11,
        bold: true,
        italic: true,
        color: { argb: 'FFFFFFFF' },
    };
    cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '00969696' }
    };

    sheet.mergeCells('A10:A12');
    cell = sheet.getCell('A10')
    cell.value = `2.`;
    cell.alignment = {
        vertical: 'top',
        horizontal: 'left'
    };
    cell.font = {
        name: 'Arial Narrow',
        size: 8,
    };
    column = sheet.getColumn('A')
    column.width = cell.value.toString().length
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '00C0C0C0' }
    };

    // surname
    sheet.mergeCells('B10:C10');
    cell = sheet.getCell('B10')
    cell.value = `SURNAME`;
    cell.alignment = {
        vertical: 'top',
        horizontal: 'left'
    };
    cell.font = {
        name: 'Arial Narrow',
        size: 8,
    };
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '00C0C0C0' }
    };


    sheet.mergeCells('D10:N10');
    cell = sheet.getCell('D10')
    cell.value = `${employee.lastName}`;
    cell.alignment = {
        vertical: 'middle',
        horizontal: 'left'
    };
    cell.font = {
        name: 'Arial',
        size: 12,
        bold: true
    };
    cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };

    //fname
    sheet.mergeCells('B11:C11');
    cell = sheet.getCell('B11')
    cell.value = `FIRST NAME`;
    cell.alignment = {
        vertical: 'top',
        horizontal: 'left'
    };
    cell.font = {
        name: 'Arial Narrow',
        size: 8,
    };
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '00C0C0C0' }
    };

    sheet.mergeCells('D11:K11');
    cell = sheet.getCell('D11')
    cell.value = `${employee.firstName}`;
    cell.alignment = {
        vertical: 'middle',
        horizontal: 'left'
    };
    cell.font = {
        name: 'Arial',
        size: 12,
        bold: true
    };
    cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };

    // suffix
    sheet.mergeCells('L11:N11');
    cell = sheet.getCell('N11')
    cell.value = {
        'richText': [
            { 'font': { 'size': 7, 'color': black, 'name': 'Arial Narrow', 'family': 2, 'scheme': 'none' }, 'text': 'NAME EXTENSION (JR., SR)' },
            { 'font': { 'bold': true, 'size': 11, 'color': black, 'name': 'Arial', 'scheme': 'none' }, 'text': ` ${employee.suffix}` },
        ]
    };
    cell.alignment = {
        vertical: 'top',
        horizontal: 'left',
        wrapText: true
    };
    cell.font = {
        name: 'Arial Narrow',
        size: 7,
    };
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '00C0C0C0' }
    };
    cell.border = {
        right: { style: 'thin' }
    };

    // middle
    sheet.mergeCells('B12:C12');
    cell = sheet.getCell('B12')
    cell.value = `MIDDLE NAME`;
    cell.alignment = {
        vertical: 'top',
        horizontal: 'left'
    };
    cell.font = {
        name: 'Arial Narrow',
        size: 8,
    };
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '00C0C0C0' }
    };


    sheet.mergeCells('D12:N12');
    cell = sheet.getCell('D12')
    cell.value = `${employee.middleName}`;
    cell.alignment = {
        vertical: 'middle',
        horizontal: 'left'
    };
    cell.font = {
        name: 'Arial',
        size: 12,
        bold: true
    };
    cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };


    sheet.getRow(4).height = 21.75
    sheet.getRow(6).height = 1
    sheet.getRow(8).height = 1
    sheet.getRow(10).height = 22.5
    sheet.getRow(11).height = 22.5
    sheet.getRow(12).height = 22.5


    return workbook
}

module.exports = {
    templateJocos: templateJocos,
    templatePds: templatePds,
}