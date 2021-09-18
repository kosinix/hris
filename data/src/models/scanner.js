//// Core modules

//// External modules
const mongoose = require('mongoose');
const uuid = require('uuid');

//// Modules
const uid = require('../uid');

let schema = mongoose.Schema({
    uuid: {
        $type: String,
    },
    uid: {
        $type: String,
    },
    campus: {
        $type: String,
        trim: true,
    },
    name: {
        $type: String,
        trim: true,
    },
    userId: {
        $type: mongoose.Schema.Types.ObjectId,
    },
    device: {
        $type: String,
    },
    verification: {
        $type: String,
    },
    active: {
        $type: Boolean,
        default: true
    }
}, { timestamps: true, typeKey: '$type' })

//// Instance methods


//// Static methods


//// Middlewares
schema.pre('save', function (next) {
    if (!this.uuid) {
        this.uuid = uuid.v4()
    }
    if (!this.uid) {
        this.uid = uid.gen(8)
    }
    next();
});
module.exports = schema;
