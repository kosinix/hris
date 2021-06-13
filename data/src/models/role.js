//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules


let schema = mongoose.Schema({
    key: {
        type: String,
        trim: true,
    },
    name: {
        type: String,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    permissions: {
        type: Array,
    }
}, { timestamps: true });

module.exports = schema;