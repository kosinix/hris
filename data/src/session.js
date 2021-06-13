//// Core modules

//// External modules
const session = require('express-session'); // Session engine
const MongoDBStore  = require('connect-mongodb-session')(session);

// Use the session middleware
// See options in https://github.com/expressjs/session
module.exports = session({
    name: CONFIG.session.name,
    store: new MongoDBStore ({
        uri: `mongodb://${CRED.mongodb.connections.main.username}:${CRED.mongodb.connections.main.password}@${CONFIG.mongodb.connections.main.host}/${CONFIG.mongodb.connections.main.db}?retryWrites=false`,
        collection: 'sessions'
    }),
    secret: CRED.session.secret,
    cookie: CONFIG.session.cookie,
    resave: false,
    saveUninitialized: false
});