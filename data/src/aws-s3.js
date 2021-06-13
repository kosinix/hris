//// Core modules

//// External modules
const AWS = require('aws-sdk');

//// Modules

// See https://stackoverflow.com/questions/52667434/aws-s3-generating-signed-urls-accessdenied
let s3 = new AWS.S3({
    signatureVersion: 'v4',
    region: CONFIG.aws.region,
    accessKeyId: CRED.aws.accessKeyId,
    secretAccessKey: CRED.aws.secretAccessKey,
});

module.exports = s3