//// Core modules

//// External modules
const express = require('express');

//// Modules

// Routes
let router = express.Router();
router.use(require('./routes/public'));
router.use(require('./routes/register'));
router.use(require('./routes/protected'));
router.use(require('./routes/hdf'));
router.use(require('./routes/e-profile'));
router.use(require('./routes/employee'));
router.use(require('./routes/memo'));
router.use(require('./routes/payroll'));
router.use(require('./routes/attendance'));
router.use(require('./routes/application'));
router.use(require('./routes/scanner'));
router.use(require('./routes/user'));
// router.use(require('./routes/reports'));

// 404 Page
router.use((req, res) => {
    res.status(404)
    if (req.xhr) { // response when req was ajax
        return res.send("Page not found.")
    }
    res.render('error.html', { error: "Page not found." });
});


module.exports = router;