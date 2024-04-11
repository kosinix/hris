/**
 * Date helper 
 */

//// Core modules

//// External modules
const moment = require('moment')

//// Modules

/**
 * Group neighbor dates into a 2D array
 * @param {array} dates 
 * @param {boolean} simplify 
 * @returns 
 */
const groupDates = (dates, simplify = false) => {
    let basket = [[]]
    let group = 0
    dates.forEach((d, currentIndex, dates) => {
        if (currentIndex <= 0) {
            basket[group].push(d)
        } else if (currentIndex > 0) {
            let date1 = moment(dates[currentIndex - 1])
            let date2 = moment(d)

            if (date2.isAfter(date1)) {
                if (date2.diff(date1, 'days') <= 1) {
                    basket[group].push(d)

                } else {
                    group++
                    basket.push([])
                    basket[group].push(d)
                }
            }
        }

    })
    if (simplify) {
        basket = basket.map(row => {
            let shorten = []
            shorten.push(row.at(0))
            if (row.length > 1) {
                shorten.push(row.at(-1))
            }
            return shorten
        })
    }
    return basket
}

/**
 * 
 * @param {array} dates 
 * @returns 
 */
const datesString = (dates) => {
    dates = groupDates(dates, true).map(row => {
        return row.map(d => {
            return moment(d).format('MMMM DD, YYYY')
        }).join(' to ')
    })
    return dates.join(', ')
}

module.exports = {
    groupDates: groupDates,
    datesString: datesString
}