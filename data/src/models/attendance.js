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
    logs: [
        {
            scannerId: mongoose.Schema.Types.ObjectId,
            dateTime: Date,
            mode: Number, // 1 = in, 0 = out
            type: String, // 'online', 'scanner'
            extra: {
                lat: '',
                lon: ''
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
