/**
 * Generates random string and password hashing
 * @type {module:crypto}
 */

//// Core modules
const crypto = require('crypto');
const util = require('util');

//// External modules

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
    }
}