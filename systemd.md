# SystemD Service for HRIS
# location: /etc/systemd/system/
# file: /etc/systemd/system/hris.service
# update systemd: sudo systemctl daemon-reload
# restart: sudo systemctl restart hris
# status: sudo systemctl status hris
# start-on-boot: sudo systemctl enable hris

[Unit]
Description=HRIS
#Requires=After=mysql.service       # Requires the mysql service to run first

[Service]
ExecStart=/usr/bin/node /home/ubuntu/hris/index.js
# Required on some systems
#WorkingDirectory=/opt/nodeserver
# Restart service after 10 seconds if node service crashes
Restart=always
RestartSec=10
# Output to syslog
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=nodejs-hris
#User=<alternate user>
#Group=<alternate group>
Environment=NODE_ENV=live PORT=9094

[Install]
WantedBy=multi-user.target