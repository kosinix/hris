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
            scannerId: mongoose.Schema.Types.ObjectId,
            dateTime: Date,
            mode: Number, // 1 = in, 0 = out
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
}, { timestamps: { createdAt: true, updatedAt: false }, typeKey: '$type', versionKey: false })

//// Instance methods


//// Static methods


//// Middlewares

module.exports = schema;
