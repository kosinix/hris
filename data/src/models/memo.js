//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    number: {
        $type: Number,
    },
    subject: {
        $type: String,
        trim: true,
    },
    url: {
        $type: String,
        trim: true,
    },
    date: {
        $type: Date
    },
}, {timestamps: true, typeKey: '$type'})

//// Instance methods


//// Static methods


//// Middlewares


module.exports = schema;
