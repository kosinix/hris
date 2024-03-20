//// Core modules

//// External modules
const mongoose = require('mongoose')
const moment = require('moment')

//// Modules

const Schema = mongoose.Schema;

const schema = new Schema({
    employeeId: {
        $type: mongoose.Schema.Types.ObjectId,
    },
    campus: {
        $type: String,
        trim: true,
    },
    group: {
        $type: String,
        trim: true,
    },
    position: {
        $type: String,
        trim: true,
    },
    positionId: {
        $type: mongoose.Schema.Types.ObjectId,
    },
    department: {
        $type: String,
        trim: true,
    },
    department2: {
        $type: String,
        trim: true,
    },
    employmentType: {
        $type: String,
        trim: true,
    },
    employmentStart: {
        $type: Date
    },
    employmentEnd: {
        $type: Date
    },
    salary: {
        $type: Number,
    },
    salaryType: { // monthly, daily, hourly
        $type: String,
        trim: true,
    },
    fundSource: {
        $type: String,
        trim: true,
    },
    sssID: {
        $type: String,
        trim: true,
    },
    sssDeduction: {
        $type: Number,
    },
    active: {
        $type: Boolean,
        default: true
    },
    workScheduleId: {
        $type: mongoose.Schema.Types.ObjectId,
    },
    inCharge: {
        $type: String,
        trim: true,
    },
    documents: [
        {
            type: {
                $type: String,
                trim: true,
                default: ""
            },
        }
    ],
    createdBy: {
        $type: mongoose.Schema.Types.ObjectId, // assoc. admin user account 
    },
}, { timestamps: true, typeKey: '$type' })

//// Virtuals


//// Schema methods


//// Middlewares
schema.post('findOne', function(result) {

    if(result.employmentStart) result.employmentStart = moment(result.employmentStart).format('YYYY-MM-DD')
    if(result.employmentEnd) result.employmentEnd = moment(result.employmentEnd).format('YYYY-MM-DD')
});

module.exports = schema
