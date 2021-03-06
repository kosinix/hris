//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    name: {
        $type: String,
        trim: true,
    },
    shortName: {
        $type: String,
        trim: true,
    },
    description: {
        $type: String,
        trim: true,
    },
}, {timestamps: true, typeKey: '$type'})

//// Instance methods


//// Static methods


//// Middlewares


module.exports = schema;
