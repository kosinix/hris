/**
 * Flag raising adjustment
 */

//// Core modules

//// External modules
const moment = require('moment')

//// Modules





/**
 * Get list of employees qualified for a schedule adjustment
 * @param {*} db DB instance
 * @param {*} date Date of flag-raising
 * @param {*} schedule1 The schedule to adjust from
 * @param {*} schedule2 The schedule to adjust to
 * @param {boolean} rollback True to rollback
 * @returns 
 */
const getCandidates = async (db, date, schedule1, schedule2, rollback = false) => {
    try {
        let mCalendar = moment(date)

        // 1. Get flag attendances
        let flagAttendances = await db.main.AttendanceFlag.aggregate([
            {
                $match: {
                    // Get flag attendances for these dates
                    dateTime: {
                        $gte: mCalendar.clone().startOf('day').toDate(),
                        $lte: mCalendar.clone().endOf('day').toDate(),
                    }
                }
            },
            {
                $lookup: {
                    localField: 'employeeId',
                    foreignField: '_id',
                    from: 'employees',
                    as: 'employees'
                }
            },
            {
                $addFields: {
                    "employee": {
                        $arrayElemAt: ["$employees", 0]
                    }
                }
            },
            {
                $project: {
                    employees: 0,
                    employee: {
                        addresses: 0,
                        personal: 0,
                        employments: 0,
                        mobileNumber: 0,
                        phoneNumber: 0,
                        documents: 0,
                        createdAt: 0,
                        updatedAt: 0,
                        uuid: 0,
                        uid: 0,
                        group: 0,
                        __v: 0,
                        profilePhoto: 0,
                        acceptedDataPrivacy: 0,
                        birthDate: 0,
                        civilStatus: 0,
                        addressPermanent: 0,
                        addressPresent: 0,
                        email: 0,
                        history: 0,
                        speechSynthesisName: 0,
                        address: 0
                    }
                }
            },
        ])
        if (flagAttendances.length <= 0) {
            return []
        }

        const FLAG_EMPLOYEE_IDS = flagAttendances.map(a => a.employeeId)

        // 2. Get staff employments that are active, using the Regular Working Hours, and matched with employees having flag attendances
        let employments = await db.main.Employment.aggregate([
            {
                $match: {
                    active: true,
                    group: 'staff',
                    employmentType:  {
                        $in: ['cos', 'permanent']
                    },
                    workScheduleId: schedule1._id, // Regular Working Hours
                    employeeId: {
                        $in: FLAG_EMPLOYEE_IDS
                    }
                },
            },
        ])
        const EMPLOYMENT_IDS = employments.map(e => e._id)

        let workScheduleMatcher = {
            $ne: schedule2._id,
        }
        if (rollback) {
            workScheduleMatcher = {
                $ne: schedule1._id,
            }
        }

        // 3. Get employee attendances (not flag attendance) on the given date
        let attendances = await db.main.Attendance.aggregate([
            {
                $match: {
                    workScheduleId: workScheduleMatcher,
                    // Get attendances for these dates
                    createdAt: {
                        $gte: mCalendar.clone().startOf('day').toDate(),
                        $lte: mCalendar.clone().endOf('day').toDate(),
                    },
                    // Must not be later than 7:30 AM to avoid undertime
                    'logs.0.dateTime': {
                        $lte: mCalendar.clone().hours(7).minutes(30).toDate(),
                    },
                    employmentId: {
                        $in: EMPLOYMENT_IDS
                    }
                },
            },

        ])

        flagAttendances = flagAttendances.filter((e, i) => {
            return employments.find(o => o.employeeId.toString() === e.employeeId.toString())
        })

        flagAttendances = flagAttendances.filter((e, i) => {
            return attendances.find(o => o.employeeId.toString() === e.employeeId.toString())
        })

        flagAttendances = flagAttendances.map((e, i) => {
            e.employment = employments.find(o => o.employeeId.toString() === e.employeeId.toString())
            let attendance = attendances.find(o => o.employeeId.toString() === e.employeeId.toString())
            e.attendanceId = attendance?._id
            e.log0 = attendance?.logs?.at(0)
            e.log0.time = moment(e.log0.dateTime).format('hh:mm A')
            e.time = moment(e.dateTime).format('hh:mm A')
            return e
        })

        return flagAttendances
    } catch (err) {
        console.error(err)
    }
}

/**
 * Adjust schedule1 to schedule2 for qualified employees
 * 
 * @param {*} db DB instance
 * @param {String} username 
 * @param {Array} attendanceIds 
 * @param {*} schedule1 The schedule to adjust from
 * @param {*} schedule2 The schedule to adjust to
 * @param {boolean} rollback True to rollback
 * @returns 
 */
const adjustCandidates = async (db, username, attendanceIds, schedule1, schedule2, rollback = false) => {
    try {
        const user = await db.main.User.findOne({
            username: username
        })
        const ATTENDANCE_IDS = attendanceIds.map(a => db.mongoose.Types.ObjectId(a))

        if (rollback) {
            let criteria = {
                _id: {
                    $in: ATTENDANCE_IDS
                },
                workScheduleId: {
                    $ne: schedule1._id,
                }
            }
            let affected = await db.main.Attendance.find(criteria, { logs: 0 }).lean()
            let message = `${user?.username} rollback schedule from ${schedule2.name} to ${schedule1.name}.`
            let updated = await db.main.Attendance.updateMany(
                criteria,
                {
                    $set: {
                        workScheduleId: schedule1._id,
                    },
                    $push: {
                        changes: {
                            summary: message,
                            objectId: user?._id,
                            createdAt: moment().toDate()
                        }
                    },
                },
                {
                    multi: true
                }
            )
            // console.log({
            //     affected: affected,
            //     updated: updated,
            // })
            if (updated.n > 0) {
                return `${message} Updated ${updated.n}.`
            }
            return `No changes made.` // TODO: Do not change text as its used by mailer to send email
        }

        // 5. Update attendances with EMPLOYMENT_IDS to schedule2
        let criteria = {
            _id: {
                $in: ATTENDANCE_IDS
            },
            workScheduleId: {
                $ne: schedule2._id,
            }
        }
        let affected = await db.main.Attendance.find(criteria, { logs: 0 }).lean()
        let message = `${user?.username} adjusted schedule from ${schedule1.name} to ${schedule2.name} because of the flag raising attendance.`
        let updated = await db.main.Attendance.updateMany(
            criteria,
            {
                $set: {
                    workScheduleId: schedule2._id
                },
                $push: {
                    changes: {
                        summary: message,
                        objectId: user?._id,
                        createdAt: moment().toDate()
                    }
                },
            },
            {
                multi: true
            }
        )
        // console.log({
        //     affected: affected,
        //     updated: updated,
        // })
        if (updated.n > 0) {
            return `${message} Updated ${updated.n}.`
        }
        return `No changes made.` // TODO: Do not change text as its used by mailer to send email
    } catch (err) {
        console.error(err)
    }
}

module.exports = {
    getCandidates: getCandidates,
    adjustCandidates: adjustCandidates,
}