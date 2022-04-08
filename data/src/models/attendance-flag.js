//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    employeeId: {
        $type: mongoose.Schema.Types.ObjectId
    },
    dateTime: Date,
    type: String, // 'online', 'scanner' // normal, wfh, travel, pass
    extra: {
        lat: String,
        lon: String,
        photo: String,
    },
    source: {
        id: mongoose.Schema.Types.ObjectId,
        type: String, // 'scanner', 'userAccount', 'adminAccount'
    }
}, { timestamps: { createdAt: true, updatedAt: false }, typeKey: '$type', versionKey: false })

//// Instance methods


//// Static methods


//// Middlewares

module.exports = schema;
