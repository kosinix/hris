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
    visibility: {
        $type: String,
        default: ''
    },
    members: [
        {
            objectId: mongoose.Schema.Types.ObjectId, // can be id of employment, or list
            name: String,
            type: String, // "employment", "list"
        }
    ],
}, {timestamps: true, typeKey: '$type'})

//// Instance methods


//// Static methods


//// Middlewares


module.exports = schema;
