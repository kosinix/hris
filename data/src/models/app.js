//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    username: {
        $type: String,
        trim: true,
    },
    name: {
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
    }
}, { timestamps: true, typeKey: '$type' });

//// Instance methods


//// Static methods



//// Middlewares




module.exports = schema;
