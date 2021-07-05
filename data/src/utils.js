//// Core modules

//// External modules

//// Modules


module.exports = {
    splitName: (name) => { // Format: Amarilla, Nico G., Jr.
        if (!name) return name

        name = name.replace(/\s\s+/g, ' ') // Replace multi space with 1 space
        let names = name.split(',')
        let middle = ''
        let first = names[1]
        if (first) {
            first = first.trim()
            let index = first.search(/([A-Z]\.){1}$/) // If middle initial present
            if (index > -1) {
                middle = first.slice(index)
                first = first.slice(0, index)
                first = first.trim()
            }
        }
        let last = names[0]
        if (last) {
            last = last.trim()
        }
        return {
            first: first,
            middle: middle,
            last: last,
        }
    },
    normalizePositions: (position) => {
        position = position.replace(/\s\s+/g, ' ') // Replace multi space with 1 space
        position = position.replace(/(Adm\.? )|(Admin\.? )/g, 'Administrative ')
        position = position.replace('AO', 'Administrative Officer')
        position = position.replace(/(AA)/g, 'Administrative Aide')
        position = position.replace(/(Off\.)/g, 'Officer')
        position = position.replace(/(Asso\.)/g, 'Associate')
        position = position.replace(/(Prof\.? )/g, 'Professor ')
        position = position.replace(/(Asst\.? )/g, 'Assistant ')
        position = position.replace(/(Asst\.?$)/g, 'Assistant') // end of string
        position = position.replace(/(Brd\.)/g, 'Board')
        position = position.replace(/(Sec\.)/g, 'Secretary')
        position = position.replace(/(Engr\.? )/g, 'Engineer ')
        position = position.replace(/(Comp\.)/g, 'Computer')
        position = position.replace(/(Programmer\.)/g, 'Programmer')
        position = position.replace(/(Guid\.)/g, 'Guidance')
        position = position.replace('Part Time', 'Part-Time')
        position = position.replace('SUC PRES', 'SUC President')
        position = position.replace(/(AutoCad)|(Auto CAD)/, 'AutoCAD')
        position = position.replace(/(\/[ \.\,\w]+)/, '') // remove designation (after slash "/")
        return position
    }
}