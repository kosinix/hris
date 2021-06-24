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
    onTravel: Boolean,
    logs: [
        {
            scannerId: mongoose.Schema.Types.ObjectId,
            dateTime: Date,
            mode: Number, // 1 = in, 0 = out
        }
    ],
}, {timestamps: {createdAt: true, updatedAt: false}, typeKey: '$type', versionKey: false})

//// Instance methods


//// Static methods


//// Middlewares

module.exports = schema;
