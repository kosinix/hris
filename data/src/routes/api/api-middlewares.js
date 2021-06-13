//// Core modules

//// External modules
const lodash = require('lodash');

//// Modules
const db = require('../../db');
const passwordMan = require('../../password-man');

module.exports = {
    getAuthApp: async (req, res, next) => {
        try {
            let authorization = lodash.get(req, 'headers.authorization', '').replace('Basic', '').replace(' ', '')
            let decoded = Buffer.from(authorization, 'base64').toString();
            let split = decoded.split(':')
            let publicId = lodash.get(split, '0', '')
            let password = lodash.get(split, '1', '')

            if (!publicId || !password) {
                throw new Error('Invalid credentials.')
            }

            if (!db.mongoose.Types.ObjectId.isValid(publicId)) {
                throw new Error('Invalid credentials.')
            }

            let user = await db.main.App.findOne({
                _id: publicId,
                active: true
            });
            if (!user) {
                throw new Error('App not found.')
            }

            // Check password
            let passwordHash = passwordMan.hashPassword(password, user.salt);
            if (passwordHash !== user.passwordHash) {
                throw new Error('Incorrect password.')
            }

            res.authApp = user;

            next();
        } catch (err) {
            next(err);
        }
    },
}