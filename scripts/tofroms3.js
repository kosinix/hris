/**
 * Insert default admin users.
 * Usage
 * 
 * Windows:
 *  set FILE_NAME=backup_2023-01-12.zip&& node tofroms3.js
 * 
 * Linux: 
 *  FILE_NAME=backup_2023-01-12.zip node tofroms3.js
 */
//// Core modules
const fs = require('fs')
const path = require('path')
const process = require('process')

//// External modules
const lodash = require('lodash')
const pigura = require('pigura')

//// Modules
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')


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
            console.log(`Downloading from hris-gsu-ph/backups/${FILE_NAME} ...`)
            let result = await client.send(new GetObjectCommand(
                {
                    Bucket: `hris-gsu-ph`,
                    Key: `backups/${FILE_NAME}`
                }
            ))
            const inputStream = result.Body
            const totalSize = result.ContentLength
            let downloadedSize = 0
            let percentage = 0
            let newPercentage = 0
            const outputStream = fs.createWriteStream(`${CONFIG.app.dirs.upload}/${FILE_NAME}`);
            inputStream.pipe(outputStream);
            inputStream.on('data', (chunk) => {
                downloadedSize += chunk.length
                newPercentage = Math.round(downloadedSize / totalSize * 100)
                if (newPercentage > percentage) {
                    console.log(`Downloading ${(downloadedSize / 1000000).toFixed(2)} MB of ${(totalSize / 1000000).toFixed(2)} MB (${newPercentage}%)...`)
                    percentage = newPercentage
                }
            })
            outputStream.on('finish', () => {
                console.log(`Downloaded to ${CONFIG.app.dirs.upload}/${FILE_NAME}.`)
            });

        } catch (err) {
            console.error(err)
        } finally {
        }
    })()


