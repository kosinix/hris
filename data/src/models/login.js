//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules


const Schema = mongoose.Schema;

const schema = new Schema({
    personId: {
        $type: mongoose.Schema.Types.ObjectId,
    },
    passwordHash: {
        $type: String,
        trim: true,
    },
    salt: {
        $type: String,
        trim: true,
    },
}, {timestamps: true, typeKey: '$type'})

//// Schema methods

//// Middlewares

module.exports = schema
