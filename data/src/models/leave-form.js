//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId,
    employmentId:  mongoose.Schema.Types.ObjectId,
    status: Number, // 1 - pending, 2 - ok
    controlNumber: String,
    periodOfTravel: Date,
    periodOfTravelEnd: Date,
    dates: [],
    leaveAvailed: {},
    otherLeaveSpecifics: String,
    localDetails: String,
    abroadDetails: String,
    inHospitalDetails: String,
    outPatientDetails: String,
    specialLeaveWomenDetails: String,
    isMastersDegree: Boolean,
    isExamReview: Boolean,
    isMonet: Boolean,
    isTerminalLeave: Boolean,
    isCommutationRequested: Boolean,
}, { timestamps: true, typeKey: '$type' })

//// Instance methods


//// Static methods


//// Middlewares

module.exports = schema;
