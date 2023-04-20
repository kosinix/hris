//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

const Schema = mongoose.Schema;

const schema = new Schema({
    employeeId: mongoose.Schema.Types.ObjectId,
    employmentId: mongoose.Schema.Types.ObjectId,
    description: String,
    alert: String,
    userId: mongoose.Schema.Types.ObjectId,
    username: String,
    op: String, // Operation type: c, r, u, d for create, read, update, delete
}, { timestamps: {createdAt: true, updatedAt: false}, typeKey: '$type' })

//// Virtuals

//// Schema methods

//// Middlewares

module.exports = schema