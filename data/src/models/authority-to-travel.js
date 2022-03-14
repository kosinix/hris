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
    status: {
        $type: Number, // 1 - pending, 2 - ok
    },
    controlNumber: String,
    periodOfTravel: Date,
    periodOfTravelEnd: Date,
    data: {},
}, {timestamps: {createdAt: true, updatedAt: false}, typeKey: '$type', versionKey: false})

//// Instance methods


//// Static methods


//// Middlewares

module.exports = schema;
