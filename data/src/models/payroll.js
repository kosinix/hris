//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    name: {
        $type: String,
        trim: true,
    },
    template: {
        $type: String,
        trim: true,
    },
    dateStart: {
        $type: String,
        trim: true,
    },
    dateEnd: {
        $type: String,
        trim: true,
    },
    incentives: [
        {
            _id: {
                $type: mongoose.Schema.Types.ObjectId,
            }, 
            uid: {
                $type: String
            },
            name: {
                $type: String
            },
            "type":{
                $type: String
            },
            "percentage": Number,
            "initialAmount": Number,
        }
    ],
    deductions: [
        {
            _id: {
                $type: mongoose.Schema.Types.ObjectId,
            }, 
            uid: {
                $type: String
            },
            name: {
                $type: String
            },
            "deductionType":{
                $type: String
            },
            "percentage": Number,
            "initialAmount": Number,
        }
    ],
    employees: [
        {
            _id: {
                $type: mongoose.Schema.Types.ObjectId,
            }, 
            basic: Number,
            minutesWorked: Number,
        }
    ],
}, { timestamps: true, typeKey: '$type' })

//// Instance methods


//// Static methods


//// Middlewares


module.exports = schema;