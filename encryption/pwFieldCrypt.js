// encryption/pwFieldCrypt.js
// Password-protected field-level encryption using only Node 'crypto'.
// AES-256-GCM + PBKDF2-SHA256 key derivation.
// CommonJS-compatible; no external deps.

const crypto = require('crypto');

// --------- helpers ---------
const ALG = 'aes-256-gcm';
const IV_LEN = 12;       // 96-bit nonce for GCM (best practice)
const TAG_LEN = 16;      // 128-bit auth tag
const SALT_LEN = 16;     // per-field salt
const KEY_LEN = 32;      // 256-bit key for AES-256-GCM
const DEFAULT_PBKDF2_ITERS = 150_000;

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function b64urlToBuf(s) {
  // restore padding
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}
function encodeUtf8(s) { return Buffer.from(String(s), 'utf8'); }

// Build the underscore-companion for a FHIR primitive
function underscoreFieldForPW(elementName, extension) {
  if (!elementName) throw new Error('underscoreFieldFor: elementName required');
  return { ['_' + elementName]: { extension: [extension] } };
}

/**
 * Encrypt a primitive value with a password, returning a FHIR Extension.
 *
 * @param {string|number|boolean} value
 * @param {{
 *   url: string,                // FHIR extension URL
 *   password: string,           // user-held password
 *   aadUtf8?: string,           // optional AAD binding (e.g., "Patient/pt1#identifier[0].value")
 *   iter?: number,              // PBKDF2 iterations (default 150k)
 *   saltB64Url?: string         // optional base64url salt (else random)
 * }} opts
 * @returns {{ placeholder:'redacted', extension:{url:string,valueBase64Binary:string}, envelope?:object }}
 */
async function encryptPrimitiveFieldPW(value, opts) {
  const { url, password, aadUtf8, iter = DEFAULT_PBKDF2_ITERS, saltB64Url } = opts || {};
  if (!url) throw new Error('encryptPrimitiveFieldPW: opts.url is required');
  if (!password) throw new Error('encryptPrimitiveFieldPW: opts.password is required');

  const salt = saltB64Url ? b64urlToBuf(saltB64Url) : crypto.randomBytes(SALT_LEN);
  const iv   = crypto.randomBytes(IV_LEN);

  // Derive 256-bit key with PBKDF2-SHA256
  const key = await new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iter, KEY_LEN, 'sha256', (err, dk) => err ? reject(err) : resolve(dk));
  });

  const cipher = crypto.createCipheriv(ALG, key, iv, { authTagLength: TAG_LEN });

  // Bind AAD if provided (must be set before any update/final)
  if (aadUtf8) cipher.setAAD(encodeUtf8(aadUtf8));

  const pt = encodeUtf8(value);
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Compact envelope we’ll base64url-encode and store in valueBase64Binary
  const envelope = {
    // header/params
    v: 1,
    alg: 'PW-A256GCM',             // our simple descriptor
    kdf: 'PBKDF2-SHA256',
    iter,
    salt: b64url(salt),
    iv: b64url(iv),
    tag: b64url(tag),

    // optional aad marker (for debugging/inspection; not required to store)
    // aad: aadUtf8 ? b64url(encodeUtf8(aadUtf8)) : undefined,

    // ciphertext
    ct: b64url(ct),
  };

  const extension = {
    url,
    valueBase64Binary: b64url(encodeUtf8(JSON.stringify(envelope))),
  };

  return { placeholder: 'redacted', extension, envelope };
}

/**
 * Decrypt a FHIR Extension produced by encryptPrimitiveFieldPW.
 *
 * @param {{url:string,valueBase64Binary:string}} extension
 * @param {{ password: string, aadUtf8?: string }} keying
 * @returns {{ plaintext:string }}
 */
async function decryptPrimitiveExtensionPW(extension, keying) {
  if (!extension?.valueBase64Binary) throw new Error('decryptPrimitiveExtensionPW: invalid extension');
  if (!keying?.password) throw new Error('decryptPrimitiveExtensionPW: password required');

  const bytes = b64urlToBuf(extension.valueBase64Binary);
  const envelope = JSON.parse(bytes.toString('utf8'));

  if (envelope.alg !== 'PW-A256GCM') throw new Error(`Unsupported alg: ${envelope.alg || 'none'}`);
  if (envelope.kdf !== 'PBKDF2-SHA256') throw new Error(`Unsupported kdf: ${envelope.kdf || 'none'}`);
  const iter = envelope.iter || DEFAULT_PBKDF2_ITERS;

  const salt = b64urlToBuf(envelope.salt);
  const iv   = b64urlToBuf(envelope.iv);
  const tag  = b64urlToBuf(envelope.tag);
  const ct   = b64urlToBuf(envelope.ct);

  // Derive key
  const key = await new Promise((resolve, reject) => {
    crypto.pbkdf2(keying.password, salt, iter, KEY_LEN, 'sha256', (err, dk) => err ? reject(err) : resolve(dk));
  });

  const decipher = crypto.createDecipheriv(ALG, key, iv, { authTagLength: TAG_LEN });

  if (keying.aadUtf8) decipher.setAAD(encodeUtf8(keying.aadUtf8));
  decipher.setAuthTag(tag);

  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return { plaintext: pt.toString('utf8') };
}

module.exports = {
  encryptPrimitiveFieldPW,
  decryptPrimitiveExtensionPW,
  underscoreFieldForPW,
};
