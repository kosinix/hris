//// Core modules
const fs = require('fs');

//// External modules

//// Modules



let contents = fs.readFileSync(`${CONFIG.app.dir}/scripts/install-data/suffixes.csv`, {
    encoding: 'binary'
})
let list = contents.split(/\r?\n/g).map((v)=>{
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
    options: options,
}


