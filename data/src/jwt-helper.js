

module.exports = {
    createPayload: (user, scanner) => {
        let msNow = Date.now() // milliseconds elapsed since January 1, 1970 00:00:00 UTC.
        let secondsNow = Math.floor(msNow / 1000) // Convert ms to seconds
        let expiry = CONFIG.session.cookie.maxAge / 1000 //(in seconds) 

        // Remove for security
        user.passwordHash = null
        user.salt = null

        // Add _id aliases for flexibility
        user.id = user._id
        scanner.id = scanner._id
        return {
            iss: 'gsueduph',
            exp: secondsNow + expiry,
            user: user,
            scanner: scanner
        }
    }
}