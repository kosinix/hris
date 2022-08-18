//// Core modules

//// External modules
const mongoose = require('mongoose');
const lodash = require('lodash');

//// Modules

const Schema = mongoose.Schema;

const schema = new Schema({
    data: {},
}, { timestamps: true, typeKey: '$type' })

//// Virtuals


//// Schema methods


//// Middlewares

module.exports = schema
