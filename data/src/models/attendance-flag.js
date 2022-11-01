//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    employeeId: {
        $type: mongoose.Schema.Types.ObjectId
    },
    dateTime: Date,
    type: String, // normal, wfh, travel, pass
    source: {
        id: mongoose.Schema.Types.ObjectId,
        type: String, // 'scanner', 'userAccount', 'adminAccount'
        lat: String,
        lon: String,
        campus: String,
        photo: String,
    },

    // @deprecated. Use source instead
    extra: {
        lat: String,
        lon: String,
        photo: String,
    },

}, { timestamps: true, typeKey: '$type' })

//// Instance methods


//// Static methods


//// Middlewares

module.exports = schema;
