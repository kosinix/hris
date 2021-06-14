//// Core modules

//// External modules
const mongoose = require('mongoose');
const lodash = require('lodash');
const phAddress = require('ph-address')
const uuid = require('uuid');

//// Modules
const uid = require('../uid');

const Schema = mongoose.Schema;

const schema = new Schema({
    uuid: {
        $type: String, // Universal unique ID
    },
    uid: {
        $type: String, // Short readable UID
    },
    firstName: {
        $type: String,
        trim: true,
        default: ""
    },
    middleName: {
        $type: String,
        trim: true,
        default: ""
    },
    lastName: {
        $type: String,
        trim: true,
        default: ""
    },
    suffix: {
        $type: String,
        trim: true,
        default: ""
    },
    birthDate: {
        $type: Date
    },
    gender: {
        $type: String
    },
    civilStatus: {
        $type: String
    },
    profilePhoto: {
        $type: String,
        trim: true,
    },
    email: {
        $type: String,
        trim: true,
    },
    mobileNumber: {
        $type: String,
        trim: true,
        default: ""
    },
    emailVerified: {
        $type: Boolean,
        default: false
    },
    mobileNumberVerified: {
        $type: Boolean,
        default: false
    },
    addressPresent: {
        $type: mongoose.Schema.Types.ObjectId,
    },
    addressPermanent: {
        $type: mongoose.Schema.Types.ObjectId,
    },
    address: {
        $type: String,
        trim: true,
    },
    addresses: [
        {
            unit: {
                $type: String,
                trim: true,
            },
            psgc: {
                $type: String,
                trim: true,
            },
            full: {
                $type: String,
                trim: true,
            },
            zipCode: {
                $type: Number,
            },
            dateStarted: {
                $type: Date,
            },
            status: {
                $type: Number,
            }
        }
    ],
    employments: [
        {
            _id: {
                $type: mongoose.Schema.Types.ObjectId,
            },
            campus: {
                $type: String,
                trim: true,
            },
            group: {
                $type: String,
                trim: true,
            },
            position: {
                $type: String,
                trim: true,
            },
            department: {
                $type: String,
                trim: true,
            },
            employmentType: {
                $type: String,
                trim: true,
            },
            salary: {
                $type: Number,
            },
            salaryType: { // monthly, daily
                $type: String,
                trim: true,
            },
        }
    ],
    documents: [
        {
            type: {
                $type: String,
                trim: true,
                default: ""
            },
        }
    ],
    userId: {
        $type: mongoose.Schema.Types.ObjectId, // assoc. user account 
    },
    custom: {}
}, {timestamps: true, typeKey: '$type'})

//// Virtuals
schema.virtual('addressPsgc').get(function() {
    let me = this
    let permanentAddress = lodash.find(this.addresses, (o) => {
        return o._id.toString() === me.addressPermanent.toString()
    })
    if(!permanentAddress) {
        return ''
    }

    return permanentAddress.psgc
});

schema.virtual('addressUnit').get(function() {
    let me = this
    let permanentAddress = lodash.find(this.addresses, (o) => {
        return o._id.toString() === me.addressPermanent.toString()
    })
    if(!permanentAddress) {
        return ''
    }

    // Unit
    return permanentAddress.unit
});


//// Schema methods


//// Middlewares
schema.pre('save', function (next) {
    if(!this.uuid){
        this.uuid = uuid.v4()
    }
    if(!this.uid){
        this.uid = uid.gen()
    }
    next();
});

module.exports = schema
