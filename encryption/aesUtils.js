const crypto = require('crypto');

// switch to GCM AEAD
const algorithm = 'aes-256-gcm';

// 32-byte key for AES-256-GCM – store securely in prod!
const key = Buffer.from("YOUR_AES_256_KEY_123456789012345", 'utf8');

/**
 * @param {Buffer|string} data        – plaintext
 * @param {boolean}       useBase64   – false → hex, true → base64
 * @returns {{ encryptedData, iv, mac, key }}  – all strings
 */
function encrypt(data, useBase64 = false) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  const pt = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const encryptedBuffer = Buffer.concat([cipher.update(pt), cipher.final()]);
  const macBuffer = cipher.getAuthTag(); // 16-byte GCM tag

  if (useBase64) {
    return {
      encryptedData: encryptedBuffer.toString('base64'),
      iv:            iv.toString('base64'),
      mac:           macBuffer.toString('base64'),
      key:           key.toString('base64'),
    };
  } else {
    return {
      encryptedData: encryptedBuffer.toString('hex'),
      iv:            iv.toString('hex'),
      mac:           macBuffer.toString('hex'),
      key:           key.toString('hex'),
    };
  }
}

/**
 * @param {{ encryptedData, iv, mac }} payload
 * @param {boolean} useBase64  – false → hex, true → base64
 * @returns {Buffer}           – decrypted plaintext
 * @throws on authentication failure
 */
function decrypt(payload, useBase64 = false) {
  if (!payload.encryptedData || !payload.iv || !payload.mac) {
    throw new Error("Invalid encrypted payload format. Missing required fields.");
  }

  const encryptedBuffer = Buffer.from(payload.encryptedData, useBase64 ? 'base64' : 'hex');
  const ivBuffer        = Buffer.from(payload.iv,            useBase64 ? 'base64' : 'hex');
  const macBuffer       = Buffer.from(payload.mac,           useBase64 ? 'base64' : 'hex');

  const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
  decipher.setAuthTag(macBuffer);

  // throws if tag doesn't match
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

/**
 * @param {Buffer} compressedData       – raw data
 * @returns {Buffer}                    – iv ∥ authTag ∥ ciphertext
 */
function encryptBinary(compressedData) {
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  const encryptedBuffer = Buffer.concat([cipher.update(compressedData), cipher.final()]);
  const macBuffer       = cipher.getAuthTag();

  return Buffer.concat([iv, macBuffer, encryptedBuffer]);
}

/**
 * @param {Buffer} rawData              – iv ∥ authTag ∥ ciphertext
 * @returns {Buffer}                    – decrypted plaintext
 * @throws on authentication failure
 */
function decryptBinary(rawData) {
  const ivBuffer        = rawData.slice(0, 16);
  const macBuffer       = rawData.slice(16, 32);
  const encryptedBuffer = rawData.slice(32);

  const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
  decipher.setAuthTag(macBuffer);

  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

module.exports = { encrypt, decrypt, encryptBinary, decryptBinary };
