// Some defaults
// Client side axios is almost always an ajax request. This will set req.xhr = true in express.
if (!(window['axios'] == null)) {
    window.myAxios = window['axios'].create({
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
}

function handleAxiosError(error) {
    var ret = "";
    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        ret = "Error: " + error.response.data;
    } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        // console.log('Error', error.request);
        ret = "Error: Could not connect to server.";
    } else {
        // Something happened in setting up the request that triggered an Error
        console.log('Error', error.message);
        ret = "Error: Something went wrong with the request.";
    }
    alert(ret);
    return ret;
}