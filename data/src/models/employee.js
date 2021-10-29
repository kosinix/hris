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
    phoneNumber: {
        $type: String,
        trim: true,
        default: ""
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
            unit: { // house, block, lot, or unit no.
                $type: String,
                trim: true,
            },
            street: {
                $type: String,
                trim: true,
            },
            village: { // or subdivision
                $type: String,
                trim: true,
            },
            brgy: {
                $type: String,
                trim: true,
            },
            cityMun: {
                $type: String,
                trim: true,
            },
            province: {
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
    employments: [], // @deprecated - Use employment model instead
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
    group: {
        $type: String,
        trim: true,
    },
    custom: {},
    personal: {
        birthPlace: {
            $type: String,
            trim: true,
        },
        height: {
            $type: String,
            trim: true,
        },
        weight: {
            $type: String,
            trim: true,
        },
        bloodType: {
            $type: String,
            trim: true,
        },
        gsis: {
            $type: String,
            trim: true,
        },
        sss: {
            $type: String,
            trim: true,
        },
        philHealth: {
            $type: String,
            trim: true,
        },
        tin: {
            $type: String,
            trim: true,
        },
        pagibig: {
            $type: String,
            trim: true,
        },
        agencyEmployeeNumber: {
            $type: String,
            trim: true,
        },
        citizenship: [{
            $type: String,
            trim: true,
        }],
        citizenshipCountry: {
            $type: String,
            trim: true,
        },
        citizenshipSource: [{
            $type: String,
            trim: true,
        }],
        spouse: {},
        father: {},
        mother: {},
        children: [],
        schools: [],
        eligibilities: [],
        workExperiences: [],
        voluntaryWorks: [],
        trainings: [],
        extraCurriculars: [],
        relatedThirdDegree: {
            $type: String,
            trim: true,
        },
        relatedFourthDegree: {
            $type: String,
            trim: true,
        },
        relatedFourthDegreeDetails: {
            $type: String,
            trim: true,
        },
        guiltyAdmin: {
            $type: String,
            trim: true,
        },
        guiltyAdminDetails: {
            $type: String,
            trim: true,
        },
        criminalCharge: {
            $type: String,
            trim: true,
        },
        criminalChargeDetails: {
            $type: String,
            trim: true,
        },
        criminalChargeDate: {
            $type: String,
            trim: true,
        },
        convicted: {
            $type: String,
            trim: true,
        },
        convictedDetails: {
            $type: String,
            trim: true,
        },
        problematicHistory: {
            $type: String,
            trim: true,
        },
        problematicHistoryDetails: {
            $type: String,
            trim: true,
        },
        electionCandidate: {
            $type: String,
            trim: true,
        },
        electionCandidateDetails: {
            $type: String,
            trim: true,
        },
        electionResigned: {
            $type: String,
            trim: true,
        },
        electionResignedDetails: {
            $type: String,
            trim: true,
        },
        dualCitizen: {
            $type: String,
            trim: true,
        },
        dualCitizenDetails: {
            $type: String,
            trim: true,
        },
        indigenousGroup: {
            $type: String,
            trim: true,
        },
        indigenousGroupDetails: {
            $type: String,
            trim: true,
        },
        pwd: {
            $type: String,
            trim: true,
        },
        pwdDetails: {
            $type: String,
            trim: true,
        },
        soloParent: {
            $type: String,
            trim: true,
        },
        soloParentDetails: {
            $type: String,
            trim: true,
        },
        references: []
    },
    acceptedDataPrivacy: {
        $type: Boolean,
        default: false
    }
}, { timestamps: true, typeKey: '$type' })

//// Virtuals
schema.virtual('addressPsgc').get(function () {
    let me = this
    let permanentAddress = lodash.find(this.addresses, (o) => {
        return o._id.toString() === me.addressPermanent.toString()
    })
    if (!permanentAddress) {
        return ''
    }

    return permanentAddress.psgc
});

schema.virtual('addressUnit').get(function () {
    let me = this
    let permanentAddress = lodash.find(this.addresses, (o) => {
        return o._id.toString() === me.addressPermanent.toString()
    })
    if (!permanentAddress) {
        return ''
    }

    // Unit
    return permanentAddress.unit
});


//// Schema methods
schema.methods.buildAddress = function (unit, street, village, full, zipCode) {
    let addresses = []
    if(unit){
        addresses.push(unit)
    }
    if(street){
        addresses.push(street)
    }
    if(village){
        addresses.push(village)
    }
    if(full){
        addresses.push(full)
    }

    return addresses.join(', ')
};

//// Middlewares
schema.pre('save', function (next) {
    if (!this.uuid) {
        this.uuid = uuid.v4()
    }
    if (!this.uid) {
        this.uid = uid.gen()
    }
    next();
});

module.exports = schema
