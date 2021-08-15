/**
 * Test.
 * Usage: node scripts/test.test.js
 */
//// Core modules
const path = require('path');
const util = require('util');

//// External modules
const lodash = require('lodash');
const moment = require('moment');
const money = require('money-math');

//// Modules
const dtrHelper = require('../data/src/dtr-helper')
const formulas = require('../data/src/formulas').cos

let ObjectId = (s) => s

// 3 rows: 1 - normal, 2 - subtotal, 3 title row
// Their are formulas for all computed columns divided into COS and Permanent
// row.cells are only for un computed values that are saved in db
// Computed values arent saved and are based on formulas
let payroll = {
    "_id": ObjectId("6113759be7d05c2034a49883"),
    "gracePeriods": [],
    "name": "July 15th IGP",
    "dateStart": "2021-07-01",
    "dateEnd": "2021-07-15",
    "incentives": [
        {
            "name": "5% Premium",
            "type": "percentage",
            "percentage": 5,
            "percentOf": "amountWorked",
            "initialAmount": 0,
            "_id": ObjectId("6113759be7d05c2034a4987e"),
            "uid": "5Premium"
        }
    ],
    "deductions": [
        {
            "uid": "3",
            "name": "3 %",
            "mandatory": true,
            "deductionType": "normal",
            "initialAmount": 0,
            "groupName": "Tax",
            "_id": ObjectId("6113759be7d05c2034a4987f")
        },
        {
            "uid": "10",
            "name": "10 %",
            "mandatory": true,
            "deductionType": "normal",
            "initialAmount": 0,
            "groupName": "Tax",
            "_id": ObjectId("6113759be7d05c2034a49880")
        },
        {
            "uid": "contribution",
            "name": "Contribution",
            "mandatory": true,
            "deductionType": "normal",
            "initialAmount": 0,
            "groupName": "SSS",
            "_id": ObjectId("6113759be7d05c2034a49881")
        },
        {
            "uid": "ec",
            "name": "EC",
            "mandatory": true,
            "deductionType": "normal",
            "initialAmount": 0,
            "groupName": "SSS",
            "_id": ObjectId("6113759be7d05c2034a49882")
        }
    ],
    "rows": [
        {
            "_id": ObjectId("6113759be7d05c2034a49884"),
            "uid": "608081579970",
            "type": 3,
            name: 'Fund: IGP'
        },
        {
            "_id": ObjectId("6113759be7d05c2034a49884"),
            "uid": "608081579970",
            "type": 1,
            cells: [
                {
                    columnUid: 'tax3',
                    value: 0
                },
                {
                    columnUid: 'tax10',
                    value: 0
                },
                {
                    columnUid: 'contributionSss',
                    value: 0
                },
                {
                    columnUid: 'ecSss',
                    value: 10
                },
            ],
            "attendances": [
                {
                    "_id": "6113759be7d05c2034a4973e",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a4973f",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-01T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49740",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-01T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a49741",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-01T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49742",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-01T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-01T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a49743",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a49744",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-02T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49745",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-02T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a49746",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-02T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49747",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-02T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-02T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a49748",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a49749",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-05T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4974a",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-05T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a4974b",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-05T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4974c",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-05T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-05T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a4974d",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a4974e",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-06T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4974f",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-06T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a49750",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-06T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49751",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-06T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-06T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a49752",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a49753",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-07T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49754",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-07T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a49755",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-07T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49756",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-07T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-07T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a49757",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a49758",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-08T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49759",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-08T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a4975a",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-08T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4975b",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-08T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-08T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a4975c",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a4975d",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-09T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4975e",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-09T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a4975f",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-09T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49760",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-09T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-09T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a49761",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a49762",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-12T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49763",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-12T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a49764",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-12T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49765",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-12T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-12T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a49766",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a49767",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-13T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49768",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-13T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a49769",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-13T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4976a",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-13T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-13T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a4976b",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a4976c",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-14T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4976d",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-14T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a4976e",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-14T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4976f",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-14T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-14T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a49770",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a49771",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-15T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49772",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-15T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a49773",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-15T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49774",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-15T07:56:00.000Z",
                            "mode": 0,
                            "minutesWorked": 176,
                            "underMinutes": 64
                        }
                    ],
                    "createdAt": "2021-07-15T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 416,
                        "renderedDays": 0,
                        "renderedHours": 6,
                        "renderedMinutes": 56,
                        "underTimeTotalMinutes": 64,
                        "underDays": 0,
                        "underHours": 1,
                        "underMinutes": 4,
                        "undertime": true
                    }
                }
            ],
            "employment": {
                "_id": "60e33dd1e0a18b34389cfcd2",
                "active": true,
                "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                "position": "Staff",
                "salary": 500,
                "salaryType": "daily",
                "campus": "main",
                "group": "staff",
                "employmentType": "cos",
                "fundSource": "Catering",
                "documents": [],
                "createdAt": "2021-07-05T17:13:53.069Z",
                "updatedAt": "2021-07-05T17:13:53.069Z",
                "__v": 0
            },
            "employee": {
                "_id": "60e33dc49c4e6d2c7c1ccf1a",
                "firstName": "Roland",
                "middleName": "",
                "lastName": "Cañete",
                "suffix": "",
                "mobileNumber": "",
                "emailVerified": false,
                "mobileNumberVerified": false,
                "employments": [],
                "addresses": [],
                "documents": [],
                "createdAt": "2021-07-05T17:13:39.886Z",
                "updatedAt": "2021-07-07T14:49:47.642Z",
                "uuid": "c9ab2d89-b8cd-4d9d-880d-f317462c5ef4",
                "uid": "915406133721",
                "group": "staff",
                "__v": 0,
                "userId": "60e5bf0bc0505134407d70b6"
            },
            "timeRecord": {
                "totalMinutes": 5216,
                "renderedDays": 10,
                "renderedHours": 6,
                "renderedMinutes": 56,
                "underTimeTotalMinutes": 64,
                "underDays": 0,
                "underHours": 1,
                "underMinutes": 4,
                "undertime": true
            },
            "computed": {
                "amountWorked": 5433.33333333333,
                "tardiness": 0,
                "totalIncentives": 271.666666666667,
                "totalDeductions": 0
            }
        },
        {
            "_id": ObjectId("6113759be7d05c2034a49884"),
            "uid": "608081579970",
            "type": 1,
            cells: [
                {
                    columnUid: 'tax3',
                    value: 0
                },
                {
                    columnUid: 'tax10',
                    value: 0
                },
                {
                    columnUid: 'contributionSss',
                    value: 0
                },
                {
                    columnUid: 'ecSss',
                    value: 0
                },
            ],
            "attendances": [
                {
                    "_id": "6113759be7d05c2034a4973e",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a4973f",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-01T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49740",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-01T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a49741",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-01T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49742",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-01T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-01T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a49743",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a49744",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-02T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49745",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-02T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a49746",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-02T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49747",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-02T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-02T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a49748",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a49749",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-05T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4974a",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-05T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a4974b",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-05T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4974c",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-05T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-05T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a4974d",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a4974e",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-06T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4974f",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-06T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a49750",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-06T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49751",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-06T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-06T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a49752",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a49753",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-07T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49754",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-07T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a49755",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-07T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49756",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-07T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-07T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a49757",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a49758",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-08T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49759",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-08T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a4975a",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-08T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4975b",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-08T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-08T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a4975c",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a4975d",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-09T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4975e",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-09T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a4975f",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-09T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49760",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-09T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-09T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a49761",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a49762",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-12T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49763",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-12T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a49764",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-12T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49765",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-12T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-12T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a49766",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a49767",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-13T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49768",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-13T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a49769",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-13T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4976a",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-13T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-13T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a4976b",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a4976c",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-14T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4976d",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-14T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a4976e",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-14T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a4976f",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-14T09:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        }
                    ],
                    "createdAt": "2021-07-14T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 480,
                        "renderedDays": 1,
                        "renderedHours": 0,
                        "renderedMinutes": 0,
                        "underTimeTotalMinutes": 0,
                        "underDays": 0,
                        "underHours": 0,
                        "underMinutes": 0,
                        "undertime": false
                    }
                },
                {
                    "_id": "6113759be7d05c2034a49770",
                    "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                    "employmentId": "60e33dd1e0a18b34389cfcd2",
                    "onTravel": false,
                    "wfh": false,
                    "logs": [
                        {
                            "_id": "6113759be7d05c2034a49771",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-15T00:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49772",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-15T04:00:00.000Z",
                            "mode": 0,
                            "minutesWorked": 240,
                            "underMinutes": 0
                        },
                        {
                            "_id": "6113759be7d05c2034a49773",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-15T05:00:00.000Z",
                            "mode": 1
                        },
                        {
                            "_id": "6113759be7d05c2034a49774",
                            "scannerId": "6105569be76e6f142863cf72",
                            "dateTime": "2021-07-15T07:56:00.000Z",
                            "mode": 0,
                            "minutesWorked": 176,
                            "underMinutes": 64
                        }
                    ],
                    "createdAt": "2021-07-15T00:00:00.000Z",
                    "dtr": {
                        "totalMinutes": 416,
                        "renderedDays": 0,
                        "renderedHours": 6,
                        "renderedMinutes": 56,
                        "underTimeTotalMinutes": 64,
                        "underDays": 0,
                        "underHours": 1,
                        "underMinutes": 4,
                        "undertime": true
                    }
                }
            ],
            "employment": {
                "_id": "60e33dd1e0a18b34389cfcd2",
                "active": true,
                "employeeId": "60e33dc49c4e6d2c7c1ccf1a",
                "position": "Staff",
                "salary": 500,
                "salaryType": "daily",
                "campus": "main",
                "group": "staff",
                "employmentType": "cos",
                "fundSource": "Catering",
                "documents": [],
                "createdAt": "2021-07-05T17:13:53.069Z",
                "updatedAt": "2021-07-05T17:13:53.069Z",
                "__v": 0
            },
            "employee": {
                "_id": "60e33dc49c4e6d2c7c1ccf1a",
                "firstName": "Roland",
                "middleName": "",
                "lastName": "Cañete",
                "suffix": "",
                "mobileNumber": "",
                "emailVerified": false,
                "mobileNumberVerified": false,
                "employments": [],
                "addresses": [],
                "documents": [],
                "createdAt": "2021-07-05T17:13:39.886Z",
                "updatedAt": "2021-07-07T14:49:47.642Z",
                "uuid": "c9ab2d89-b8cd-4d9d-880d-f317462c5ef4",
                "uid": "915406133721",
                "group": "staff",
                "__v": 0,
                "userId": "60e5bf0bc0505134407d70b6"
            },
            "timeRecord": {
                "totalMinutes": 5216,
                "renderedDays": 10,
                "renderedHours": 6,
                "renderedMinutes": 56,
                "underTimeTotalMinutes": 64,
                "underDays": 0,
                "underHours": 1,
                "underMinutes": 4,
                "undertime": true
            },
            "computed": {
                "amountWorked": 5433.33333333333,
                "tardiness": 0,
                "totalIncentives": 271.666666666667,
                "totalDeductions": 0
            }
        },
        {
            "_id": ObjectId("6113759be7d05c2034a49884"),
            "uid": "608081579970",
            "type": 2,
            cells: [
                {
                    columnUid: 'amountWorked',
                },
                {
                    columnUid: '5Premium',
                },
                {
                    columnUid: 'grossPay',
                },
                {
                    columnUid: 'netPay',
                    // range: [0, 3],
                },
            ],
        }
    ],
    columns: [
        {
            uid: 'fundSource',
            title: 'Fund',
        },
        {
            uid: 'name',
            title: 'Name',
        },
        {
            uid: 'position',
            title: 'Position',
        },
        {
            uid: 'basePay',
            title: 'Salary',
        },
        {
            uid: 'attendance',
            title: 'Time worked',
        },
        {
            uid: 'amountWorked',
            title: 'Gross Pay',
        },
        {
            uid: '5Premium',
            title: '5% Premium',
        },
        {
            uid: 'grossPay',
            title: 'Total',
        },
        {
            uid: 'tax3',
            title: '3% Tax',
        },
        {
            uid: 'tax10',
            title: '10% Tax',
        },
        {
            uid: 'totalTax',
            title: 'Total Tax',
        },
        {
            uid: 'contributionSss',
            title: 'Contribution',
        },
        {
            uid: 'ecSss',
            title: 'EC',
        },
        {
            uid: 'totalSss',
            title: 'Total SSS',
        },
        {
            uid: 'totalDeductions',
            title: 'Total Deductions',
        },
        {
            uid: 'netPay',
            title: 'Net Amnt ',
        },
    ],
}

let logs1 = payroll.columns.map((column) => {
    return column.title
})
console.log(logs1.join(' | '))

let getCellValue = (row, column, formulas) => {
    let cell = row.cells.find(c => c.columnUid === column.uid)
    let formula = formulas.find(f => f.uid === column.uid)
    let cellVal = lodash.get(cell, 'value')
    if (cellVal) return cellVal

    return lodash.invoke(formula, 'getValue', row, formulas) || 0
}

payroll.rows.forEach((row) => {
    if (row.type === 1) {
        let logs = payroll.columns.map((column) => {
            return getCellValue(row, column, formulas)
        })
        console.log(logs.join(' | '))

    } else if (row.type === 2) {

        let logs = row.cells.map((cell) => {
            let column = payroll.columns.find(c => c.uid === cell.columnUid)
            if(!column) throw new Error(`Cannot find column "${cell.columnUid}" in a subtotal row.`)
            let start = lodash.get(cell, 'range[0]', 0)
            let length = lodash.get(cell, 'range[1]', payroll.rows.length)
            let values = payroll.rows.slice(start, length).filter(r => r.type === 1).map((row) => {
                return getCellValue(row, column, formulas)
            })
            return values.reduce((accum, current) => {
                return accum + current;
            }, 0)
        })
        console.log(logs.join(' | '))

    } else if (row.type === 3) {
        console.log(row.title)
    }
})



