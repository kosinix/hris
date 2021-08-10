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
    gracePeriods: [],
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
            type: {
                $type: String
            },
            percentage: Number,
            percentOf: String,
            initialAmount: Number,
            groupName: {
                $type: String
            },
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
            mandatory: {
                $type: Boolean
            },
            deductionType: {
                $type: String, // percentage, normal
            },
            percentage: Number,
            initialAmount: Number, // only for deductionType normal
            groupName: {
                $type: String,
                trim: true,
            },
        }
    ],
    rows: [
        {
            uid: String,
            type: Number,

            employment: {},
            employee: {},
            timeRecord: {},
            computed: {
                amountWorked: 0
            }, // Gets populated only when payroll is final

            incentives: [],
            deductions: [],
            attendances: [],
        }
    ],
    status: Number
}, { timestamps: true, typeKey: '$type' })

//// Instance methods


//// Static methods


//// Middlewares


module.exports = schema;
