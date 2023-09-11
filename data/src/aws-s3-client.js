//// Core modules

//// External modules
const { 
    S3Client,
    PutObjectCommand,
    DeleteObjectsCommand
} = require('@aws-sdk/client-s3') // V3 SDK

//// Modules


const clientInstance = new S3Client({
    credentials: {
        accessKeyId: `${CRED.aws.accessKeyId}`,
        secretAccessKey: `${CRED.aws.secretAccessKey}`
    },
    region: `${CONFIG.aws.region}`,
})

const putObject = async (bucketName, key, body) => {

    const input = {
        Bucket: bucketName,
        Key: key,
        Body: body,
    };
    
    const command = new PutObjectCommand(input)
    return clientInstance.send(command) // Promise
}

const deleteObjects = async (bucketName, objects) => {

    const input = {
        Bucket: bucketName,
        Delete: {
            Objects: objects,
            // Quiet: true
        }
    };
    const command = new DeleteObjectsCommand(input)
    return clientInstance.send(command) // Promise
}

module.exports = {
    clientInstance: clientInstance,
    putObject: putObject,
    deleteObjects: deleteObjects,
}