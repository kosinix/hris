# Human Resource Information System (HR-IS)
HR-IS is a system for GSC HRMO.


## Install

In mongo

    use ridsys
    db.createUser(
        {
            user: "ridsysUser",
            pwd: '{{see credentials.json}}',
            roles: [
                { role: "readWrite", db: "ridsys" }
            ]
        }
    )