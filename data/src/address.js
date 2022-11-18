//// Core modules

//// External modules

//// Modules



module.exports = {
    build: (unit, street, village, full, zipCode) => {
        let addresses = []
        if(unit){
            addresses.push(unit)
        }
        if(street){
            addresses.push(street)
        }
        if(village){
            addresses.push(village)
        }
        if(full){
            addresses.push(full)
        }
        if(zipCode){
            addresses.push(zipCode)
        }
        return addresses.join(', ')
    }
}