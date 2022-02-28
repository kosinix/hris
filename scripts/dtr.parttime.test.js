/**
 * Usage: node scripts/dtr.parttime.test
 */
//// Core modules
const path = require('path');
const util = require('util');
const assert = require('assert/strict');

//// External modules
const lodash = require('lodash');
const moment = require('moment');
const pigura = require('pigura');

//// Modules
const dtrHelper = require('../data/src/dtr-helper');


//// First things first
//// Save full path of our root app directory and load config and credentials
global.APP_DIR = path.resolve(__dirname + '/../').replace(/\\/g, '/'); // Turn back slash to slash for cross-platform compat
global.ENV = lodash.get(process, 'env.NODE_ENV', 'dev')

const configLoader = new pigura.ConfigLoader({
    configName: './configs/config.json',
    appDir: APP_DIR,
    env: ENV,
    logging: true
})
global.CONFIG = configLoader.getConfig()

const credLoader = new pigura.ConfigLoader({
    configName: './credentials/credentials.json',
    appDir: APP_DIR,
    env: ENV,
    logging: true
})
global.CRED = credLoader.getConfig()

    // const db = require('../data/src/db-install');


    ; (async () => {
        try {
            let ObjectId = (r) => r
            let ISODate = (r) => r
            let schedule = {}
            let attendance = {}
            let dtr = {}
            function Logs(date, morningIn, morningOut, afternoonIn, afternoonOut, extendedIn, extendedOut, hours, minutes, expected, sched) {
                this.date = date || '';
                this.morningIn = morningIn || '';
                this.morningOut = morningOut || '';
                this.afternoonIn = afternoonIn || '';
                this.afternoonOut = afternoonOut || '';
                this.extendedIn = extendedIn || '';
                this.extendedOut = extendedOut || '';
                this.hours = hours || '';
                this.minutes = minutes || '';
                this.expected = expected || '';
                // this.sched = sched || '';
            }

            const createAttendance = (log) => {
                let ObjectId = (r) => r
                let ISODate = (r) => r

                let momentDate = moment(log.date).startOf('day')

                let logs = []
                if (log.morningIn) {
                    let timeParser = moment(log.morningIn, 'h:mmA')
                    logs.push({
                        _id: ObjectId(""),
                        scannerId: ObjectId(""),
                        dateTime: momentDate.clone().hours(timeParser.hours()).minutes(timeParser.minutes()).toDate(),
                        mode: 1,
                        source: {
                            id: ObjectId(""),
                            type: 'scanner',
                            location: {
                                lat: '',
                                lon: ''
                            },
                            photo: ''
                        }
                    })
                }
                if (log.morningOut) {
                    let timeParser = moment(log.morningOut, 'h:mmA')
                    logs.push({
                        _id: ObjectId(""),
                        scannerId: ObjectId(""),
                        dateTime: momentDate.clone().hours(timeParser.hours()).minutes(timeParser.minutes()).toDate(),
                        mode: 0,
                        source: {
                            id: ObjectId(""),
                            type: 'scanner',
                            location: {
                                lat: '',
                                lon: ''
                            },
                            photo: ''
                        }
                    })
                }
                if (log.afternoonIn) {
                    let timeParser = moment(log.afternoonIn, 'h:mmA')
                    logs.push({
                        _id: ObjectId(""),
                        scannerId: ObjectId(""),
                        dateTime: momentDate.clone().hours(timeParser.hours()).minutes(timeParser.minutes()).toDate(),
                        mode: 1,
                        source: {
                            id: ObjectId(""),
                            type: 'scanner',
                            location: {
                                lat: '',
                                lon: ''
                            },
                            photo: ''
                        }
                    })
                }
                if (log.afternoonOut) {
                    let timeParser = moment(log.afternoonOut, 'h:mmA')
                    logs.push({
                        _id: ObjectId(""),
                        scannerId: ObjectId(""),
                        dateTime: momentDate.clone().hours(timeParser.hours()).minutes(timeParser.minutes()).toDate(),
                        mode: 0,
                        source: {
                            id: ObjectId(""),
                            type: 'scanner',
                            location: {
                                lat: '',
                                lon: ''
                            },
                            photo: ''
                        }
                    })
                }
                return {
                    "_id": ObjectId(""),
                    "employeeId": ObjectId(""),
                    "employmentId": ObjectId(""),
                    "logs": logs,
                    "createdAt": momentDate.toDate()
                }
            }

            let logs = []
            // logs.push(new Logs("2022-01-03", '7:30AM', '12:00PM', '12:30PM', '6:00PM', "6:00PM", "8:00PM", "", "", "7:30AM-12:00PM, 12:30PM-6:00PM (1:00PM-2:00PM, 3:30PM-5:00PM)"))
            // logs.push(new Logs("2022-01-04", '7:30AM', '12:00PM', '12:30PM', '1:30PM', "", "", "", "", "7:30AM-12:00PM, 12:30PM-6:00PM (1:00PM-2:00PM, 3:30PM-5:00PM)"))
            // logs.push(new Logs("2022-01-10", '7:30AM', '12:00PM', '12:30PM', '3:00PM', "", "", "", "", "7:30AM-12:00PM, 12:30PM-6:00PM (1:00PM-2:00PM, 3:30PM-5:00PM)"))
            // logs.push(new Logs("2022-01-10", '7:30AM', '12:00PM', '12:30PM', '5:00PM', "", "", "", "", "7:30AM-12:00PM, 12:30PM-6:00PM (1:00PM-2:00PM, 3:30PM-5:00PM)"))
            // logs.push(new Logs("2022-01-10", '7:30AM', '', '', '3:00PM', "", "", "", "", "7:30AM-12:00PM, 12:30PM-6:00PM (1:00PM-2:00PM, 3:30PM-5:00PM)"))
            // logs.push(new Logs("2022-01-10", '7:30AM', '', '', '12:29PM', "", "", "", "", "7:30AM-12:00PM, 12:30PM-6:00PM (1:00PM-2:00PM, 3:30PM-5:00PM)"))

            logs.push(new Logs("2022-01-03", '7:30AM', '12:00PM', '12:30PM', '6:00PM', '', '', '', '', 8.5))
            logs.push(new Logs("2022-01-04", '7:30AM', '12:00PM', '12:30PM', '1:30PM', '', '', '', '', 4.5))
            logs.push(new Logs("2022-01-05", '7:00AM', '11:00AM', '', '', '', '', '', '', 3))
            logs.push(new Logs("2022-01-06", '7:30AM', '12:00PM', '12:30PM', '6:00PM', '', '', '', '', 8.5))
            logs.push(new Logs("2022-01-07", '7:30AM', '12:00PM', '1:00PM', '11:00PM', '', '', '', '', 7.5))

            schedule = dtrHelper.createWorkScheduleTemplate()
            schedule.weekDays.mon.timeSegments = [
                dtrHelper.createTimeSegment('7:30AM', '12:00PM'),
                dtrHelper.createTimeSegment('12:30PM', '6:00PM', 0, {
                    breaks: [
                        // dtrHelper.createTimeSegmentBreaks('1:00PM', '2:00PM'),
                        dtrHelper.createTimeSegmentBreaks('3:30PM', '5:00PM')
                    ]
                }),
            ]
            schedule.weekDays.tue.timeSegments = [
                dtrHelper.createTimeSegment('7:30AM', '12:00PM'),
            ]
            schedule.weekDays.wed.timeSegments = [
                dtrHelper.createTimeSegment('7:30AM', '10:30AM'),
            ]
            schedule.weekDays.thu.timeSegments = [
                dtrHelper.createTimeSegment('7:30AM', '12:00PM'),
                dtrHelper.createTimeSegment('12:30PM', '6:00PM', 0, {
                    breaks: [
                        // dtrHelper.createTimeSegmentBreaks('1:00PM', '2:00PM'),
                        dtrHelper.createTimeSegmentBreaks('3:30PM', '5:00PM')
                    ]
                }),
            ]
            schedule.weekDays.fri.timeSegments = [
                dtrHelper.createTimeSegment('7:30AM', '12:00PM'),
                dtrHelper.createTimeSegment('1:00PM', '4:00PM'),
            ]

            logs = logs.map(log => {
                let isoWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                let attendance = createAttendance(log)
                let momentAttendanceDate = moment(attendance.createdAt)
                let weekDay = isoWeekdays[momentAttendanceDate.isoWeekday() - 1].toLowerCase()
                let timeSegments = lodash.get(schedule, 'weekDays.' + weekDay + '.timeSegments')
                console.log(weekDay, timeSegments)
                // throw 's'
                dtr = dtrHelper.calcDailyAttendance(attendance, CONFIG.workTime.hoursPerDay, CONFIG.workTime.travelPoints, timeSegments)
                // console.log(dtr.totalInHours, `hrs`, `OR`, `${dtr.renderedDays} days ${dtr.renderedHours} hrs ${dtr.renderedMinutes} mins`)

                log.sched = timeSegments.map((t) => {
                    let startTimes = dtrHelper.minutesToMoments(t.start).format('h:mmA')
                    let breaks = t.breaks.map(b => {
                        return dtrHelper.minutesToMoments(b.start).format('h:mmA') + '-' + dtrHelper.minutesToMoments(b.end).format('h:mmA')
                    }).join(', ')
                    let endTimes = dtrHelper.minutesToMoments(t.end).format('h:mmA')

                    startTimes += '-' + endTimes
                    if (breaks) {
                        startTimes += ` (${breaks})`
                    }
                    return startTimes + ' ' 
                }).join(', ')

                log.hours = Math.floor(dtr.totalInHours)
                log.minutes = (dtr.totalInHours - Math.floor(dtr.totalInHours)) * 60
                return log
            })

            console.log('Compute: Time')
            console.table(logs);

        } catch (err) {
            console.log(err)
        } finally {
            // db.main.close()
        }
    })()


