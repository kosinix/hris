//// Core modules
const fs = require('fs');

//// External modules

//// Modules


let contents = fs.readFileSync(`${CONFIG.app.dir}/scripts/install-data/countries.csv`, {
    encoding: 'binary'
})
let list = contents.split("\r\n").map((v) => {
    return v.replace(/"/g, '')
})
let options = list.map((v) => {
    return {
        value: v,
        text: v
    }
})
options.unshift({ value: '', text: '' })

module.exports = {
    list: list,
    options: options
}


