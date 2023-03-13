//// Core modules
const process = require('process')
const { exec, execSync } = require('child_process')
const util = require('util')
const execAsync = util.promisify(exec)

//// External modules
const moment = require('moment')
const cron = require('node-cron')

//// Modules
const mailer = require('./mailer')


const IS_WIN = process.platform === 'win32'

// Export
module.exports = {
    run: () => {
        const cronJob = () => {

            console.log('Running backup task.')

            let date = moment().format(`YYYY-MM-DD`)
            let backupFileName = `backup_${date}`
            let backupFile = `${CONFIG.app.dirs.upload}/${backupFileName}`
            let cmd = `mongodump --uri=mongodb://${CRED.mongodb.connections.root.username}:${CRED.mongodb.connections.root.password}@127.0.0.1:27017/hrmo?authSource=admin --out=${backupFile} --gzip`
            let opt = {}

            let cmd2 = `zip -r ${backupFile}.zip ${backupFile}`
            let cmd3 = `FILE_NAME=${backupFileName}.zip node scripts/tos3.js`
            let opt3 = { cwd: CONFIG.app.dir }

            if (IS_WIN) {

                backupFile = `${CONFIG.app.dirs.upload}/${backupFileName}`
                cmd = `mongodump --uri=mongodb://${CRED.mongodb.connections.root.username}:${CRED.mongodb.connections.root.password}@127.0.0.1:27017/hrmo?authSource=admin --out=${backupFile} --gzip`
                opt = { cwd: `C:/Program Files/MongoDB/Server/4.0/bin` }

                cmd2 = `powershell Compress-Archive -Force ${backupFile} ${backupFile}.zip`
                cmd3 = `set FILE_NAME=${backupFileName}.zip&& node scripts/tos3.js`
                opt3 = { cwd: CONFIG.app.dir }

            }

            // Dump
            const child = exec(cmd, opt, (err) => {
                if (err) {
                    console.error(err)
                    return
                }
                console.log(`Database dumped to ${backupFile}.`)

                // Zip
                const child2 = exec(cmd2, opt, (err) => {
                    if (err) {
                        console.error(err)
                        return
                    }
                    console.log(`Database compressed to ${backupFile}.zip`)

                    // S3
                    const child3 = exec(cmd3, opt3, (err) => {
                        if (err) {
                            console.error(err)
                            return
                        }
                        console.log(`Uploaded to hris-gsu-ph/backups/${backupFileName}.zip`)

                        mailer.send('backup-message.html', {
                            to: 'amarillanico@gmail.com',
                            backupFile: `Local: ${backupFile} and Cloud: hris-gsu-ph/backups/${backupFileName}.zip`,
                            firstName: 'Nico'
                        }).then(function (result) {
                            // console.log(result, 'Email sent')
                        }).catch(err => {
                            console.error(err)
                        })

                        // console.log(`stdout: ${stdout}`);
                        // console.log(`stderr: ${stderr}`);
                    });

                    // console.log(`stdout: ${stdout}`);
                    // console.log(`stderr: ${stderr}`);
                });

                // console.log(`stdout: ${stdout}`);
                // console.log(`stderr: ${stderr}`);
            });

        }

        // 12AM everday
        console.log('Running backup task 12AM everday.')
        cron.schedule('0 0 * * *', cronJob)
        cronJob()
    }
}

