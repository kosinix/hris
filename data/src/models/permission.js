//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules


let schema = mongoose.Schema({
    key: {
        type: String,
        trim: true,
    },
}, { timestamps: {createdAt: true, updatedAt: false} });

module.exports = schema;