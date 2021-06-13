
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
    }
]

module.exports = ROLES