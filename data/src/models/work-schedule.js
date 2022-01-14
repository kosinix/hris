/**
 * Work schedules
 * 
 * Needed for computing minutes worked.
 * 
 * employment has one work schedule
 * attendance has one work schedule
 */
//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules

const Schema = mongoose.Schema;

const schema = new Schema({
    name: {
        $type: String,
    },
    visibility: {
        $type: String,
        default: ''
    },
    members: [
        {
            objectId: {
                $type: mongoose.Schema.Types.ObjectId, // can be id of employment, or list
            },
            name: String,
            type: String, // "employment", "list"
        }
    ],
    type: String, // 'weekdays', 'weekends'
    timeSegments: [{
        start: Number,
        end: Number,
        grace: {
            $type: Number,
            default: 0
        },
        maxHours: {
            $type: Number,
        },
        flexible: {
            $type: Boolean,
            default: false
        },
        weekDays: [],
        breaks: [
            {
                type: String,
                start: Number,
                end: Number
            }
        ]
    }],
}, { timestamps: true, typeKey: '$type' })

//// Virtuals

//// Schema methods

//// Middlewares


module.exports = schema
