//// Core modules

//// External modules
const express = require('express');

//// Modules

// Routes
let router = express.Router();
router.use(require('./routes/api'));
router.use(require('./routes/public'));
router.use(require('./routes/shared'));
router.use(require('./routes/register'));
router.use(require('./routes/registration'));
router.use(require('./routes/protected'));
router.use(require('./routes/hdf'));
router.use(require('./routes/clinic'));
router.use(require('./routes/e-dtr'));
router.use(require('./routes/pds'));
router.use(require('./routes/missing'));
router.use(require('./routes/e-account'));
router.use(require('./routes/e-profile'));
router.use(require('./routes/hros'));
router.use(require('./routes/online-services'));
router.use(require('./routes/employee'));
router.use(require('./routes/department'));
router.use(require('./routes/memo'));
router.use(require('./routes/payroll'));
router.use(require('./routes/payroll2'));
router.use(require('./routes/attendance'));
router.use(require('./routes/schedule'));
router.use(require('./routes/scanner'));
router.use(require('./routes/user'));
router.use(require('./routes/support'));
router.use(require('./routes/account'));
router.use(require('./routes/auto-complete'));
router.use(require('./routes/reports'));
router.use(require('./routes/options'));

// 404 Page
router.use((req, res) => {
    res.status(404)
    if (req.xhr || /^\/api\//.test(req.originalUrl)) {
        return res.send("Page not found.")
    }
    res.render('error.html', { error: "Page not found." });
});


module.exports = router;