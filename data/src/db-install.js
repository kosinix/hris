//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Code
let cred = CRED.mongodb.connections.main
let conf = CONFIG.mongodb.connections.main
let opts = conf.options
opts.promiseLibrary = Promise // Use ES6 Promise

let main = mongoose.createConnection(`mongodb://${cred.username}:${cred.password}@${conf.host}/${conf.db}`, opts);

main.on('connected', () => {
    console.log('Database connected to', conf.host + '/' + conf.db);
});
main.catch((err) => {
    console.log('Connection error:', err.message);
});
main.on('disconnected', () => {
    console.log('Database disconnected from', conf.host + '/' + conf.db);
});

main.App = main.model('App', require('./models/app'));
main.Attendance = main.model('Attendance', require('./models/attendance'));
main.Employee = main.model('Employee', require('./models/employee'));
main.EmployeeList = main.model('EmployeeList', require('./models/employee-list'));
main.Employment = main.model('Employment', require('./models/employment'));
main.Payroll = main.model('Payroll', require('./models/payroll'));
main.Permission = main.model('Permission', require('./models/permission'));
main.Position = main.model('Position', require('./models/position'));
main.Role = main.model('Role', require('./models/role'));
main.Scanner = main.model('Scanner', require('./models/scanner'));
main.User = main.model('User', require('./models/user'));


module.exports = {
    mongoose: mongoose,
    main: main,
}