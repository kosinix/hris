/**
 * Log person passing on a scan point
 */

//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    personId: {
        $type: mongoose.Schema.Types.ObjectId
    },
    entityId: {
        $type: mongoose.Schema.Types.ObjectId
    },
    scanOn: {
        $type: mongoose.Schema.Types.ObjectId
    },
    scanAt: {
        $type: Date,
    },
}, {timestamps: {createdAt: true, updatedAt: false}, typeKey: '$type', versionKey: false})

//// Instance methods


//// Static methods


//// Middlewares

module.exports = schema;
