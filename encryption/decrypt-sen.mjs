// decrypt-sen.mjs
import fs from 'node:fs/promises';
import { importJWK, flattenedDecrypt } from 'jose';

const bundle = JSON.parse(await fs.readFile('./bundle.json', 'utf8'));
const jwk    = JSON.parse(await fs.readFile('./jwk.json', 'utf8'));

// 1) Find the Patient and the encrypted BSN extension
const patient = bundle.entry?.[0]?.resource;
if (!patient) {
  throw new Error('No Patient resource found in bundle');
}

const bsnIdentifier = patient.identifier?.find(
  id => id.system === 'http://fhir.nl/fhir/NamingSystem/bsn'
);

if (!bsnIdentifier) {
  throw new Error('No BSN identifier found on Patient');
}

const bsnExt = bsnIdentifier.extension?.find(
  e => e.url === 'https://sensorium.app/fhir/StructureDefinition/encrypted-bsn'
);

if (!bsnExt?.valueBase64Binary) {
  throw new Error('Encrypted BSN extension not found or missing valueBase64Binary');
}

// 2) Decode the flattened JSON JWE from normal base64
const jweJson = Buffer.from(bsnExt.valueBase64Binary, 'base64').toString('utf8');
const jwe = JSON.parse(jweJson);

// Optional: quick inspect
console.log('JWE shape keys:', Object.keys(jwe));  // e.g. ["ciphertext","iv","tag","protected","header"]

// 3) Import EC P-521 private key for ECDH-ES
const privKey = await importJWK(jwk, 'ECDH-ES');

// 4) Decrypt FLATTENED JWE
const { plaintext, protectedHeader } = await flattenedDecrypt(jwe, privKey);

// 5) Show result
const decryptedBsn = Buffer.from(plaintext).toString('utf8');
console.log('Decrypted BSN:', decryptedBsn);
console.log('Protected header:', protectedHeader);
