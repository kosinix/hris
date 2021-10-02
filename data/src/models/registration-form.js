//// Core modules

//// External modules
const mongoose = require('mongoose');
const lodash = require('lodash');
const uuid = require('uuid');

//// Modules
const uid = require('../uid');

const Schema = mongoose.Schema;

const schema = new Schema({
    uid: {
        $type: String,
    },
    started: {
        $type: Boolean,
        default: false
    },
    finished: {
        $type: Boolean,
        default: false
    },
}, {timestamps: true, typeKey: '$type'})

//// Virtuals



//// Schema methods


//// Middlewares

module.exports = schema
