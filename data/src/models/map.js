//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules


let schema = mongoose.Schema({
    location: {
        type: String,
        coordinates: []
    }
}, { timestamps: true });

module.exports = schema;