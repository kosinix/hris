//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    employeeId: {
        $type: mongoose.Schema.Types.ObjectId
    },
    scannerId: {
        $type: mongoose.Schema.Types.ObjectId
    },
    inAM: {
        $type: Date,
    },
    outAM: {
        $type: Date,
    },
    inPM: {
        $type: Date,
    },
    outPM: {
        $type: Date,
    },
    inOT: {
        $type: Date,
    },
    outOT: {
        $type: Date,
    },
// TODO: schema for per-login scannerId
    inAM2: {
        scannerId: mongoose.Schema.Types.ObjectId,
        dateTime: Date,
    },
    outAM2: {
        scannerId: mongoose.Schema.Types.ObjectId,
        dateTime: Date,
    },
    inPM2: {
        scannerId: mongoose.Schema.Types.ObjectId,
        dateTime: Date,
    },
    outPM2: {
        scannerId: mongoose.Schema.Types.ObjectId,
        dateTime: Date,
    },
}, {timestamps: {createdAt: true, updatedAt: false}, typeKey: '$type', versionKey: false})

//// Instance methods


//// Static methods


//// Middlewares

module.exports = schema;
