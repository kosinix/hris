//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules


let schema = mongoose.Schema({
    name: {
        type: String,
        trim: true,
    },
    key: {
        type: String,
        trim: true,
    },
    value: {}
}, { timestamps: true });

module.exports = schema;