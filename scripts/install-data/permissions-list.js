/**
 * Permission checks are hardcoded in route middlewares.
 * Code should be updated together with this list.
 */

//// Core modules

//// External modules

//// Modules

module.exports = [

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
    'payroll_status_2',
    'payroll_status_3',
    'payroll_status_4',

    // Memos
    'read_all_memo',
    'create_memo',
    'read_memo',
    'update_memo',
    'delete_memo',

    // Scanners
    'read_all_scanner',
    'create_scanner',
    'read_scanner',
    'update_scanner',
    'delete_scanner',
    'use_scanner',

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

    // Health Dec
    'read_all_hdf',
    'create_hdf',
    'read_hdf',
    'update_hdf',
    'delete_hdf',

    // Per campuses
    'main',
    'mosqueda',
    'baterna',

    // Employee 
    'use_employee_profile',

    ////// Sys admin stuff ////

    'read_all_permission',
    'create_permission',
    'read_permission',
    'update_permission',
    'delete_permission',

    'read_all_role',
    'create_role',
    'read_role',
    'update_role',
    'delete_role',

    'read_all_user',
    'create_user',
    'read_user',
    'update_user',
    'delete_user',

    // Security related settings
    'read_all_security',
    'create_security',
    'read_security',
    'update_security',
    'delete_security',

]