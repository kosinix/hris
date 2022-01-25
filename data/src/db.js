//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Code
let cred = CRED.mongodb.connections.main
let conf = CONFIG.mongodb.connections.main
let opts = conf.options
opts.promiseLibrary = Promise // Use ES6 Promise
opts.retryWrites = false

let main = mongoose.createConnection(`mongodb://${cred.username}:${cred.password}@${conf.host}/${conf.db}?retryWrites=false`, opts);

main.on('connected', () => {
    console.log('Database connected to', conf.host + '/' + conf.db);
});
main.catch((err) => {
    console.log('Connection error:', err.message);
});
main.on('disconnected', () => {
    console.log('Database disconnected from', conf.host + '/' + conf.db);
});

main.Address = main.model('Address', require('./models/address'));
main.Attendance = main.model('Attendance', require('./models/attendance'));
main.AttendanceReview = main.model('AttendanceReview', require('./models/attendance-review'));
main.App = main.model('App', require('./models/app'));
main.Application = main.model('Application', require('./models/application'));
main.Employee = main.model('Employee', require('./models/employee'));
main.EmployeeList = main.model('EmployeeList', require('./models/employee-list'));
main.Employment = main.model('Employment', require('./models/employment'));
main.Memo = main.model('Memo', require('./models/memo'));
main.HealthDeclaration = main.model('HealthDeclaration', require('./models/health-declaration'));
main.Login = main.model('Login', require('./models/login'));
main.Pass = main.model('Pass', require('./models/pass'));
main.Payroll = main.model('Payroll', require('./models/payroll'));
main.Permission = main.model('Permission', require('./models/permission'));
main.Position = main.model('Position', require('./models/position'));
main.RegistrationForm = main.model('RegistrationForm', require('./models/registration-form'));
main.Role = main.model('Role', require('./models/role'));
main.Scanner = main.model('Scanner', require('./models/scanner'));
main.ScannerPing = main.model('ScannerPing', require('./models/scanner-ping'));
main.ScannerStatus = main.model('ScannerStatus', require('./models/scanner-status'));
main.Share = main.model('Share', require('./models/share'));
main.User = main.model('User', require('./models/user'));
main.WorkSchedule = main.model('WorkSchedule', require('./models/work-schedule'));


module.exports = {
    mongoose: mongoose,
    main: main,
}