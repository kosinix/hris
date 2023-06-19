

  

  

# DEV SETUP - Ubuntu
Documentation about setting up the production server. Its worth noting that our local development machine is on a Windows PC while our production servers are Ubuntu Linux.

## Tech Stack Overview

[MEVN](https://en.wikipedia.org/wiki/MEAN_(solution_stack)#Node.js)

* M - MongoDB as our NoSQL database.
* E - Express.js a modular web application framework as our application server.
* V - Vue.js our frontend framework.
* N - Node.js as the application runtime that the MEVN stack runs on.

All the Node.js modules used by our stack can be found in `package.json`

* Nginx - as our reverse proxy server on top of our MEVN stack.
* Lets Encrypt - for our automated SSL certificate renewal.
* Amazon Web Services - LightSail - as our server machine
* Amazon Web Services - S3 - as our simple storage service
* PH.net as our domain name registrar

## ~ Software Setup ~
Install the following softwares in sequence:

### 1. [GIT](https://git-scm.com/) - Our version control software
Git is already installed on Ubuntu by default.

### 2. [Node.js](https://nodejs.org/) - Our main programming platform
We are using version 16.x.x at the time of this writing. 
 
Update Ubuntu: 
    
    sudo apt-get update

Add source: 

    curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -

And finally install node: 

    sudo apt-get install -y nodejs`

Note: `-y` means to answer "yes" to prompts

To confirm if node was installed do: `npm -v && node -v`

### 3. [MongoDB](https://docs.mongodb.com/v4.0/tutorial/install-mongodb-on-ubuntu/) - This is our database server

Import public key

    wget -qO - https://www.mongodb.org/static/pgp/server-4.0.asc | sudo apt-key add -

Create a list file for MongoDB for Ubuntu 18.04

    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.0.list

Reload local package database

    sudo apt-get update

Install the MongoDB packages

    sudo apt-get install -y mongodb-org

Start DB

    sudo systemctl start mongod

Check if service is running

    sudo systemctl status mongod

Finally, autostart mongo when system restarts

    sudo systemctl enable mongod

## ~ Setup Projects ~
### Pulling the Source Codes

Pull the source code from the repo. Open command line and go to your home directory at `/home/ubuntu` by typing 
  
    cd ~

Clone: 
    
    git clone https://github.com/gsu-edu-ph-mis/hris.git

Type your Github username: `{username}` 

Password: `{Your Github Personal Token}`



### Install NPM packages

 1. Go to *hris* directory by typing `cd ~/hris`.
 2. In the Terminal type `npm install`. Note: This may take some time.
  
## ~ Setup Database ~

Allow External DB Access

Security Warning! You must add firewall rules when exposing a DB outside to only allow your own IP address.

`sudo nano /etc/mongod.conf`

Add the **Private IP** address of our LightSail instance to bindId

    net:
        port: 27017
        bindIp: 127.0.0.1,172.31.15.16

NOTE:

Service Can be found in `/etc/systemd/system/multi-user.target.wants/mongod.service`

### Security
Start mongod service with auth

`sudo nano /etc/mongod.conf`

	security:
		authorization: enabled

`sudo systemctl restart mongod`

## Run the App

Type:

`npm run dev`


## Nginx - Install Nginx as Reverse Proxy for Node

Update packages

`sudo apt-get update`

Install server

`sudo apt-get install nginx -y`

Edit config

`sudo nano /etc/nginx/sites-available/hris.gsu.edu.ph`

Inside `hris.gsu.edu.ph`:

    server {
        listen 80;
        listen [::]:80;

        server_name hris.gsu.edu.ph;

        root /home/ubuntu/hris/data/public;
        index index.html;

        location / {
            # Serve static files directly from nginx or else pass to nodejs
            try_files $uri @nodejs;
        }

        location @nodejs {
            proxy_pass http://localhost:9094;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 600s;
        }

        # Allow bigger uploads. This prevents the 413 (Request Entity Too Large)  error when uploads are too big.
        client_max_body_size 100M;
    }


Press `CTRL+X` and `y` to save.

NOTE: change port number to the one your app uses. Here its 9094

You need to restart for changes to take effect

    sudo systemctl restart nginx


#### Some other commands

* `sudo systemctl start nginx`
* `sudo systemctl stop nginx`


Then enable sites in Nginx by symlinking files above into sites-enabled dir:

`sudo ln -s /etc/nginx/sites-available/hris.gsu.edu.ph /etc/nginx/sites-enabled/`

Restart Nginx for changes to take effect

`sudo systemctl restart nginx`

## Startup script

See `hris.service`


## Certbot - Install https

Uses certbot from Lets Encrypt to install an SSL cert

    sudo apt-get update
    sudo apt-get install software-properties-common
    sudo add-apt-repository ppa:certbot/certbot
    sudo apt-get update
    sudo apt-get install python-certbot-nginx
    sudo certbot --nginx

If you're feeling more conservative and would like to make the changes to your Nginx configuration by hand, you can use the certonly subcommand:

    sudo certbot --nginx certonly

Test renewal 

    sudo certbot renew --dry-run
    
    
    
## Install Apache 
Install apache2 side-by-side with nginx:

`sudo apt-get update`

`sudo apt-get install apache2`

Change its default port:

`sudo nano /etc/apache2/ports.conf`

Change:

    # If you just change the port or add more ports here, you will likely also
    # have to change the VirtualHost statement in
    # /etc/apache2/sites-enabled/000-default.conf

    Listen 80

To:

    # If you just change the port or add more ports here, you will likely also
    # have to change the VirtualHost statement in
    # /etc/apache2/sites-enabled/000-default.conf

    Listen 8080

And

`sudo nano /etc/apache2/sites-available/000-default.conf`

    <VirtualHost *:80>

To:
    <VirtualHost *:8080>

Restart apache2

`sudo systemctl restart apache2`

Other commands:

* `sudo systemctl start apache2`
* `sudo systemctl stop apache2`
* `sudo systemctl status apache2`


## Cron for Backup

`crontab -e`

Code inside:

`0 8 * * *  sh /home/ubuntu/hris/dbdump.sh >/dev/null 2>&1`

See `dbdump.sh` for the backup script.

Commands:

* crontab -e    Edit crontab file, or create one if it doesn’t already exist.
* crontab -l    crontab list of cronjobs , display crontab file contents.
* crontab -r    Remove your crontab file.
* crontab -v    Display the last time you edited your crontab file. (This option is 

### Logs
journalctl -u hris --since "1 hour ago" --no-pager

### More info:
[https://www.digitalocean.com/community/tutorials/how-to-install-wordpress-with-lamp-on-ubuntu-16-04](https://www.digitalocean.com/community/tutorials/how-to-install-wordpress-with-lamp-on-ubuntu-16-04)

[https://www.digitalocean.com/community/tutorials/how-to-install-linux-apache-mysql-php-lamp-stack-on-ubuntu-16-04](https://www.digitalocean.com/community/tutorials/how-to-install-linux-apache-mysql-php-lamp-stack-on-ubuntu-16-04)


## Good luck have fun!

* prep by Nico Amarilla, April 2022