/**
 * Roles are a group of permissions.
 */

//// Core modules

//// External modules

//// Modules
const allPermissions = require('./permissions-list');

const ROLES = [
    {
        key: 'root',
        name: 'Super Admin',
        description: 'Can do anything.',
        permissions: allPermissions
    },
    {
        key: 'admin',
        name: 'System Admin',
        description: 'Can do mostly anything.',
        permissions: allPermissions
    },
    {
        key: 'hrmo',
        name: 'Human Resource Management Officer',
        description: 'Can manage employee, attendance, work schedule and payroll.',
        permissions: [
            // Employees
            'read_all_employee',
            'create_employee',
            'read_employee',
            'update_employee',
            'delete_employee',

            // Payrolls
            'read_all_payroll',
            'create_payroll',
            'read_payroll',
            'update_payroll',
            'delete_payroll',

            // Payroll statuses
            'payroll_status_1',

            // Attendance
            'read_all_attendance',
            'create_attendance',
            'read_attendance',
            'update_attendance',
            'delete_attendance',

            // Work Schedule
            'read_all_schedule',
            'create_schedule',
            'read_schedule',
            'update_schedule',
            'delete_schedule',

            // Memos
            'read_all_memo',
            'create_memo',
            'read_memo',
            'update_memo',
            'delete_memo',
        ]
    },
    {
        key: 'accountant',
        name: 'Accountant',
        description: 'Can view payroll.',
        permissions: [

            // Payrolls
            'read_all_payroll',
            'read_payroll',
            'update_payroll',

            // Payroll statuses
            'payroll_status_2',

        ]
    },
    {
        key: 'cashier',
        name: 'Cashier',
        description: 'Can view payroll and disburse.',
        permissions: [

            // Payrolls
            'read_all_payroll',
            'read_payroll',
            'update_payroll',

            // Payroll statuses
            'payroll_status_3',
            'payroll_status_4',

        ]
    },
    {
        key: 'employee',
        name: 'Employee',
        description: 'Can access employee My Profile section.',
        permissions: [
            'use_employee_profile',
        ]
    },
    {
        key: 'checker',
        name: 'Scanner Officer',
        description: 'Operate scanners and verify users.',
        permissions: [
            'read_scanner',
            'use_scanner',
        ]
    },
    {
        key: 'clinical',
        name: 'Clinical',
        description: 'Health related content.',
        permissions: [
            'read_all_hdf',
            'create_hdf',
            'read_hdf',
            'update_hdf',
            'delete_hdf',
        ]
    },
    {
        key: 'campusdirectormosqueda',
        name: 'Campus Director Mosqueda',
        description: 'Can view attendance.',
        permissions: [

            // Attendance
            'read_all_attendance',
            'read_attendance',

        ]
    },
    {
        key: 'campusdirectorbaterna',
        name: 'Campus Director Baterna',
        description: 'Can view attendance.',
        permissions: [

            // Attendance
            'read_all_attendance',
            'read_attendance',

        ]
    },
    {
        key: 'president',
        name: 'President',
        description: 'Can view attendance.',
        permissions: [

            // Employees
            'read_all_employee',
            'read_employee',

            // Attendance
            'read_all_attendance',
            'read_attendance',

            // Health Dec
            'read_all_hdf',
            'read_hdf',

            // Memos
            'read_all_memo',
            'create_memo',
            'read_memo',
            'update_memo',
            'delete_memo',

            // Work Schedule
            'read_all_schedule',
            'read_schedule',

        ]
    },
]

module.exports = ROLES