const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
//const key = crypto.randomBytes(32); // Replace with a fixed key for consistent encryption
const key = Buffer.from("YOUR_AES_256_KEY_123456789012345", 'utf8');
//const iv = crypto.randomBytes(16); // Replace with a fixed iv for testing
// Fixed IV for testing (16 bytes)
const iv = Buffer.from("1234567890123456", 'utf8'); // Replace with your desired fixed IV

/**
 * Encrypts data with AES-256-CBC.
 * @param {string | Buffer} data - The plaintext data to encrypt.
 * @param {boolean} useBase64 - If true, returns encrypted data and IV in Base64 format. Otherwise, returns in Hex.
 * @returns {Object} An object containing the encryptedData and iv.
 */
function encrypt(data, useBase64 = false) {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encryptedBuffer = Buffer.concat([
        cipher.update(data),
        cipher.final()
    ]);

    return {
        encryptedData: useBase64 ? encryptedBuffer.toString('base64') : encryptedBuffer.toString('hex'),
        iv: useBase64 ? iv.toString('base64') : iv.toString('hex')
    };
}

/**
 * Decrypts data encrypted with AES-256-CBC.
 * @param {string} encryptedData - The encrypted data in Hex or Base64 format.
 * @param {string} ivString - The IV in Hex or Base64 format.
 * @param {boolean} useBase64 - If true, expects Base64 input for encryptedData and iv. Otherwise, expects Hex.
 * @returns {Buffer} The decrypted data as a Buffer.
 */
function decrypt(encryptedData, ivString, useBase64 = false) {
    const encryptedBuffer = Buffer.from(encryptedData, useBase64 ? 'base64' : 'hex');
    const ivBuffer = Buffer.from(ivString, useBase64 ? 'base64' : 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
    const decryptedBuffer = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final()
    ]);

    return decryptedBuffer; // Return Buffer
}

module.exports = { encrypt, decrypt };