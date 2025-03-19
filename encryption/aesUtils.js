const crypto = require('crypto');

const algorithm = 'aes-256-cbc';

//const key = crypto.randomBytes(32);
// Fixed key for testing (32 bytes)
const key = Buffer.from("YOUR_AES_256_KEY_123456789012345", 'utf8');

const iv = crypto.randomBytes(16); // Replace with a fixed iv for testing

const hmacKey = crypto.randomBytes(32);


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

    // Generate HMAC over (IV + Ciphertext)
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(iv);
    hmac.update(encryptedBuffer);
    const mac = hmac.digest().slice(0, 16); // Truncate to 16 bytes

    return {
        encryptedData: useBase64 ? encryptedBuffer.toString('base64') : encryptedBuffer.toString('hex'),
        iv: useBase64 ? iv.toString('base64') : iv.toString('hex'),
        mac: useBase64 ? mac.toString('base64') : mac.toString('hex'),
        key: useBase64 ? key.toString('base64') : key.toString('hex'),
    };
}

/**
 * Decrypts data encrypted with AES-256-CBC.
 * @param {string} encryptedData - The encrypted data in Hex or Base64 format.
 * @param {string} ivString - The IV in Hex or Base64 format.
 * @param {boolean} useBase64 - If true, expects Base64 input for encryptedData and iv. Otherwise, expects Hex.
 * @returns {Buffer} The decrypted data as a Buffer.
 */
function decrypt(encryptedPayload, useBase64 = false) {
    if (!encryptedPayload.encryptedData || !encryptedPayload.iv || !encryptedPayload.mac) {
        throw new Error("Invalid encrypted payload format. Missing required fields.");
    }

    const encryptedBuffer = Buffer.from(encryptedPayload.encryptedData, useBase64 ? 'base64' : 'hex');
    const ivBuffer = Buffer.from(encryptedPayload.iv, useBase64 ? 'base64' : 'hex');
    const macBuffer = Buffer.from(encryptedPayload.mac, useBase64 ? 'base64' : 'hex');

    // Verify HMAC integrity
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(ivBuffer);
    hmac.update(encryptedBuffer);
    const expectedMac = hmac.digest().slice(0, 16); // Truncate to 16 bytes

    if (!crypto.timingSafeEqual(macBuffer, expectedMac)) {
        throw new Error("HMAC verification failed! Data integrity compromised.");
    }

    // Proceed with decryption only if MAC is valid
    const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
    const decryptedBuffer = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final()
    ]);

    return decryptedBuffer; // Return Buffer
}


module.exports = { encrypt, decrypt };