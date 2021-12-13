//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    attendanceId: {
        $type: mongoose.Schema.Types.ObjectId
    },
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
    status: String,
    correctionReason: String,
    logsheetNumber: Number,
    attachments: [],
    comment: String
}, { timestamps: { createdAt: true, updatedAt: false }, typeKey: '$type', versionKey: false })

//// Instance methods


//// Static methods


//// Middlewares

module.exports = schema;
