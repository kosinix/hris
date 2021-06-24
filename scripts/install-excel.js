/**
 * dddd.
 * Usage: node scripts/install-excel.js
 */
//// Core modules
const fs = require('fs');
const path = require('path');

//// External modules
const xl = require('excel4node');
const ExcelJS = require('exceljs');
const lodash = require('lodash');
const pigura = require('pigura');

//// Modules


//// First things first
//// Save full path of our root app directory and load config and credentials
global.APP_DIR = path.resolve(__dirname + '/../').replace(/\\/g, '/'); // Turn back slash to slash for cross-platform compat
global.ENV = lodash.get(process, 'env.NODE_ENV', 'dev')

const configLoader = new pigura.ConfigLoader({
    configName: './configs/config.json',
    appDir: APP_DIR,
    env: ENV,
    logging: true
})
global.CONFIG = configLoader.getConfig()

const credLoader = new pigura.ConfigLoader({
    configName: './credentials/credentials.json',
    appDir: APP_DIR,
    env: ENV,
    logging: true
})
global.CRED = credLoader.getConfig()

    // const db = require('../data/src/db-install');
    ;

(async () => {
    try {

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('salary JO-main template');
        sheet.views = [
            { zoomScale: 80 }
        ];

        // merge a range of cells
        sheet.mergeCells('A1:X1');
        sheet.mergeCells('A2:X2');
        sheet.mergeCells('B3:C3');
        sheet.mergeCells('B4:C4');
        sheet.mergeCells('A6:A8');

        // ... merged cells are linked
        sheet.getCell('A1').value = 'PAYROLL';
        sheet.getCell('A1').alignment = { vertical: 'bottom', horizontal: 'center' };
        sheet.getCell('A1').font = {
            name: 'Arial',
            size: 20,
            bold: true
        };
        sheet.getCell('A2').value = 'Salary for the period May 1-15, 2021';
        sheet.getCell('A2').alignment = { vertical: 'bottom', horizontal: 'center' };
        sheet.getCell('A2').font = {
            size: 11,
            bold: true
        };
        																					


        sheet.getCell('B3').value = 'Entity Name: GSC-Salvador Campus-Staff';
        sheet.getCell('B4').value = 'Fund Cluster: STF';
        
        sheet.getCell('A5').value = 'We acknowledge receipt of cash shown opposite our name as full compensation for services rendered for the period covered.';
        sheet.getCell('B3').font = {
            size: 11,
            bold: true
        };
        sheet.getCell('B4').font = {
            size: 11,
            bold: true
        };
        sheet.getCell('A5').font = {
            size: 10,
        };
        

        sheet.getCell('A6').value = 'NO.';
        sheet.getCell('A6').font = {
            size: 11,
            bold: true
        };

        sheet.getCell('F10').value =  566.64 
        sheet.getCell('G10').value =  11 
        sheet.getCell('I10').value =  7 
        sheet.getCell('K10').value =  15 
        sheet.getCell('M10').value = { formula: 'G10*F10+I10*F10/8+K10*F10/8/60' }

        sheet.getCell('M10').numFmt = '#,##0.00';



        	


        // write to a file
        await workbook.xlsx.writeFile('excel.xlsx');



    } catch (err) {
        console.log(err)
    } finally {

    }
})()


