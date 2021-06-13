//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules


const Schema = mongoose.Schema;

const schema = new Schema({
    code: {
        $type: String,
        trim: true,
    },
    name : {
        $type: String,
        trim: true,
    },
    level : {
        $type: String,
        trim: true,
    },
    regCode : {
        $type: String,
        trim: true,
    },
    provCode : {
        $type: String,
        trim: true,
    },
    cityMunCode : {
        $type: String,
        trim: true,
    },
    provName : {
        $type: String,
        trim: true,
    },
    cityMunName : {
        $type: String,
        trim: true,
    },
    full : {
        $type: String,
        trim: true,
    },
}, {timestamps: false, typeKey: '$type'})

//// Instance methods
schema.statics.findOneFullAddress = async function (cond) {
    let address = await this.findOne(cond)
    if(address){
        return `${address.name}, ${address.cityMunName}, ${address.provName}`
    }
    return ''
}

//// Virtuals

//// Middlewares

module.exports = schema
