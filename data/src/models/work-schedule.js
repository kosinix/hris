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

const weekDaySchema = {
    type: Number, // 1 - normal, 2 - rest
    timeSegments: [
        {
            start: Number,
            end: Number,
            grace: {
                $type: Number,
                default: 0
            },
            max: {
                $type: Number, // if present, limit max minutes per time segment to this
            },
            flexible: {
                $type: Boolean,
                default: false
            },
            breaks: [
                {
                    type: String, // vacant, personal
                    start: Number,
                    end: Number
                }
            ]
        }
    ],
}

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
    // New schedule feb 2022
    dateStart: Date, // Schedule date range
    dateEnd: Date, // Schedule date range
    weekDays: {}
}, { timestamps: true, typeKey: '$type' })

//// Virtuals

//// Schema methods

//// Middlewares


module.exports = schema
