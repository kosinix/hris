//// Core modules

//// External modules
const nodemailer = require('nodemailer');

//// Modules

// AWS
const transport = nodemailer.createTransport({
    host: 'email-smtp.ap-southeast-1.amazonaws.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: CRED.aws.ses.smtp.username,
        pass: CRED.aws.ses.smtp.password
    }
});

module.exports = transport