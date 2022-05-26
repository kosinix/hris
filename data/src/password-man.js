/**
 * Generates random string and password hashing
 * @type {module:crypto}
 */

//// Core modules
const crypto = require('crypto')
const buffer = require('buffer')
const util = require('util')

//// External modules
const lodash = require('lodash')

//// Modules
let randomBytesAsync = util.promisify(crypto.randomBytes)

module.exports = {
    randomStringAsync: async (length = 32) => {
        let bytes = await randomBytesAsync(length / 2);
        return bytes.toString('hex');
    },
    randomString: (length = 32) => {
        let bytes = crypto.randomBytes(length / 2);
        return bytes.toString('hex');
    },
    hashPassword: (password, salt) => {
        return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    },
    hashSha256: (text) => {
        return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
    },
    genUsername: (firstName, lastName) => {
        let firstNames = firstName.split(' ')
        firstName = lodash.toLower(firstNames.shift())
        if (firstName === 'ma.') {
            firstName = lodash.toLower(firstNames.shift()) // second name
        }
        lastName = lastName.replace(/ /g, '') // remove spaces for maam josephine "de asis"
        return lodash.toLower(`${lastName}`) + '.' + lodash.toLower(`${firstName}`)
    },
    genPassword: (length) => { // Guarantees 1 upper and 1 special char in a random string
        const upperChars = "ABCDEFGHIJKLMNPQRSTUVWXYZ"
        const specialChars = `!@#$_?]=` // Use only less confusing characters

        let bytes = crypto.randomBytes(length / 2);
        let hex = bytes.toString('hex').split('') // convert to array

        let randLocation = crypto.randomInt(0, hex.length)

        hex[randLocation] = specialChars[crypto.randomInt(0, specialChars.length)]
        let randLocation2 = crypto.randomInt(0, hex.length)
        while (randLocation2 === randLocation) { // Do not overwrite character in randLocation
            randLocation2 = crypto.randomInt(0, hex.length)
        }
        hex[randLocation2] = upperChars[crypto.randomInt(0, upperChars.length)]
        return hex.join('')
    },
    genPassUpperCase: function(length = 10) {
        const buf = buffer.Buffer.alloc(length / 2)
        crypto.randomFillSync(buf)
        return buf.toString('hex').toUpperCase()
    }
}