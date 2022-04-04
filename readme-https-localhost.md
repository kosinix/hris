# How to create an HTTPS certificate for localhost in Windows 10

This focuses on generating the certificates for loading local virtual hosts hosted on your computer, for development only.


**Do not use self-signed certificates in production !**
For online certificates, use Let's Encrypt instead ([tutorial](https://gist.github.com/cecilemuller/a26737699a7e70a7093d4dc115915de8)).



## Certificate authority (CA)

Generate `RootCA.pem`, `RootCA.key` & `RootCA.crt`:

	MSYS_NO_PATHCONV=1 openssl req -x509 -nodes -new -sha256 -days 3650 -newkey rsa:2048 -keyout RootCA.key -out RootCA.pem -subj "/C=PH/CN=A-Local-Root-CA"
	
	openssl x509 -outform pem -in RootCA.pem -out RootCA.crt

For Windows prepend commands with `MSYS_NO_PATHCONV=1 ` in order to disable PATH conversion. Omit this on others.

Note that `A-Local-Root-CA` is an example, you can customize the name.

## Host File
Find Notepad++ and Run as Administrator.
Edit C:\Windows\System32\drivers\etc\hosts and add these lines:

	127.0.0.1 scanner.localhost
	127.0.0.1 hris.localhost

## Domain name certificate

Let's say you have two domains `scanner.localhost` and `hris.localhost` that are hosted on your local machine
for development (using the `hosts` file to point them to `127.0.0.1`).

First, create a file `domains.ext` that lists all your local domains:

	authorityKeyIdentifier=keyid,issuer
	basicConstraints=CA:FALSE
	keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
	subjectAltName = @alt_names
	[alt_names]
	DNS.1 = localhost
	DNS.2 = scanner.localhost
	DNS.3 = hris.localhost

Generate `localhost.key`, `localhost.csr`, and `localhost.crt`:

	MSYS_NO_PATHCONV=1 openssl req -new -nodes -newkey rsa:2048 -keyout localhost.key -out localhost.csr -subj "/C=PH/ST=Guimaras/L=Buenavista/O=Local-Certificates/CN=localhost.local"
	
	openssl x509 -req -sha256 -days 3650 -in localhost.csr -CA RootCA.pem -CAkey RootCA.key -CAcreateserial -extfile domains.ext -out localhost.crt

Note that the country / state / city / name in the first command  can be customized.

You can now configure your webserver, for example with Apache:

	SSLEngine on
	SSLCertificateFile "C:/example/localhost.crt"
	SSLCertificateKeyFile "C:/example/localhost.key"

Or nodejs:

	See hris-scanner/index.js


## Trust the local CA

At this point, the site would load with a warning about self-signed certificates.
In order to get a green lock, your new local CA has to be added to the trusted Root Certificate Authorities.


### Windows 10: Chrome, IE11 & Edge

Windows 10 recognizes `.crt` files, so you can right-click on `RootCA.crt` > `Install` to open the import dialog.

Make sure to select "Trusted Root Certification Authorities" and confirm.

You should now get a green lock in Chrome, IE11 and Edge.


### Windows 10: Firefox

There are two ways to get the CA trusted in Firefox.

The simplest is to make Firefox use the Windows trusted Root CAs by going to `about:config`,
and setting `security.enterprise_roots.enabled` to `true`.

The other way is to import the certificate by going
to `about:preferences#privacy` > `Certificats` > `Import` > `RootCA.pem` > `Confirm for websites`.
