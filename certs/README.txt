Examples:

OPENSSL_CONF=legacy.cnf openssl pkcs12 -in truststore-EXTAKINTCA.p12 -out truststore-EXTAKINTCA.pem -clcerts -nokeys

OPENSSL_CONF=legacy.cnf openssl pkcs12 -in dha02.p12 -out dha02-key.pem -nocerts -nodes

OPENSSL_CONF=legacy.cnf openssl pkcs12 -in dha02.p12 -out dha02-cert.pem -clcerts -nokeys