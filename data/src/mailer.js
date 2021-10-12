/**
 * https://morioh.com/p/ca75996654d1
 * https://myaccount.google.com/lesssecureapps
 * 
 */

//// Core modules

//// External modules
const nodemailer = require('nodemailer');

//// Modules
const nunjucksEnv = require('./nunjucks-env')

// Gmail
const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: CRED.gmail.username,
        pass: CRED.gmail.password
    }
});

// AWS
const transport2 = nodemailer.createTransport({
    host: 'email-smtp.ap-southeast-1.amazonaws.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: CRED.aws.ses.smtp.username,
        pass: CRED.aws.ses.smtp.password
    }
});

const templates = {
    verified: async (templateVars) => {
        let data = {
            firstName: templateVars.firstName,
            username: templateVars.username,
            password: templateVars.password,
            loginUrl: templateVars.loginUrl,
            baseUrl: `${CONFIG.app.url}`,
            previewText: `Greetings ${templateVars.firstName}! These are the login credentials for your HRIS account...`
        }
        let mailOptions = {
            from: 'GSC MIS <mis@gsc.edu.ph>',
            to: templateVars.to,
            subject: 'HRIS Account',
            text: nunjucksEnv.render('emails/verified.txt', data),
            html: nunjucksEnv.render('emails/verified.html', data),
        }
        let info = await transport2.sendMail(mailOptions)
        // console.log(info.response)
        return info
    }
}

module.exports = {
    send: async (templateName, templateVars) => {
        if (templateName === 'verified.html') {
            return await templates.verified(templateVars)
        } else {
            throw new Error(`Template ${templateName} not found.`)
        }
    }
}