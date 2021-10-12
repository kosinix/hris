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


const mail = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: CRED.gmail.username,
        pass: CRED.gmail.password
    }
});

const templates = {
    verified: async (templateVars) => {
        let data = {
            firstName: templateVars.firstName, 
            username: templateVars.username, 
            password: templateVars.password, 
            loginUrl: templateVars.loginUrl, 
            baseUrl: `${CONFIG.app.url}`
        }
        let mailOptions = {
            from: 'mis@gsc.edu.ph',
            to: templateVars.to,
            subject: 'HRIS Account',
            text: nunjucksEnv.render('emails/verified.txt', data),
            html: nunjucksEnv.render('emails/verified.html', data),
        }
        let info = await mail.sendMail(mailOptions)
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