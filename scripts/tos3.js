/**
 * Insert default admin users.
 * Usage
 * 
 * Windows:
 *  set FILE_NAME=backup_2023-01-12.zip&& node tos3.js
 * 
 * Linux: 
 *  FILE_NAME=backup_2024-09-16.zip node tos3.js
 */
//// Core modules
const fs = require('fs')
const path = require('path')
const process = require('process')

//// External modules
const lodash = require('lodash')
const pigura = require('pigura')

//// Modules
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')


//// First things first
//// Save full path of our root app directory and load config and credentials
global.APP_DIR = path.resolve(__dirname + '/../').replace(/\\/g, '/') // Turn back slash to slash for cross-platform compat
global.ENV = lodash.get(process, 'env.NODE_ENV', 'dev')

const configLoader = new pigura.ConfigLoader({
    configName: './configs/config.json',
    appDir: APP_DIR,
    env: ENV,
    logging: true
})
global.CONFIG = configLoader.getConfig()

const credLoader = new pigura.ConfigLoader({
    configName: './credentials/credentials.json',
    appDir: APP_DIR,
    env: ENV,
    logging: true
})
global.CRED = credLoader.getConfig()


    ; (async () => {
        try {
            const FILE_NAME = lodash.get(process, 'env.FILE_NAME', '')

            const client = new S3Client({
                credentials: {
                    accessKeyId: `${CRED.aws.accessKeyId}`,
                    secretAccessKey: `${CRED.aws.secretAccessKey}`
                },
                region: `${CONFIG.aws.region}`,
            })
            // 
            console.log(`Opening ${CONFIG.app.dirs.upload}/${FILE_NAME}...`)
            let body = fs.readFileSync(`${CONFIG.app.dirs.upload}/${FILE_NAME}`)

            console.log(`Uploading...`)
            await client.send(new PutObjectCommand(
                {
                    Body: body,
                    Bucket: `hris-gsu-ph`,
                    Key: `backups/${FILE_NAME}`
                }
            ))
            console.log(`Uploaded to hris-gsu-ph/backups/${FILE_NAME}.`)


        } catch (err) {
            console.error(err)
        } finally {
        }
    })()


