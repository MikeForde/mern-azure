// tak/takConnector.js
const tls = require('tls');
const fs = require('fs');
const path = require('path');

// Adjust these paths as needed.
// const clientKeyPath = path.join(__dirname, '..', 'certs', 'takserver-user-5-key.pem');
// const clientCertPath = path.join(__dirname, '..', 'certs', 'takserver-user-5-cert.pem');
// const caCertPath = path.join(__dirname, '..', 'certs', 'truststore-intermediate.pem');
const clientKeyPath = path.join(__dirname, '..', 'certs', 'wintak01-key.pem');
const clientCertPath = path.join(__dirname, '..', 'certs', 'wintak01-cert.pem');
const caCertPath = path.join(__dirname, '..', 'certs', 'caCert.pem');

function sendCotMessage(cotMessage, callback) {
  let clientKey, clientCert, caCert;

  // Attempt to read the certificate files.
  try {
    clientKey = fs.readFileSync(clientKeyPath);
    clientCert = fs.readFileSync(clientCertPath);
    caCert = fs.readFileSync(caCertPath);
  } catch (err) {
    const errMsg = 'Error reading certificate files: ' + err.message;
    console.error(errMsg);
    return callback(new Error(errMsg));
  }

  const options = {
    // host: 'medvc.medis.org.uk',
    host: '192.168.68.116',
    port: 8089,
    key: clientKey,
    cert: clientCert,
    ca: caCert,
    passphrase: 'atakatak',  // if your key is still encrypted; ideally, using -nodes should remove encryption.
    rejectUnauthorized: false
  };

  const socket = tls.connect(options, () => {
    // If we're not verifying certificates, then proceed even if socket.authorized is false.
    if (socket.authorized || options.rejectUnauthorized === false) {
      console.log('Connected to TAK server.');
      // Write the COT message to the socket.
      socket.write(cotMessage, () => {
        callback(null, 'COT message sent successfully.');
        socket.end();
      });
    } else {
      const errMsg = 'Connection not authorized: ' + socket.authorizationError;
      console.error(errMsg);
      callback(new Error(errMsg));
      socket.end();
    }
  });

  socket.on('error', (err) => {
    console.error('TAK connection error:', err);
    callback(err);
  });
}

module.exports = {
  sendCotMessage
};
