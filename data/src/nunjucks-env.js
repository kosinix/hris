//// Core modules

//// External modules
const nunjucks = require('nunjucks');
const nunjucksFilters = require('nunjucks-filters');

//// Modules

let dirView = CONFIG.app.dirs.view; // Path to view directory

//// Setup view
// Setup nunjucks loader. See https://mozilla.github.io/nunjucks/api.html#loader
let loaderFsNunjucks = new nunjucks.FileSystemLoader(dirView, CONFIG.nunjucks.loader);

// Setup nunjucks environment. See https://mozilla.github.io/nunjucks/api.html#environment
let env = new nunjucks.Environment(loaderFsNunjucks, CONFIG.nunjucks.environment);

// Add filters
nunjucksFilters.extend(env)

// Custom app specific filter
env.addFilter('s3_url', function (value, sizePrefix = "") {
    if (sizePrefix) {
        sizePrefix += "-";
    }
    return `/file-getter/${CONFIG.aws.bucket1.name}/${CONFIG.aws.bucket1.prefix}/${sizePrefix}${value}`
})

// Convert 1d array to array of object for use by html <select> <options> 
env.addFilter('to_options', function (values, blank=true) {
    let options = []
    if(blank){
        options.push({
            value: '',
            text: ''
        })
    }
    values.forEach((v)=>{
        options.push({
            value: v,
            text: v
        })
    })
    return options
})

//// Export
module.exports = env;