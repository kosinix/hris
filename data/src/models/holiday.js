/**
 * 
 * Regular Holiday
 * 
    If the employee did not work, he/she shall be paid 100 percent of his/her salary for that day.
    If the employee works during the regular holiday, the employee shall be paid 200 percent of his/her regular salary for that day for the first eight hours.
    If the employee works more than eight hours (overtime work), he/she shall be paid an additional 30 percent of his/her hourly rate.
    If the employee works on his/her rest day, he/she shall be paid an additional 30 percent of his/her daily rate of 200 percent
    If the employee works more than eight hours (overtime work) during a regular holiday that also falls on his/her rest day, he/she shall be paid an additional 30 percent of his/her hourly rate.

    
    If the employee did not work, no pay, unless there is a favorable company policy, practice or collective bargaining agreement (CBA) granting payment of wages on special days even if unworked.
    If the employee works during the Special Non-Working Day, the employee shall be paid 100 percent of his/her regular salary plus 30 percent of the daily rate
    If the employee works more than eight hours (overtime work), he/she shall be paid an additional 30 percent of his/her hourly rate on said day
    for that day for the first eight hours.

 */
//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Modules


let schema = mongoose.Schema({
    name: {
        $type: String
    },
    type: {
        $type: Number, // 1 - Regular Holiday, 2 - Special Non-working Holiday
    },
    date: {
        $type: Date // YYYY-MM-DD so on
    }
}, { timestamps: true, typeKey: '$type' })


module.exports = schema;