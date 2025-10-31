// fhirFieldEncrypt.js
// Field-level encryption helpers that reuse your existing AES-256-GCM encrypt/decrypt.
// Assumes your current module is saved as './cryptoAead.js' (adjust the path/name below).

const { encrypt, decrypt } = require('./aesUtils'); // <- rename to your actual file

/**
 * Minimal envelope we embed in FHIR:
 * {
 *   v: 1,                 // schema version
 *   alg: "A256GCM",       // symmetric AEAD used
 *   iv:  "<base64|hex>",  // from your encrypt()
 *   tag: "<base64|hex>",  // 'mac' from your encrypt()
 *   ct:  "<base64|hex>"   // ciphertext from your encrypt()
 * }
 *
 * We then Base64-encode the entire JSON envelope and place it into a FHIR extension as valueBase64Binary.
 * The visible primitive value is replaced by "redacted" to keep schema/required constraints happy.
 */

// ----------------------- ENCRYPT -----------------------

/**
 * Create a FHIR Extension that carries the encrypted value for a primitive element.
 *
 * @param {string|number|boolean} value   - The primitive value to encrypt.
 * @param {object} opts
 * @param {string} opts.url               - The extension URL (profile/SD that documents your encryption).
 * @param {boolean} [opts.useBase64=true] - Tell the underlying encrypt() to emit base64 strings.
 * @returns {{ placeholder: string, extension: { url: string, valueBase64Binary: string } }}
 *
 * Usage:
 *   const enc = encryptPrimitiveField("9434765919", { url: "https://example.org/fhir/StructureDefinition/encrypted-bsn" });
 *   // enc.placeholder === "redacted"
 *   // enc.extension -> add under the _<elementName>.extension array
 */
function encryptPrimitiveField(value, { url, useBase64 = true }) {
  if (!url) throw new Error('encryptPrimitiveField: opts.url is required');

  // Normalize input to string for predictable round-trip
  const plaintext = String(value);

  // Reuse your existing AEAD helper
  const { encryptedData, iv, mac } = encrypt(plaintext, useBase64);

  // Build compact envelope (matches your encrypt() output keys)
  const env = {
    v: 1,
    alg: 'A256GCM',
    iv,
    tag: mac,
    ct: encryptedData,
  };

  // Base64-encode the whole envelope JSON (FHIR valueBase64Binary expects base64 of bytes)
  const envBytes = Buffer.from(JSON.stringify(env), 'utf8');
  const valueBase64Binary = envBytes.toString('base64');

  return {
    placeholder: 'redacted',
    extension: {
      url,
      valueBase64Binary,
    },
  };
}

/**
 * Helper: given a primitive element name, build the companion underscore field object.
 * You can spread-merge this into the resource.
 *
 * @param {string} elementName        - e.g. "value" or "family"
 * @param {{url:string,valueBase64Binary:string}} extension
 * @returns {object} e.g. { _family: { extension: [ {url,...} ] } }
 */
function underscoreFieldFor(elementName, extension) {
  if (!elementName || typeof elementName !== 'string') {
    throw new Error('underscoreFieldFor: elementName must be a non-empty string');
  }
  return {
    ['_' + elementName]: {
      extension: [extension],
    },
  };
}

// ----------------------- DECRYPT -----------------------

/**
 * Decrypt a field-level encrypted FHIR extension back to the plaintext string.
 *
 * @param {{ url: string, valueBase64Binary: string }} extension
 * @param {boolean} [useBase64=true]  - Must match the format used during encrypt() (we used base64).
 * @returns {string} plaintext
 */
function decryptPrimitiveExtension(extension, useBase64 = true) {
  if (!extension || !extension.valueBase64Binary) {
    throw new Error('decryptPrimitiveExtension: invalid extension (no valueBase64Binary)');
  }
  const envJson = Buffer.from(extension.valueBase64Binary, 'base64').toString('utf8');
  const env = JSON.parse(envJson);

  if (!env || env.v !== 1 || env.alg !== 'A256GCM' || !env.iv || !env.tag || !env.ct) {
    throw new Error('decryptPrimitiveExtension: envelope format not recognized');
  }

  const payload = {
    encryptedData: env.ct,
    iv: env.iv,
    mac: env.tag,
  };

  const ptBuf = decrypt(payload, useBase64);
  return ptBuf.toString('utf8');
}

module.exports = {
  encryptPrimitiveField,
  underscoreFieldFor,
  decryptPrimitiveExtension,
};
