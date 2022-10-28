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
    onTravel: Boolean, // @deprecated. Use type
    wfh: Boolean, // @deprecated. Use type
    workScheduleId: {
        $type: mongoose.Schema.Types.ObjectId
    },
    type: {
        $type: String,
        default: 'normal', // wfh, travel, pass, leave
    },
    // Logs can be null for blank logs (half-day)
    logs: [
        {
            dateTime: Date,
            mode: Number, // 1 = in, 0 = out

            // @deprecated: 'online', 'scanner' 
            // Replaced by: 'normal', 'wfh', 'travel', 'pass'
            type: String,
            source: {
                id: mongoose.Schema.Types.ObjectId,
                type: String, // 'scanner', 'userAccount', 'adminAccount'
                lat: String,
                lon: String,
                photo: String,
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
