//// Core modules

//// External modules
const { 
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectsCommand
} = require('@aws-sdk/client-s3') // V3 SDK

const presigner = require("@aws-sdk/s3-request-presigner")

//// Modules


const clientInstance = new S3Client({
    credentials: {
        accessKeyId: `${CRED.aws.accessKeyId}`,
        secretAccessKey: `${CRED.aws.secretAccessKey}`
    },
    region: `${CONFIG.aws.region}`,
})

/**
 * getSignedUrl
 * 
 * @param {*} bucketName 
 * @param {*} key 
 * @param {*} expiresIn Seconds for link to expire. Default 15 mins (900s)
 * @returns 
 */
const getSignedUrl = async (bucketName, key, expiresIn = 900) => {

    const input = {
        Bucket: bucketName,
        Key: key,
    };
    
    const command = new GetObjectCommand(input);
    return presigner.getSignedUrl(clientInstance, command, { expiresIn: expiresIn });
}

const putObject = async (bucketName, key, body, customPutObjectCommandParams) => {

    let input = {
        Bucket: bucketName,
        Key: key,
        Body: body,
    };
    if(customPutObjectCommandParams['ContentDisposition']){
        input['ContentDisposition'] = customPutObjectCommandParams['ContentDisposition']
    }
    if(customPutObjectCommandParams['ContentType']){
        input['ContentType'] = customPutObjectCommandParams['ContentType']
    }
    
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
    getSignedUrl: getSignedUrl,
    putObject: putObject,
    deleteObjects: deleteObjects,
}