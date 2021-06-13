//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

let schema = mongoose.Schema({
  type: {
    $type: String,
    trim: true,
  },
  personId: {
    $type: mongoose.Schema.Types.ObjectId,
  },
}, {timestamps: true, typeKey: '$type'})

//// Instance methods

//// Static methods

//// Middlewares

module.exports = schema;
