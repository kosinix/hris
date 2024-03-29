//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    scannerId: mongoose.Schema.Types.ObjectId,
    offline: Date,
    online: Date,
    duration: String,
}, { timestamps: { createdAt: true, updatedAt: false }, typeKey: '$type' })

//// Instance methods


//// Static methods


//// Middlewares


module.exports = schema;
