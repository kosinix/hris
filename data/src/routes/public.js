//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')
const qr = require('qr-image')

//// Modules
const db = require('../db')
const passwordMan = require('../password-man')

// Router
let router = express.Router()

router.get('/login', async (req, res, next) => {
    try {
        if(lodash.get(req, 'session.authUserId')){
            return res.redirect(`/`)
        }
        // console.log(req.session)
        let ip = req.headers['x-real-ip'] || req.connection.remoteAddress;
        res.render('login.html', {
            flash: flash.get(req, 'login'),
            ip: ip,
            username: lodash.get(req, 'query.username', ''),
        });
    } catch (err) {
        next(err);
    }
});
router.post('/login', async (req, res, next) => {
    try {
        let post = req.body;

        let username = lodash.get(post, 'username', '');
        let password = lodash.trim(lodash.get(post, 'password', ''))

        // Find admin
        let user = await db.main.User.findOne({ username: username });
        if (!user) {
            throw new Error('Incorrect username or password.')
        }

        if (!user.active) {
            throw new Error('Your account is deactivated.');
        }

        // Check password
        let passwordHash = passwordMan.hashPassword(password, user.salt);
        if (passwordHash !== user.passwordHash) {
            throw new Error('Incorrect password.');
        }

        // Save user id to session
        lodash.set(req, 'session.authUserId', user._id);

        // Security: Anti-CSRF token.
        let antiCsrfToken = await passwordMan.randomStringAsync(16)
        lodash.set(req, 'session.acsrf', antiCsrfToken);

        if (user.roles.includes('employee')) {
            return res.redirect('/e-profile/home')
        }
        if (user.roles.includes('campusdirectormosqueda') || user.roles.includes('campusdirectorbaterna')) {
            return res.redirect('/attendance/monthly')
        }
        if (user.roles.includes('checker')) {
            let scanner = await db.main.Scanner.findOne({
                userId: user._id
            })
            if (scanner) {
                return res.redirect(`${CONFIG.app.url}/scanner/${scanner.uid}/scan`)
            }
        }
        return res.redirect('/');
    } catch (err) {
        flash.error(req, 'login', err.message);
        return res.redirect('/login');
    }
});

router.get('/logout', async (req, res, next) => {
    try {
        lodash.set(req, 'session.authUserId', null);
        lodash.set(req, 'session.acsrf', null);
        lodash.set(req, 'session.flash', null);
        res.clearCookie(CONFIG.session.name, CONFIG.session.cookie);

        res.redirect('/login');
    } catch (err) {
        next(err);
    }
});

router.get('/data-privacy', async (req, res, next) => {
    try {
        res.render('data-privacy.html');
    } catch (err) {
        next(err);
    }
});

// TODO: Remove when done
router.get('/query/employment', async (req, res, next) => {
    try {
        let search = lodash.get(req, 'query.s', '');
        let keys = search.split(' ')
        keys = lodash.map(keys, (o) => {
            o = lodash.trim(o)
            return new RegExp(o, "i")
        })
        // console.log(keys)
        // Our address returned starts from bgy level
        let query = {
            $or: [
                {
                    firstName: keys[0]
                },
                {
                    lastName: keys[0]
                },
            ]
        }

        // console.log(util.inspect(query, false, null, true /* enable colors */))
        // raw ops
        // let employees = await db.main.Employee.collection.find(query).limit(10).toArray()
        let aggr = []
        aggr.push({ $match: query })
        aggr.push({ $limit: 10 })
        aggr.push({
            $lookup:
            {
                from: "employments",
                localField: "_id",
                foreignField: "employeeId",
                as: "employments"
            }
        })

        let employees = await db.main.Employee.aggregate(aggr)
        let ret = []
        employees.forEach((employee, i) => {
            let full = [employee.firstName]
            if (employee.lastName) {
                full.push(employee.lastName)
            }
            full = full.join(' ')

            employee.employments.forEach((employment, i) => {
                let final = `${full} - ${employment.position}`
               
                ret.push({
                    id: employment._id,
                    name: final
                })
            })
        })

        return res.send(ret)

    } catch (err) {
        next(err);
    }
});
module.exports = router;