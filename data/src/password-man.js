/**
 * Generates random string and password hashing
 * @type {module:crypto}
 */

//// Core modules
const crypto = require('crypto');
const util = require('util');

//// External modules
const lodash = require('lodash');

//// Modules
let randomBytesAsync = util.promisify(crypto.randomBytes);

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
    genUsername: (firstName, lastName) => {
        let firstNames = firstName.split(' ')
        firstName = lodash.toLower(firstNames.shift())
        if(firstName === 'ma.'){
            firstName = lodash.toLower(firstNames.shift()) // second name
        }
        lastName = lastName.replace(/ /g, '') // remove spaces for maam josephine "de asis"
        return lodash.toLower(`${lastName}`)+'.'+lodash.toLower(`${firstName}`)
    }
}