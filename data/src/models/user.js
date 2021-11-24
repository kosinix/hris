//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    firstName: {
        $type: String,
        trim: true,
    },
    middleName: {
        $type: String,
        trim: true,
    },
    lastName: {
        $type: String,
        trim: true,
    },
    email: {
        $type: String,
        trim: true,
    },
    username: {
        $type: String,
        trim: true,
    },
    passwordHash: {
        $type: String,
        default: ''
    },
    salt: {
        $type: String,
        default: ""
    },
    roles: {
        $type: Array,
        default: []
    },
    active: {
        $type: Boolean,
        default: false
    },
    settings: { // dynamic permissions for employee
        editDtr: {
            $type: Boolean,
            default: false
        },
        editPds: {
            $type: Boolean,
            default: false
        },
    }
}, {timestamps: true, typeKey: '$type'})

//// Instance methods
schema.methods.isRoles = function (requiredRoles) {
    let user = this;
    let allowed = false;
    // console.log(requiredRoles, 'vs', user.roles)
    let userRoles = user.roles;

    // NOTE: Uncomment below to test different roles
    // userRoles = ["CL2"]
    allowed = requiredRoles.some((requiredRole) => {
        return userRoles.includes(requiredRole)
    });
    return allowed;
}

//// Static methods



//// Middlewares




module.exports = schema;
