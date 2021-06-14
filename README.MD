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


#### Virtual Hosts

Multiple domains in one Nginx server

* hris.codefleet.net - A node process running on `http://localhost:9094`

Create file `sudo nano /etc/nginx/sites-available/hris.codefleet.net`


Then inside `hris.codefleet.net`

    server {
        listen 80;
        listen [::]:80;

        server_name hris.codefleet.net;

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

`sudo ln -s /etc/nginx/sites-available/hris.codefleet.net /etc/nginx/sites-enabled/`

Restart Nginx for changes to take effect

`sudo systemctl restart nginx`