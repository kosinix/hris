//// Core modules

//// External modules

//// Modules


module.exports = {
    /**
     * 
     * @param {string} name 
     * @param {boolean} firstWord Get only first word from first name
     * @returns {object}
     */
    splitName: (name, firstWord = false) => { // Format: Amarilla, Nico G., Jr.
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
            if (firstWord) {
                index = first.search(' ') // If space present
                if (index > -1) {
                    first = first.slice(0, index) // Get only first word of first name 
                    first = first.trim()
                }
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
    },
    /**
     * Filter object
     * Source: https://stackoverflow.com/questions/38750705/filter-object-properties-by-key-in-es6
     * @param {*} raw 
     * @param {*} allowed 
     * @returns 
     */
     filter: (raw, allowed = []) => {
        let keys = Object.keys(raw)
        if (allowed.length > 0) {
            keys = keys.filter(key => allowed.includes(key))
        }
        return keys.reduce((obj, key) => {
            return {
                ...obj,
                [key]: raw[key]
            };
        }, {});
    },
    safeMerge: (target, source, allowed = []) => {
        let srcKeys = Object.keys(source)
        if (allowed.length > 0) {
            srcKeys = srcKeys.filter(key => allowed.includes(key))
        }
        let filtered = srcKeys.reduce((obj, key) => {
            return {
                ...obj,
                [key]: source[key]
            };
        }, {});

        return Object.assign(target, filtered)
    }
}