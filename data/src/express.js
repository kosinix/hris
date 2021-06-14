//// Core modules

//// External modules
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const lodash = require('lodash');

//// Modules
const db = require('./db');
const errors = require('./errors');
const logger = require('./logger');
const nunjucksEnv = require('./nunjucks-env');
const routes = require('./routes');
const session = require('./session');


//// Create app
const app = express();

//// Setup view
// nunjucksEnv.addGlobal('constants', constants)
nunjucksEnv.express(app);

// Remove express
app.set('x-powered-by', false);

//// Middlewares

// Assign view variables once - on app start
app.use(function (req, res, next) {
    app.locals.app = {}
    app.locals.app.title = CONFIG.app.title;
    app.locals.app.description = CONFIG.description;
    app.locals.CONFIG = lodash.cloneDeep(CONFIG) // Config
    next();
});

// Session middleware
app.use(session);

// Static public files
app.use(express.static(CONFIG.app.dirs.public));

// Parse http body
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));

// Cookies
app.use(cookieParser());

//// Set express vars
// Indicates the app is behind a front-facing proxy, and to use the X-Forwarded-* headers to determine the connection and the IP address of the client.
app.set('trust proxy', CONFIG.express.trustProxy);


//// Assign view variables per request
app.use(async (req, res, next) => {
    try {
        res.locals.user = null
        let authUserId = lodash.get(req, 'session.authUserId');
        if (authUserId) {
            let user = await db.main.User.findById(authUserId)
            if(user) {
                user = lodash.pickBy(user.toObject(), (_, key) => {
                    return !['createdAt', 'updatedAt', '__v', 'passwordHash', 'salt'].includes(key) // Remove these props
                })
            }
            res.locals.user = user
        }

        res.locals.acsrf = lodash.get(req, 'session.acsrf');

        res.locals.urlPath = req.path

        let bodyClass = 'page' + (req.baseUrl + req.path).replace(/\//g, '-');
        bodyClass = lodash.trim(bodyClass, '-');
        bodyClass = lodash.trimEnd(bodyClass, '.html');
        res.locals.bodyClass = bodyClass; // global body class css

        res.locals.hideNav = lodash.get(req, 'cookies.hideNav', 'true')

        next();
    } catch (error) {
        next(error);
    }
});

//// Sane titles
app.use(async (req, res, next) => {
    try {
        if (!res.locals.title && !req.xhr) {
            let title = lodash.trim(req.originalUrl.split('/').join(' '));
            title = lodash.trim(title.replace('-', ' '));
            let words = lodash.map(title.split(' '), (word) => {
                return lodash.capitalize(word);
            })
            title = words.join(' - ')
            if (title) {
                res.locals.title = `${title} | ${app.locals.app.title} `;
            }
        }
        next();
    } catch (error) {
        next(error);
    }
});

//// Routes
app.use(routes);

// Error handler
app.use(function (error, req, res, next) {
    try {
        if (res.headersSent) {
            return next(error);
        }
        req.socket.on("error", function (err) {
            logger.error(err);
        });
        res.socket.on("error", function (err) {
            logger.error(err);
        });


        error = errors.normalizeError(error);
        logger.error(req.originalUrl)
        logger.error(error)
        if (req.xhr) { // response when req was ajax
            return res.status(400).send(error.message)
        }
        if (/^\/api\//.test(req.originalUrl)) {
            return res.status(500).send('API error...');
        }

        // Anything that is not catched
        res.status(500).render('error.html', {error: error.message});
    } catch (err) {
        // If an error handler had an error!! 
        error = errors.normalizeError(err);
        logger.error(req.originalUrl)
        logger.error(error)
        res.status(500).send('Unexpected error!');
    }
});

//// Export
module.exports = app;