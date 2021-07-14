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

//// Export
module.exports = env;