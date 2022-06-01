//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

const Schema = mongoose.Schema;

const schema = new Schema({
    secureKey: String,
    payload: {},
    createdBy: String,
    expiredAt: Date,
}, {timestamps: {createdAt: true, updatedAt: false}, typeKey: '$type'})

//// Virtuals


//// Schema methods


//// Middlewares

module.exports = schema
