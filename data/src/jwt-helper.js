const lodash = require('lodash')

module.exports = {
    createPayload: (user, payload, expiry) => {
        let msNow = Date.now() // milliseconds elapsed since January 1, 1970 00:00:00 UTC.
        let secondsNow = Math.floor(msNow / 1000) // Convert ms to seconds

        // Include only some props for security
        user = lodash.pickBy(user, function(_, key) {
            return [
                '_id', 
                'firstName', 
                'middleName', 
                'lastName', 
                'email'
            ].includes(key)
        });

        // Add _id aliases for flexibility
        return {
            iss: 'gsueduph',
            iat: secondsNow,
            exp: secondsNow + expiry,
            user: user,
            payload: payload
        }
    }
}