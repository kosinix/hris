/**
 * Usage: node scripts/test.test.js
 */
//// Core modules
const path = require('path');
const util = require('util');

//// External modules
const ExcelJS = require('exceljs');
const lodash = require('lodash');
const pigura = require('pigura');

//// Modules
// const uid = require('../data/src/uid');


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


    ; (async () => {
        try {
            let workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(`${CONFIG.app.dirs.view}/payroll/template_cos_staff.xlsx`);

            let letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
            let rows = []
            workbook.eachSheet(function (worksheet, sheetId) {
                console.log(sheetId, worksheet.name, worksheet.columns.length)
                worksheet.columns.forEach(function (column) {
                    // for (const property in column) {
                    //     if (property[0] !== '_') console.log(`${property}: ${column[property]}`);
                    // }
                    // console.log(column.width, column.header)
                })
                // console.log(worksheet.columns[0])

                worksheet.eachRow(function (row, rowNumber) {
                    let cells = []
                    row.eachCell({ includeEmpty: true }, function (cell, colNumber) {
                        // cells.push(cell.value)
                        if (letters[colNumber - 1] == 'W' && rowNumber === 21) {
                            console.log(`${letters[colNumber - 1]}${rowNumber} = ${util.inspect(cell, true, 2)}`);
                        }
                    });
                    // rows.push(cells)
                });
                // console.log(rows)
            });

        } catch (err) {
            console.log(err)
        } finally {
            // db.main.close()
        }
    })()


