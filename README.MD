# Human Resource Information System (HRIS)

The Human Resource Information System or HRIS is an online information system that has real-time attendance monitoring, automated payroll generation, and a centralized employee database. Its built in compliance with the PRIME-HRM directive of the Civil Service Commission. 

It aims to help the HRMO in consolidating the time records, expedite the payroll computation, and provide a central repository for employee data.

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


#### Virtual Hosts

Multiple domains in one Nginx server

* hris.gsc.edu.ph - A node process running on `http://localhost:9094`

Create file `sudo nano /etc/nginx/sites-available/hris.gsc.edu.ph`


Then inside `hris.gsc.edu.ph`

    server {
        listen 80;
        listen [::]:80;

        server_name hris.gsc.edu.ph;

        root /home/ubuntu/hris/data/public;

        index index.html;

        location / {
            proxy_pass http://localhost:9094;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 600s;
        }
    }

Then enable both sites in Nginx by symlinking the files above into sites-enabled dir:

`sudo ln -s /etc/nginx/sites-available/hris.gsc.edu.ph /etc/nginx/sites-enabled/`

Restart Nginx for changes to take effect

`sudo systemctl restart nginx`