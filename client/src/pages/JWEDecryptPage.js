// src/pages/JWEDecryptPage.jsx
import React, { useState } from 'react';
import { Button, Form, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { importJWK, flattenedDecrypt, generalDecrypt } from 'jose';
import './Page.css';

const textDecoder = new TextDecoder();

/**
 * Try to decrypt all identifier extensions with valueBase64Binary JWE.
 * - Works with flattened JWE (no recipients)
 * - Also supports general JWE (with recipients[])
 */
async function decryptBundleWithJWE(bundle, jwkObj) {
  // Import the EC private key; let jose infer or use jwkObj.alg
  const algHint = jwkObj.alg || 'ECDH-ES';
  const privKey = await importJWK(jwkObj, algHint);

  const entries = bundle.entry || [];
  for (const entry of entries) {
    const res = entry.resource;
    if (!res || !Array.isArray(res.identifier)) continue;

    for (const id of res.identifier) {
      if (!Array.isArray(id.extension)) continue;

      for (const ext of id.extension) {
        if (!ext.valueBase64Binary) continue;

        try {
          // Decode base64 → JSON JWE
          const jweJson = atob(ext.valueBase64Binary);
          const jwe = JSON.parse(jweJson);

          let plaintext;
          // If it's a general JWE (recipients[]), use generalDecrypt
          if (Array.isArray(jwe.recipients)) {
            const { plaintext: pt } = await generalDecrypt(jwe, privKey);
            plaintext = pt;
          } else {
            // Otherwise assume flattened JWE
            const { plaintext: pt } = await flattenedDecrypt(jwe, privKey);
            plaintext = pt;
          }

          const decryptedText = textDecoder.decode(plaintext);

          // Put decrypted value into the FHIR element
          id.value = decryptedText;

          // Optionally mark that this came from encrypted field
          id.decryptedFromExtensionUrl = ext.url;

        } catch (e) {
          // Silently skip if it's not a valid/compatible JWE
          // console.warn('Failed to decrypt one extension:', e);
        }
      }
    }
  }

  return bundle;
}

export default function JWEDecryptPage() {
  const [bundleText, setBundleText] = useState('');
  const [jwkText, setJwkText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);

  const handleDecrypt = async () => {
    setErrorMsg('');
    setOutputText('');
    setIsDecrypting(true);

    try {
      if (!bundleText.trim()) {
        throw new Error('Please paste a FHIR Bundle JSON.');
      }
      if (!jwkText.trim()) {
        throw new Error('Please paste a JWK (private key) JSON.');
      }

      const bundle = JSON.parse(bundleText);
      const jwk = JSON.parse(jwkText);

      const decryptedBundle = await decryptBundleWithJWE(bundle, jwk);

      setOutputText(JSON.stringify(decryptedBundle, null, 2));
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || String(err));
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h3>JWE Field-Level Decrypt Demo</h3>
        <p className="noteFont">
          Paste a FHIR Bundle (with encrypted field-level extensions) and a matching private JWK.
          On decrypt, the page will update identifier values in-place and show the full bundle.
        </p>

        {errorMsg && (
          <Alert variant="danger" className="mb-3">
            {errorMsg}
          </Alert>
        )}

        <Row className="mb-3">
          <Col md={7}>
            <h5>Bundle JSON</h5>
            <Form.Control
              as="textarea"
              rows={14}
              value={bundleText}
              onChange={(e) => setBundleText(e.target.value)}
              placeholder='Paste bundle.json here'
            />
          </Col>
          <Col md={5}>
            <h5>JWK (Private Key)</h5>
            <Form.Control
              as="textarea"
              rows={14}
              value={jwkText}
              onChange={(e) => setJwkText(e.target.value)}
              placeholder='Paste jwk.json here'
            />
          </Col>
        </Row>

        <div className="mb-3">
          <Button
            variant="primary"
            onClick={handleDecrypt}
            disabled={isDecrypting}
          >
            {isDecrypting ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  className="me-2"
                />
                Decrypting…
              </>
            ) : (
              'Decrypt & Show Bundle'
            )}
          </Button>
        </div>

        <h5>Decrypted Bundle (full JSON)</h5>
        <Form.Control
          as="textarea"
          rows={16}
          value={outputText}
          readOnly
          placeholder="Decrypted bundle will appear here"
        />
      </div>
    </div>
  );
}
