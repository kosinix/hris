//// Core modules

//// External modules
const mongoose = require('mongoose');
const uuid = require('uuid');

//// Modules
const uid = require('../uid');

let schema = mongoose.Schema({
    scannerId: {
        $type: mongoose.Schema.Types.ObjectId,
    },
}, { timestamps: { createdAt: true, updatedAt: false }, typeKey: '$type' })

//// Instance methods


//// Static methods


//// Middlewares


module.exports = schema;
