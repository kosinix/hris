//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
    name: {
        $type: String,
        trim: true,
    },
    template: {
        $type: String,
        trim: true,
    },
    dateStart: {
        $type: String,
        trim: true,
    },
    dateEnd: {
        $type: String,
        trim: true,
    },
    gracePeriods: [],
    rows: [],
    columns: [],
    status: Number, // 1 - HR, 2 - Accounting, 3 - Cashier, 4 - Released
    assignedTo: {}
}, { timestamps: true, typeKey: '$type' })

//// Instance methods


//// Static methods


//// Middlewares


module.exports = schema;
