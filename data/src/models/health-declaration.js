//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    employeeId: {
        $type: mongoose.Schema.Types.ObjectId
    },
    data: {},
}, {timestamps: {createdAt: true, updatedAt: false}, typeKey: '$type', versionKey: false})

//// Instance methods


//// Static methods


//// Middlewares

module.exports = schema;
