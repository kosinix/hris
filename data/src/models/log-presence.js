/**
 * Log person entering and exiting an entity
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
    inside: {
        $type: Boolean
    },
    enteredOn: {
        $type: mongoose.Schema.Types.ObjectId
    },
    exitedOn: {
        $type: mongoose.Schema.Types.ObjectId
    },
    enteredAt: {
        $type: Date,
    },
    exitedAt: {
        $type: Date,
    },
}, {timestamps: {createdAt: true, updatedAt: false}, typeKey: '$type', versionKey: false})

//// Instance methods


//// Static methods


//// Middlewares

module.exports = schema;
