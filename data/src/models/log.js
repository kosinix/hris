//// Core modules

//// External modules
const mongoose = require('mongoose');
const uuid = require('uuid');

//// Modules
const uid = require('../uid');

let schema = mongoose.Schema({
    personId: {
        $type: mongoose.Schema.Types.ObjectId
    },
    entityId: {
        $type: mongoose.Schema.Types.ObjectId
    },
    inside: {
        $type: Boolean
    },
    enteredOn: {
        $type: mongoose.Schema.Types.ObjectId
    },
    exitedOn: {
        $type: mongoose.Schema.Types.ObjectId
    },
    enteredAt: {
        $type: Date,
    },
    exitedAt: {
        $type: Date,
    },
}, {timestamps: {createdAt: true, updatedAt: false}, typeKey: '$type', versionKey: false})

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
