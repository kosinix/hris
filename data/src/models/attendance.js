//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    employeeId: {
        $type: mongoose.Schema.Types.ObjectId
    },
    employmentId: {
        $type: mongoose.Schema.Types.ObjectId
    },
    workScheduleId: {
        $type: mongoose.Schema.Types.ObjectId
    },
    type: {
        $type: String,
        default: 'normal', // wfh, travel, pass, leave
    },
    onTravel: Boolean, // @deprecated. Use type
    wfh: Boolean, // @deprecated. Use type
    // Logs can be null for blank logs (half-day)
    logs: [
        {
            dateTime: Date,
            minutes: Number, // Minutes from midnight
            mode: Number, // 1 = in, 0 = out
            createdAt: Date,

            // @deprecated: 'online', 'scanner' 
            // Replaced by: 'normal', 'wfh', 'travel', 'pass'
            type: String,
            source: {
                id: mongoose.Schema.Types.ObjectId,
                type: String, // 'scanner', 'userAccount', 'adminAccount', 'biometric'
                lat: String,
                lon: String,
                photo: String,
                campus: String,
            },
            
            extra: { // @deprecated. Use source
                lat: String, // @deprecated. Use source.lat
                lon: String, // @deprecated. Use source.lon
                photo: String, // @deprecated. Use source.photo
            },
            scannerId: mongoose.Schema.Types.ObjectId, // @deprecated. Use source.id
        }
    ],
    changes: [
        {
            summary: String,
            objectId: mongoose.Schema.Types.ObjectId,
            comment: String,
            createdAt: Date
        }
    ],
    comments: [
        {
            summary: String,
            objectId: mongoose.Schema.Types.ObjectId,
            createdAt: Date
        }
    ],
}, { timestamps: true, typeKey: '$type' })

//// Instance methods


//// Static methods


//// Middlewares

module.exports = schema;
