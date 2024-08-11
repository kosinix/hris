//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

const Schema = mongoose.Schema;

const schema = new Schema({
    name: {
        $type: String,
    },
    acronym: {
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
            role: String, // director, head, member, staff, 
            firstName: String,
            middleName: String,
            lastName: String,
            suffix: String,
            position: String,
            fundSource: String,
        }
    ],
}, { timestamps: true, typeKey: '$type' })

//// Virtuals

//// Schema methods

//// Middlewares


module.exports = schema
