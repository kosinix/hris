/**
 * node scripts/ical.js
 *
 */
//// Core modules

//// External modules
const ical = require('node-ical')
const lodash = require('lodash')

//// Modules

// do stuff in an async function


/**
 * Special Non-working Holiday - no work, no pay
 * Special Working Holiday - not holiday
 * Regular Holiday
 */


/**/;
(async () => {
    try {

        let events = await ical.async.fromURL('https://calendar.google.com/calendar/ical/c_3utb2ohfd40s98njoum9pt0g00%40group.calendar.google.com/public/basic.ics')
        console.log(events)
        lodash.each(events, (e)=>{
            console.log(e.summary, e.start)
        })
    } catch (err) {
        console.log(err)
    } finally {

    }
})()


