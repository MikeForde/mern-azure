// encryption/jweFieldCrypt.js
// Ensure globalThis.crypto exists for jose under Node on Azure
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = require('crypto').webcrypto;
}

// ESM-only library; use dynamic import from CommonJS
let jose;
async function getJose() {
  if (!jose) jose = await import('jose');
  return jose;
}

const te = new TextEncoder();

function b64encodeUtf8(jsonObj) {
  return Buffer.from(JSON.stringify(jsonObj), 'utf8').toString('base64');
}
function b64decodeUtf8(b64) {
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

/** Build the underscore-companion for a FHIR primitive */
function underscoreFieldForJWE(elementName, extension) {
  if (!elementName) throw new Error('underscoreFieldFor: elementName required');
  return { ['_' + elementName]: { extension: [extension] } };
}

/**
 * Encrypt a primitive value into a FHIR Extension (valueBase64Binary) carrying a JWE.
 * - Single PBES2 recipient  -> Flattened JWE (alg+enc in protected header)
 * - Otherwise (ECDH / multi) -> General JWE (alg per-recipient)
 */
async function encryptPrimitiveFieldJWE(value, opts) {
  const {
    url,
    recipients,
    enc = 'A256GCM',
    aadUtf8,
  } = opts || {};
  if (!url) throw new Error('encryptPrimitiveFieldJWE: opts.url is required');
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('encryptPrimitiveFieldJWE: opts.recipients must be a non-empty array');
  }

  const pt = Buffer.from(String(value), 'utf8');

  // Single PBES2 path (Flattened)
  const single = recipients.length === 1 ? recipients[0] : null;
  if (single && single.type === 'pbes2') {
    const { FlattenedEncrypt } = await getJose();
    if (!single.password) throw new Error('PBES2 recipient missing password');
    const secret = te.encode(single.password);

    const alg = 'PBES2-HS256+A128KW';
    const protectedHeader = { alg, enc };
    if (typeof single.p2c === 'number' && single.p2c >= 1000) protectedHeader.p2c = single.p2c;
    if (typeof single.p2s === 'string' && single.p2s) protectedHeader.p2s = single.p2s;
    if (single.kid) protectedHeader.kid = single.kid;

    let fe = new FlattenedEncrypt(pt).setProtectedHeader(protectedHeader);
    if (aadUtf8) fe = fe.setAdditionalAuthenticatedData(Buffer.from(aadUtf8, 'utf8'));

    const jwe = await fe.encrypt(secret);
    const extension = { url, valueBase64Binary: b64encodeUtf8(jwe) };
    return { placeholder: 'redacted', extension, jwe };
  }

  // General JWE path (ECDH and/or multi-recipient)
  const { GeneralEncrypt, importJWK } = await getJose();
  const protectedHeader = { enc };
  let ge = new GeneralEncrypt(pt).setProtectedHeader(protectedHeader);
  if (aadUtf8) ge = ge.setAdditionalAuthenticatedData(Buffer.from(aadUtf8, 'utf8'));

  for (const r of recipients) {
    if (r.type === 'ecdh') {
      const alg = 'ECDH-ES+A256KW';
      if (!r.publicJwk) throw new Error('ECDH recipient missing publicJwk');
      const pubKey = await importJWK(r.publicJwk, alg);
      const hdr = { alg };
      if (r.publicJwk.kid) hdr.kid = r.publicJwk.kid;
      ge = ge.addRecipient(pubKey, hdr);
    } else if (r.type === 'pbes2') {
      const alg = 'PBES2-HS256+A128KW';
      if (!r.password) throw new Error('PBES2 recipient missing password');
      const secret = te.encode(r.password);
      const hdr = { alg, p2c: typeof r.p2c === 'number' ? r.p2c : 150000 };
      if (typeof r.p2s === 'string' && r.p2s) hdr.p2s = r.p2s;
      if (r.kid) hdr.kid = r.kid;
      ge = ge.addRecipient(secret, hdr);
    } else {
      throw new Error(`Unknown recipient type: ${r.type}`);
    }
  }

  const jwe = await ge.encrypt();
  const extension = { url, valueBase64Binary: b64encodeUtf8(jwe) };
  return { placeholder: 'redacted', extension, jwe };
}

/**
 * Decrypt a JWE-bearing extension back to plaintext (works for Flattened or General).
 *
 * keyring:
 * {
 *   ecPrivateKeys?: [{ kid?:string, privateJwk: object }],
 *   passwords?: [{ kid?:string, password: string }]
 * }
 */
async function decryptPrimitiveExtensionJWE(extension, keyring) {
  const { generalDecrypt, flattenedDecrypt, importJWK } = await getJose();
  if (!extension?.valueBase64Binary) throw new Error('decryptPrimitiveExtensionJWE: invalid extension');

  const jwe = b64decodeUtf8(extension.valueBase64Binary);

  // Helper: attempt decrypt with a key/secret using either API
  async function tryDecryptWithKey(key) {
    try {
      // General serialization case
      const r1 = await generalDecrypt(jwe, key);
      return r1;
    } catch (_) {
      // Flattened serialization case
      const r2 = await flattenedDecrypt(jwe, key);
      return r2;
    }
  }

  // EC private keys (ECDH-ES+A256KW)
  if (keyring?.ecPrivateKeys?.length) {
    for (const k of keyring.ecPrivateKeys) {
      try {
        const key = await importJWK(k.privateJwk, 'ECDH-ES+A256KW');
        const { plaintext, protectedHeader, additionalAuthenticatedData } = await tryDecryptWithKey(key);
        return {
          plaintext: Buffer.from(plaintext).toString('utf8'),
          aad: additionalAuthenticatedData ? Buffer.from(additionalAuthenticatedData).toString('utf8') : undefined,
          enc: protectedHeader?.enc,
        };
      } catch (_) { /* try next */ }
    }
  }

  // PBES2 passwords
  if (keyring?.passwords?.length) {
    for (const p of keyring.passwords) {
      try {
        const secret = te.encode(p.password);
        const { plaintext, protectedHeader, additionalAuthenticatedData } = await tryDecryptWithKey(secret);
        return {
          plaintext: Buffer.from(plaintext).toString('utf8'),
          aad: additionalAuthenticatedData ? Buffer.from(additionalAuthenticatedData).toString('utf8') : undefined,
          enc: protectedHeader?.enc,
        };
      } catch (_) { /* try next */ }
    }
  }

  throw new Error('No usable key/password found for JWE recipients');
}

module.exports = {
  encryptPrimitiveFieldJWE,
  decryptPrimitiveExtensionJWE,
  underscoreFieldForJWE,
};
