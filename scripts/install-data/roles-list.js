
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
    }
]

module.exports = ROLES