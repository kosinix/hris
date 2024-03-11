/**
 * Generates random string and password hashing
 * @type {module:crypto}
 */

//// Core modules
const crypto = require('crypto')
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
    genPassword: (length = 10) => { // Guarantees 1 upper and 1 special char in a random string
        const upperChars = "ABCDEFGHJKLMNPQRSTUVWXYZ".split('')
        const lowerChars = "abcdefghjkmnpqrstuvwxyz23456789".split('')
        const specialChars = "-?!%".split('')

        let newChars = []
        for (let x = 0; x < length; x++) {
            if (x === 0) {
                newChars.push(upperChars[crypto.randomInt(0, upperChars.length)])
            } else if (x === length - 1) {
                newChars.push(specialChars[crypto.randomInt(0, specialChars.length)])
            } else {
                newChars.push(lowerChars[crypto.randomInt(0, lowerChars.length)])
            }
        }

        return newChars.join('')
    },
    genPassphrase: (totalWords = 6) => {
        let passphrases = require('./passphrase-words')
        passphrases = passphrases.split("\n")

        let words = []
        for (let x = 0; x < totalWords; x++) {
            let index = `${crypto.randomInt(1, 6)}${crypto.randomInt(1, 6)}${crypto.randomInt(1, 6)}${crypto.randomInt(1, 6)}${crypto.randomInt(1, 6)}`
            let word = passphrases.find(w => w.includes(index))
            if(word) word = word.replace(index+' ','')
            words.push(word)
        }

        return words.join(' ')
    }
}