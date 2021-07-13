//// Core modules
const fs = require('fs');

//// External modules

//// Modules


let contents = fs.readFileSync(`${CONFIG.app.dir}/scripts/install-data/countries.csv`, {
    encoding: 'binary'
})
module.exports = contents.split("\r\n").map((v)=>{
    return v.replace(/"/g, '')
})



