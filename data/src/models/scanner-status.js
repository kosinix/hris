//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    scannerId: mongoose.Schema.Types.ObjectId,
    online: { // If scanner is connected to server
        $type: Boolean,
        default: false
    }
}, { timestamps: { createdAt: true, updatedAt: false }, typeKey: '$type' })

//// Instance methods


//// Static methods


//// Middlewares


module.exports = schema;
