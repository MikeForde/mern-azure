const crypto = require('crypto');

const algorithm = 'aes-256-cbc';

// Fixed key in clearfor testing (32 bytes) but should be stored securely in production
const key = Buffer.from("YOUR_AES_256_KEY_123456789012345", 'utf8');

// Random IV for each encryption (16 bytes) - this is not a secret and can be stored in plaintext
// At the moment this will only change when the server restarts
// But we could change it to be random for each encryption
const iv = crypto.randomBytes(16);

// Fixed HMAC key in clear for testing (32 bytes) but should be stored securely in production
const hmacKey = Buffer.from("01234567890123456789012345678901", 'utf8');

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

function decrypt(encryptedPayload, useBase64 = false) {
    if (!encryptedPayload.encryptedData || !encryptedPayload.iv) {
        throw new Error("Invalid encrypted payload format. Missing required fields.");
    }

    const encryptedBuffer = Buffer.from(encryptedPayload.encryptedData, useBase64 ? 'base64' : 'hex');
    const ivBuffer = Buffer.from(encryptedPayload.iv, useBase64 ? 'base64' : 'hex');

    // Optional MAC verification
    if (encryptedPayload.mac) {
        const macBuffer = Buffer.from(encryptedPayload.mac, useBase64 ? 'base64' : 'hex');

        // Verify HMAC integrity
        const hmac = crypto.createHmac('sha256', hmacKey);
        hmac.update(ivBuffer);
        hmac.update(encryptedBuffer);
        const expectedMac = hmac.digest().slice(0, 16); // Truncate to 16 bytes

        if (!crypto.timingSafeEqual(macBuffer, expectedMac)) {
            throw new Error("HMAC verification failed! Data integrity compromised.");
        }
    } else {
        console.warn("Warning: No MAC provided. Skipping integrity verification.");
    }

    // Proceed with decryption
    const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
    const decryptedBuffer = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final()
    ]);

    return decryptedBuffer; // Return Buffer
}

function encryptBinary(compressedData) {
    // 1) IV
    const ivBuffer = crypto.randomBytes(16);
  
    // 2) Encrypt
    const cipher = crypto.createCipheriv(algorithm, key, ivBuffer);
    const encryptedBuffer = Buffer.concat([
      cipher.update(compressedData),
      cipher.final()
    ]);
  
    // 3) Generate truncated 16-byte MAC
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(ivBuffer);
    hmac.update(encryptedBuffer);
    const macBuffer = hmac.digest().slice(0, 16);
  
    // 4) Final binary payload
    return Buffer.concat([ivBuffer, macBuffer, encryptedBuffer]);
  }


function decryptBinary(rawData) {

    // Extract IV, MAC, and encrypted data
    const ivBuffer = rawData.slice(0, 16);
    const macBuffer = rawData.slice(16, 32);
    const encryptedBuffer = rawData.slice(32);

    // Verify HMAC
    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(ivBuffer);
    hmac.update(encryptedBuffer);
    // Using a truncated 16-byte MAC
    const expectedMac = hmac.digest().slice(0, 16);

    if (!crypto.timingSafeEqual(macBuffer, expectedMac)) {
        throw new Error("HMAC verification failed! Data integrity compromised.");
    }

    // Decrypt using AES-256-CBC
    const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
    let decryptedBuffer = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final()
    ]);

    return decryptedBuffer; // Return the final plaintext as a Buffer
}


module.exports = { encrypt, decrypt, encryptBinary, decryptBinary };