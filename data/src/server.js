//// Core modules
const http = require('http')
const cors = require('cors')

//// External modules
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const lodash = require('lodash')
const { Server } = require('socket.io')

//// Modules
const db = require('./db')
const errors = require('./errors')
const nunjucksEnv = require('./nunjucks-env')
const routes = require('./routes')
const session = require('./session')


//// Create app
const app = express()

//// Server and socket.io
const httpServer = http.createServer(app)
const io = new Server(httpServer, CONFIG.socketio)


//// Setup view
nunjucksEnv.express(app)

// Remove express
// app.set('x-powered-by', false);

//// Middlewares
app.use(cors({
    origin: 'https://scanner.localhost:9095',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}))

// Assign view variables once - on app start
app.use(function (req, res, next) {
    app.locals.app = {}
    app.locals.app.title = CONFIG.app.title;
    app.locals.app.description = CONFIG.description;
    app.locals.CONFIG = lodash.cloneDeep(CONFIG) // Config
    req.io = io
    next();
});

// Session middleware
app.use(session);

// Static public files
app.use(express.static(CONFIG.app.dirs.public));

// Parse http body
app.use(bodyParser.json({ limit: '50mb' }));       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    limit: '50mb',
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
            if (user) {
                user = lodash.pickBy(user.toObject(), (_, key) => {
                    return !['createdAt', 'updatedAt', '__v', 'passwordHash', 'salt'].includes(key) // Remove these props
                })
            }
            res.locals.user = user
        }

        res.locals.acsrf = lodash.get(req, 'session.acsrf');

        res.locals.url = req.url
        res.locals.urlPath = req.path
        res.locals.query = req.query

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

// Socker IO middlewares and handlers
let scanners = [] // List of scanner IDs
io.use(async (socket, next) => {
    try {
        let scannerId = lodash.get(socket, 'handshake.query.scanner')
        if (!scannerId) {
            return next(new Error("Missing scanner details."));
        }

        let scanner = await db.main.Scanner.findById(scannerId)
        if (!scanner) {
            return next(new Error("Scanner not found."));
        }

        if (scanners.includes(scannerId)) {
            return next(new Error("Duplicate scanner."));
        }

        socket.request.scanner = scanner
        next()
    } catch (err) {
        next(err)
    }
});

io.on('connection', function (socket) {
    let scannerId = lodash.get(socket, 'handshake.query.scanner')
    let scanner = lodash.get(socket, 'request.scanner')
    // console.log(socket.request)
    // console.log(`A scanner connected`, scanner, 'with socket ID', socket.id);
    scanners.push(scannerId)

    scanner.online = true
    scanner.save().then((r) => {
        // console.log('Saved', r)
    }).catch((err) => {
        console.error(err)
    })

    socket.on('disconnect', function () {
        // console.log(`A scanner disconnected`, scanner, 'with socket ID', socket.id);
        scanner.online = false
        scanner.save().then((r) => {
            // console.log('Saved', r)
        }).catch((err) => {
            console.error(err)
        })

        scanners = scanners.filter((s) => {
            return scannerId != s
        })
    });
});

//// Routes
app.use(routes);

// Error handler
/**
 * Handle error for Ajax requests (HTTP headers: {'X-Requested-With': 'XMLHttpRequest'})
 * or
 * If request urls start with /api
 */
app.use(function (error, req, res, next) {
    if (res.headersSent) { // Delegate to the default Express error handler, when the headers have already been sent to the client
        return next(error)
    }

    if (req.xhr || /^\/api\//.test(req.originalUrl)) {
        res.status(400)
        let publicMessage = 'XHR Error...'
        if (req.xhr) {
            console.log(publicMessage)
        }
        if (/^\/api\//.test(req.originalUrl)) {
            publicMessage = 'API Error...'
            console.log(publicMessage)
        }
        console.error(error)
        return res.send(error.message)
    }


    next(error)
});

app.use(function (error, req, res, next) {
    try {
        req.socket.on("error", function (err) {
            console.error(err);
        });
        res.socket.on("error", function (err) {
            console.error(err);
        });

        if (error.type === 'flash') {
            if(error.redirect){
                return res.status(400).redirect(error.redirect)
            }
        }

        error = errors.normalizeError(error);
        console.error(req.originalUrl)
        console.error(error)
       
        if (/^\/register\//.test(req.originalUrl)) {
            return res.status(500).render('error-public.html', { error: error.message });
        }

        // Anything that is not catched
        res.status(500).render('error.html', { error: error.message });
    } catch (err) {
        // If an error handler had an error!! 
        error = errors.normalizeError(err);
        console.error(req.originalUrl)
        console.error(error)
        res.status(500).send('Unexpected error!');
    }
});

// Finally the server
httpServer.listen(CONFIG.app.port, function () {
    console.log(`App running in "${ENV}" mode at "${CONFIG.app.url}"`);
});
httpServer.keepAliveTimeout = 60000 * 2;