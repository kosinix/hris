//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

const Schema = mongoose.Schema;

const schema = new Schema({
    name: {
        $type: String,
    },
    members: [
        {
            employeeId: {
                $type: mongoose.Schema.Types.ObjectId,
            },
            employmentId: {
                $type: mongoose.Schema.Types.ObjectId,
            },
            firstName: String,
            middleName: String,
            lastName: String,
            suffix: String,
            position: String,
        }
    ],
    timeSegments: [{
        start: Number,
        end: Number,
        grace: {
            $type: Number,
            default: 0
        },
        maxHours: {
            $type: Number,
        },
        flexible: {
            $type: Boolean,
            default: false
        },
    }],
}, { timestamps: true, typeKey: '$type' })

//// Virtuals

//// Schema methods

//// Middlewares


module.exports = schema
