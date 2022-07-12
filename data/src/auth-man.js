/**
 * User authentication module
 */

//// Core modules

//// External modules
const lodash = require('lodash');

//// Modules

/**
 * Use the data that was saved in session to reconstruct the actual user
 * @param {session} Containing session
 */
const deserializeUserAsync = async (session, db) => {
    try {
        let userSessionData = lodash.get(session, 'authMan.userSessionData');
        if (!userSessionData) {
            return null
        }
        let user = await db.main.User.findById(userSessionData.id);
        if (!user) {
            return null;
        }

        return user;

    } catch (error) {
        return null;
    }
};

// Logout
const logout = (req, res) => {
    lodash.set(req.session, 'authMan', null);
    res.clearCookie(CONFIG.session.name, CONFIG.session.cookie);
}

/**
 * Serialize user into an object and save on session
 * Requires: session middleware
 *
 * @param {Object} data These are the data that gets saved in session
 *
 * @returns {Object}
 */
const serializeUser = (req, data) => {
    lodash.set(req.session, `authMan.userSessionData`, data);
    return data;
};


module.exports = {
    // Do not allow unauthorized users to access the page
    // Adds res.user
    getUser: async (req, res, next) => {
        try {
            let user = await deserializeUserAsync(req.session, req.app.locals.db);

            if (!user) {
                return res.redirect('/login')
            }
            res.user = user;

            next();
        } catch (err) {
            next(err);
        }
    },
    logout: logout,
    serializeUser: serializeUser,
}