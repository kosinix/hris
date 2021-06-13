//// Core modules

//// External modules
const lodash = require('lodash');

//// Modules

/*

Error type module

Usage:
    
*/

// Change values that are not instanceof Error into Error
let normalizeError = function (error) {

    switch (typeof error) { // With switch case, we can use the stack trace and find out what the original error type is
        case "undefined":
            return new Error(error);

        case "boolean":
            return new Error(error);

        case "number":
            return new Error(error);

        case "string":
            return new Error(error);

        case "symbol":
            return new Error(error);

        case "function":
            return new Error(error);

        case "object": // typeof null === 'object' and everything else
            if (error instanceof Error) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                if (error.response) { // This is axios
                    // Trim error
                    delete error.config
                    delete error.request
                    delete error.response.config
                    delete error.response.request
                    // Reformat into Dash error format
                    let errMessage = lodash.get(error, 'response.data.message', '')
                    if(errMessage){
                        let err = new Error(errMessage)
                        let errCode = lodash.get(error, 'response.data.code')
                        let errExtra = lodash.get(error, 'response.data.extra')
                        if(errCode){
                            err.code = errCode
                        }
                        if(errExtra){
                            err.extra = errExtra
                        }
                        return err
                    }

                    // Just return a trimmed axios error
                    return error;
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                // http.ClientRequest in node.js
                } else if (error.request) { // This is axios
                    // Trim error 
                    delete error.config
                    delete error.request
                    return error;
                } else { // Regular error
                    return error;
                }
            }

            return new Error(error);

        default:
            return new Error(error);
    }

};


// Export
module.exports = {
    normalizeError: normalizeError
};

