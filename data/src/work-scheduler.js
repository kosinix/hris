//// Core modules

//// External modules
const momentRange = require("moment-range")
const moment = momentRange.extendMoment(require("moment"));

//// Modules


module.exports = {
    getEmploymentWorkSchedule: async (db, employmentId) =>{
        // Get lists where this employment is in
        let lists = await db.main.EmployeeList.find({
            'members': {
                $elemMatch: {
                    employmentId: employmentId
                }
            }
        }).lean()
        let listIds = lists.map(o => o._id)

        // Get work schedules under this employment and in lists
        let workSchedules = await db.main.WorkSchedule.find({
            $or: [
                {
                    visibility: ''
                },
                {
                    visibility: {
                        $exists: false
                    }
                },
                {
                    'members': {
                        $elemMatch: {
                            objectId: employmentId,
                            type: 'employment'
                        }
                    }
                },
                {
                    'members': {
                        $elemMatch: {
                            objectId: {
                                $in: listIds
                            },
                            type: 'list'
                        }
                    }
                }
            ]
        }).lean()

        // Add prop times with user friendly string
        return workSchedules.map((o) => {
            let times = []
            o.timeSegments = o.timeSegments.map((t) => {
                times.push(`${moment().startOf('day').minutes(t.start).format('hh:mm A')} to ${moment().startOf('day').minutes(t.end).format('hh:mm A')}`)
                return t
            })
            o.times = times.join(", \n")
            return o
        })
    }
}