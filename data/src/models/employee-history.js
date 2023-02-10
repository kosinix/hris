//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

const Schema = mongoose.Schema;

const schema = new Schema({
    employeeId: {
        $type: mongoose.Schema.Types.ObjectId,
    },
    employmentId: {
        $type: mongoose.Schema.Types.ObjectId,
    },
    description: String,
    alert: String,
    userId: mongoose.Schema.Types.ObjectId,
}, { timestamps: {createdAt: true, updatedAt: false}, typeKey: '$type' })

//// Virtuals

//// Schema methods

//// Middlewares

module.exports = schema