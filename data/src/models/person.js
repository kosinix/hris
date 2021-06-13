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
        $type: String,
    },
    uid: {
        $type: String,
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
    incomes: [
        {
            type: { // employed, remittance, pension, business, others
                $type: String,
                trim: true,
            },
            employmentSector:{ // public, private
                $type: String,
                trim: true,
            },
            occupation: {
                $type: String,
                trim: true,
            },
            employmentStatus: { // Regular, Casual
                $type: String,
                trim: true,
            },
            estimatedMonthlyIncome: {
                $type: Number,
            },
            estimatedMonthlyHouseholdIncome: {
                $type: Number,
            },
        }
    ],
    properties: [
        {
            type: { // real, personal
                $type: String,
                trim: true,
            },
            name: { // residential house and lot, commercial land/bldg., agri-land
                $type: String, // motorcycle, car, trucks/heavy equip., investments, farm animals/large cattle, others
                trim: true,
            },
        }
    ],
    families: [
        {
            personId: {
                $type: mongoose.Schema.Types.ObjectId,
            },
            relation: {
                $type: String
            }
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
    custom: {
        fourPsBeneficiary: {
            $type: Boolean
        },
        sssPensioner: {
            $type: Boolean
        },
        healthIssue: {
            $type: Boolean
        },
        pwd: {
            $type: Boolean
        },
        ipGroup: {
            $type: Boolean
        },
        emergencyContact: {
            $type: String
        },
        emergencyContactNo: {
            $type: String
        }
    }
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
