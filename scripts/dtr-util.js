// node scripts/dtr-util.js
const moment = require('moment')

/** */;
(async () => {
    try {
        let logTime = moment('2022-01-01 3:00PM', 'YYYY-MM-DD hh:mmA')
        let startTime = logTime.clone().startOf('day')
        console.log(logTime.diff(startTime, 'minutes'), logTime.toISOString(), logTime.isoWeekday())
    } catch (err) {
        console.log(err)
    } finally {
    }
})()