//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    scannerId: mongoose.Schema.Types.ObjectId,
    status: { // 1 if scanner is connected to server or 0 is offline
        $type: Number,
        default: 0
    }
}, { timestamps: { createdAt: true, updatedAt: false }, typeKey: '$type' })

//// Instance methods


//// Static methods


//// Middlewares


module.exports = schema;
