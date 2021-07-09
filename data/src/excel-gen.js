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

module.exports = {
    templateJocos: templateJocos
}