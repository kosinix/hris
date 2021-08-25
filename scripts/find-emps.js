module.exports = async (db, list = []) => {
    let lastNames = []
    let firstNames = []
    list.forEach((el) => {
        lastNames.push(new RegExp(`^${el[0]}`, "i"))
        firstNames.push(new RegExp(`^${el[1]}`, "i"))
    })

    let promises = []
    list.forEach((el) => {
        promises.push(db.main.Employee.findOne({
            lastName: new RegExp(`^${el[0]}`, "i"),
            firstName: new RegExp(`^${el[1]}`, "i"),
        }).lean())
    })
    let employees = await Promise.all(promises)

    let missing = []
    employees.forEach((el, i) => {
        if (el === null) {
            missing.push(`${list[i][0]} ${list[i][1]}`)
        }
    })
    if (missing.length > 0) {
        throw new Error(`${missing.length} employee(s) not found: ${missing.join(', ')}`)
    }

    return employees
}