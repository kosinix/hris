//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    name: {
        $type: String,
        trim: true,
    },
    description: {
        $type: String,
        trim: true,
    },
    flexible: {
        $type: Boolean,
        default: false
    },
    start: {
        hour: {
            $type: Number,
            default: 0
        },
        minute: {
            $type: Number,
            default: 0
        },
    },
    end: {
        hour: {
            $type: Number,
            default: 0
        },
        minute: {
            $type: Number,
            default: 0
        },
    },
    gracePeriod: {
        hour: {
            $type: Number,
            default: 0
        },
        minute: {
            $type: Number,
            default: 0
        },
    },
    maxHours: {
        $type: Number,
        default: 4
    },
}, { timestamps: true, typeKey: '$type' })

//// Instance methods


//// Static methods



//// Middlewares




module.exports = schema;
