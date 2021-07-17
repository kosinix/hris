//// Core modules

//// External modules
const mongoose = require('mongoose');
const lodash = require('lodash');
const uuid = require('uuid');

//// Modules
const uid = require('../uid');

const Schema = mongoose.Schema;

const schema = new Schema({
    secureKey: {
        $type: String,
    },
    payload: {},
    expiredAt: {
        $type: Date,
    },
    createdBy: mongoose.Schema.Types.ObjectId,
}, {timestamps: true, typeKey: '$type'})

//// Virtuals



//// Schema methods


//// Middlewares

module.exports = schema
