//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules
const uid = require('../uid');

const Schema = mongoose.Schema;

const schema = new Schema({
    status: {
        $type: String, // '', started, finished, verified
    },
    uid: {
        $type: String,
    },
    employmentId: {
        $type: mongoose.Schema.Types.ObjectId,
    },
    photo: {
        $type: String,
    },
    email: {
        $type: String,
    },
}, {timestamps: true, typeKey: '$type'})

//// Virtuals



//// Schema methods


//// Middlewares

module.exports = schema
