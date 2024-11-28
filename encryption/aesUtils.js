const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
//const key = crypto.randomBytes(32); // Replace with a fixed key for consistent encryption
const key = Buffer.from("YOUR_AES_256_KEY_123456789012345", 'utf8');
//const iv = crypto.randomBytes(16); // Replace with a fixed iv for testing
// Fixed IV for testing (16 bytes)
const iv = Buffer.from("1234567890123456", 'utf8'); // Replace with your desired fixed IV

function encrypt(data) {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encryptedBuffer = Buffer.concat([
        cipher.update(data),
        cipher.final()
    ]);
    return {
        encryptedData: encryptedBuffer.toString('hex'),
        iv: iv.toString('hex')
    };
}

function decrypt(encryptedData, ivHex) {
    const encryptedBuffer = Buffer.from(encryptedData, 'hex');
    const ivBuffer = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
    const decryptedBuffer = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final()
    ]);
    return decryptedBuffer; // Return Buffer
}


module.exports = { encrypt, decrypt };
