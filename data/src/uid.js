//// Core modules

//// External modules
const nanoid = require('nanoid');

//// Modules


module.exports = {
    gen: (length = 12) => {
        return nanoid.customAlphabet('1234567890', length)()
    }
}