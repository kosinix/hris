(async () => {
    //// Core modules
    const http = require('http')
    const cors = require('cors')

    //// External modules
    const express = require('express')
    const bodyParser = require('body-parser')
    const cookieParser = require('cookie-parser')
    const lodash = require('lodash')
    const moment = require('moment')
    const { Server } = require('socket.io')

    //// Modules
    const db = require('./db-connect')
    const errors = require('./errors')
    const nunjucksEnv = require('./nunjucks-env')
    const routes = require('./routes')
    const session = require('./session')
    const middlewares = require('./middlewares')
    const cron = require('./cron')

    cron.run()

    //// Create app
    const app = express()

    //// Server and socket.io
    const httpServer = http.createServer(app)
    const io = new Server(httpServer, CONFIG.socketio)

    //// Setup view
    nunjucksEnv.express(app)

    // Connect to db and save
    app.locals.db = await db.connect()

    // Remove express
    app.set('x-powered-by', false);

    //// Middlewares
    app.use(cors({
        // origin: 'https://scanner.localhost:9095',
        origin: 'http://localhost:8080',
        optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
    }))

    // Assign view variables once - on app start
    app.use(middlewares.perAppViewVars);

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
    app.use(middlewares.perRequestViewVars);

    //// Sane titles
    app.use(middlewares.saneTitles);

    //// Socket IO middlewares and handlers
    // Wrapper function
    const expressToSocketMiddleware = (middleware) => {
        return (socket, next) => {
            return middleware(socket.request, {}, next)
        }
    }
    const authSocket = (socket, next) => {
        let authUserId = lodash.get(socket, 'request.session.authUserId');
        if (!authUserId) {
            next(new Error("Unauthorized"));
        } else {
            next()
        }
    }
    const onSocketConnect = (socket) => {
        let room = lodash.get(socket, 'handshake.query.room')
        if (room) {
            socket.join(room)
        }
    }
    io.use(expressToSocketMiddleware(session));
    io.use(authSocket);
    let scanners = [] // List of scanner IDs
    io.use(async (socket, next) => {
        try {
            let scannerId = lodash.get(socket, 'handshake.query.scanner')
            if (!scannerId) {
                throw new Error('Need scanner ID.')
            }
            let scanner = await app.locals.db.main.Scanner.findById(scannerId)
            if (!scanner) {
                throw new Error("Scanner not found.")
            }
            if (scanners.includes(scannerId)) {
                throw new Error("Duplicate scanner.")
            }
            socket.data.scannerId = scannerId
            next()
        } catch (err) {
            next(err)
        }
    });
    io.on('connection', async (socket) => {
        try {
            let scannerId = lodash.get(socket, 'data.scannerId') // From middleware

            scanners.push(scannerId) // Add to main list
            socket.join(scannerId) // Scanner id as room

            socket.on('scansfromclient', async (payload) => {
                try {
                    if (payload.scannerId && payload.scans) {
                        let scannerId = payload.scannerId
                        let scanner = await app.locals.db.main.Scanner.findById(scannerId)
                        if (scanner) {
                            scanner.scans = payload.scans
                            await scanner.save()
                        }
                    }
                } catch (err) {
                    console.error(err)
                }
            })
            socket.on('refreshed', async (scannerId) => {
                try {
                    if (scannerId) {
                        let scanner = await app.locals.db.main.Scanner.findById(scannerId)
                        if (scanner) {
                            scanner.refresh = false
                            await scanner.save()
                        }
                    }
                } catch (err) {
                    console.error(err)
                }
            })
            socket.on('disconnect', async () => {
                try {
                    await app.locals.db.main.Scanner.updateOne({ _id: scannerId }, {
                        online: false
                    })
                    await app.locals.db.main.ScannerPing.create({
                        scannerId: scannerId,
                        status: 0
                    })
                    scanners = scanners.filter((s) => {
                        return scannerId != s
                    })
                } catch (err) {
                    console.error(err)
                }
            });

            await app.locals.db.main.Scanner.updateOne({ _id: scannerId }, {
                online: true
            })

            await app.locals.db.main.ScannerPing.create({
                scannerId: scannerId,
                status: 1
            })
        } catch (err) {
            console.error(err)
        }
    });

    // Flag raising namespaced websocket connection
    io.of("/flag-raising").use(expressToSocketMiddleware(session));
    io.of("/flag-raising").use(authSocket);
    io.of("/flag-raising").on('connection', onSocketConnect)

    // Flag lowering namespaced websocket connection
    io.of("/flag-lowering").use(expressToSocketMiddleware(session));
    io.of("/flag-lowering").use(authSocket);
    io.of("/flag-lowering").on('connection', onSocketConnect)

    // Monitoring of attendance
    io.of("/monitoring").use(expressToSocketMiddleware(session));
    io.of("/monitoring").use(authSocket);
    io.of("/monitoring").on('connection', onSocketConnect)

    // Sockets IO
    app.locals.io = io

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
                if (error.redirect) {
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
        console.log(`${moment().format('YYYY-MMM-DD hh:mm:ss A')}: App running in "${ENV}" mode at "${CONFIG.app.url}"`);
    });
    httpServer.keepAliveTimeout = 60000 * 2;
})()