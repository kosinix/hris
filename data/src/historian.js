const lodash = require('lodash')

const patchHistory = (patch, source, author) => {
    let histories = []
    let keys = Object.keys(patch)
    for (propName of keys) {
        // console.log(propName)
        let oldVal = lodash.get(source, propName)
        if (typeof oldVal === 'object' && oldVal !== null) {
            oldVal = lodash.invoke(oldVal, 'toString')
        }
        let newVal = patch[propName]
        if (oldVal === newVal) {
            delete patch[propName]
        } else {
            // console.log(propName, typeof oldVal, '===', typeof newVal, oldVal, '===', newVal)
            histories.push(`Changed ${propName} from "${oldVal}" into "${newVal}" by "${author}".`)
        }
    }
    return histories
}

module.exports = {
    patchHistory: patchHistory
}