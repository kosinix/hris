    /usr/local/mongodb/bin/mongo

    use admin

    db.createUser(
        {
            user: "uRoot",
            pwd: "{get password from credentials.json}",
            roles: [
                "root"
            ]
        }
    )

    db.createUser(
        {
            user: "uAdmin",
            pwd: "{get password from credentials.json}",
            roles: [
                {
                    role: "userAdminAnyDatabase",
                    db: "admin"
                },
                "readWriteAnyDatabase"
            ]
        }
    )


    use hrmo

    db.createUser(
		{
			user: "uHrmo",
			pwd: "{get password from credentials.json}",
			roles: [ 
		      { 
		        role: "readWrite", 
		        db: "hrmo" 
		      }
		    ]
		}
	)