//// Core modules

//// External modules
const lodash = require('lodash')

//// Modules

/**
 * Stores working shift data
 * 
 * @param {object} start 
 * @param {number} start.hour  - Number 0 - 23
 * @param {number} start.minute  - Number 0 - 60
 * @param {object} end 
 * @param {number} end.hour  - Number 0 - 23
 * @param {number} end.minute  - Number 0 - 60
 * @param {object} gracePeriod 
 * @param {number} gracePeriod.hour  - Number 0 - 23
 * @param {number} gracePeriod.minute  - Number 0 - 60
 * @param {object} settings 
 * @param {boolean} settings.flexible  - True for flexible time schedule. False otherwise.
 * @param {number} settings.maxHours  - Max counted working hours per shift
 * @returns {object}
 */
const createShift = (start, end, gracePeriod, settings) => {
    start = lodash.merge({ hour: 0, minute: 0 }, start)
    end = lodash.merge({ hour: 0, minute: 0 }, end)
    gracePeriod = lodash.merge({ hour: 0, minute: 0 }, gracePeriod)
    settings = lodash.merge({ flexible: false, maxHours: 4 }, settings)

    return {
        start: start.hour * 60 + start.minute,
        end: end.hour * 60 + end.minute,
        grace: gracePeriod.hour * 60 + gracePeriod.minute,
        flexible: settings.hour,
        maxHours: settings.maxHours,
        maxMinutes: settings.maxHours * 60, // Derived property. Depends on maxHours
    }
}

/**
 * Find nearest shift to needle. Find nearest shift.start or shift.end to needle.
 * @param {number} needle - Minutes from midnight.
 * @param {array} shifts - Array of shift objects created by createShift. Must be sorted low to high.
 * @returns 
 */
const getNearestShift = (needle, shifts) => {
    console.log('needle', needle)

    let index = 0
    let distance = null
    shifts.forEach((shift, i) => {
        if (distance === null) {
            distance = Math.abs(shift.start - needle)
            console.log('distance null, set to', distance)
        }
        let newDistance = Math.abs(shift.start - needle)
        if (newDistance < distance) {
            console.log('shift.start < distance', newDistance, distance)
            console.log('index', i)

            distance = newDistance
            index = i

        }
        newDistance = Math.abs(shift.end - needle)
        if (newDistance < distance) {
            console.log('shift.end < distance', newDistance, distance)
            console.log('index', i)
            distance = newDistance
            index = i
        }
    })
    // shifts.sort((a, b) => {
    //     return Math.abs(needle - a.start) - Math.abs(needle - b.start);
    // })
    return shifts[index]
}

/**
 * Find next shift from needle
 * @param {number} needle - Minutes from midnight
 * @param {array} shifts - Array of shift objects created by createShift. Must be sorted low to high.
 */
const getNextShift = (needle, shifts) => {
    let index = null
    for (let i = 0; i < shifts.length; i++) {
        let shift = shifts[i]
        if (needle < shift.end) {
            index = i
            break; // Stop. Dont check other shifts
        }
    }

    if (index === null) {
        throw new Error('No more shifts after needle.')
    }
    return shifts[index]
}

/**
 * 
 * @param {object} momentObject Instance of moment
 * @returns {number} Minutes since midnight of that day
 */
const momentToMinutes = (momentObject) => {
    return momentObject.hour() * 60 + momentObject.minute()
}

module.exports = {
    createShift: createShift,
    getNearestShift: getNearestShift,
    getNextShift: getNextShift,
    momentToMinutes: momentToMinutes
}