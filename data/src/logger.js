//// Core modules
const path = require('path');
const util = require('util');

//// External modules
const moment = require('moment');
const troso = require('troso');

//// Modules


let loggerError = new troso.Logger({
    transports: [
        new troso.transports.Console(),
        new troso.transports.DailyFile({
            directory: path.join(CONFIG.app.dirs.data, 'log'),
            formatter: (message) => {
                let today = moment();//new Date();
                return util.format('%s: %s %s', today.utcOffset('+0800').format('YYYY-MM-DD hh:MM:ss A ([UTC]Z)'), message, "\n");
            }
        })
    ],
});

let loggerOk = new troso.Logger({
    transports: [
        new troso.transports.Console()
    ]
});

//// Wrap logger in to nicer API
module.exports = {
    log: (message) => {
        loggerOk.log(message);
    },
    error: (message) => {
        loggerError.log(message);
    }
};