// Single recipient and multi-recipient JWE encrypt/decrypt lab page
import React, { useState } from 'react';
import { Button, Form, Row, Col, Alert, Spinner } from 'react-bootstrap';
import {
    importJWK,
    flattenedDecrypt,
    generalDecrypt,
    FlattenedEncrypt,
    generateKeyPair,
    exportJWK,
} from 'jose';
import './Page.css';

const te = new TextEncoder();
const td = new TextDecoder();
const ALG_OPTIONS = [
    'ECDH-ES',
    'ECDH-ES+A128KW',
    'ECDH-ES+A192KW',
    'ECDH-ES+A256KW',
];
const ENC_OPTIONS = ['A128GCM', 'A192GCM', 'A256GCM'];

/**
 * Decrypt all identifier extensions with valueBase64Binary JWE.
 * - Handles both flattened JWE (no recipients) and general JWE (recipients[])
 */
async function decryptBundleWithJWE(bundle, jwkObj) {
    const algHint = jwkObj.alg || 'ECDH-ES';
    const privKey = await importJWK(jwkObj, algHint);

    const entries = bundle.entry || [];
    for (const entry of entries) {
        const res = entry.resource;
        if (!res || !Array.isArray(res.identifier)) continue;

        for (const id of res.identifier) {
            if (!Array.isArray(id.extension)) continue;

            for (const id of res.identifier) {
                if (!Array.isArray(id.extension)) continue;

                // Walk backwards so can safely splice extensions as we decrypt them
                for (let i = id.extension.length - 1; i >= 0; i--) {
                    const ext = id.extension[i];
                    if (!ext.valueBase64Binary) continue;

                    try {
                        // Decode base64 -> JSON JWE
                        const jweJson = atob(ext.valueBase64Binary);
                        const jwe = JSON.parse(jweJson);

                        let plaintext;
                        if (Array.isArray(jwe.recipients)) {
                            const { plaintext: pt } = await generalDecrypt(jwe, privKey);
                            plaintext = pt;
                        } else {
                            const { plaintext: pt } = await flattenedDecrypt(jwe, privKey);
                            plaintext = pt;
                        }

                        const decryptedText = td.decode(plaintext);
                        id.value = decryptedText;
                        id.decryptedFromExtensionUrl = ext.url;

                        // Drop the encrypted extension now that restored the plaintext
                        id.extension.splice(i, 1);
                    } catch {
                        // Not a JWE --> can decrypt -> ignore and leave extension as-is
                    }
                }

                // If there are no extensions left, clean up the property
                if (id.extension.length === 0) {
                    delete id.extension;
                }
            }
        }
    }

    return bundle;
}

/**
 * Encrypt identifier.value fields into field-level JWE extensions.
 * Use Flattened JWE + EC(ECDH-ES) by default.
 */
async function encryptBundleWithJWE(bundle, jwkObj, alg, enc) {
    const protectedHeader = { alg, enc };

    // Use public part of the key for encryption
    const pubJwk = { ...jwkObj };
    delete pubJwk.d;

    const pubKey = await importJWK(pubJwk, alg);

    const entries = bundle.entry || [];
    for (const entry of entries) {
        const res = entry.resource;
        if (!res || !Array.isArray(res.identifier)) continue;

        for (const id of res.identifier) {
            if (!id.value || id.value === 'redacted') continue;

            const pt = te.encode(String(id.value));
            const fe = new FlattenedEncrypt(pt).setProtectedHeader(protectedHeader);
            const jwe = await fe.encrypt(pubKey);

            const jweJson = JSON.stringify(jwe);
            const b64 = btoa(jweJson);

            const url =
                id.system === 'http://fhir.nl/fhir/NamingSystem/bsn'
                    ? 'https://sensorium.app/fhir/StructureDefinition/encrypted-bsn'
                    : 'https://example.org/fhir/StructureDefinition/encrypted-identifier';

            if (!Array.isArray(id.extension)) id.extension = [];
            id.extension.push({
                url,
                valueBase64Binary: b64,
            });

            id.value = 'redacted';
        }
    }

    return bundle;
}

export default function JWEDecryptPage() {
    const [encryptedBundleText, setEncryptedBundleText] = useState('');
    const [plainBundleText, setPlainBundleText] = useState('');
    const [jwkText, setJwkText] = useState('');
    // const [headerOverridesText, setHeaderOverridesText] = useState(
    //     '{\n  "alg": "ECDH-ES",\n  "enc": "A256GCM"\n}'
    // );

    const [selectedAlg, setSelectedAlg] = useState('ECDH-ES');
    const [selectedEnc, setSelectedEnc] = useState('A256GCM');

    const [errorMsg, setErrorMsg] = useState('');
    const [isBusy, setIsBusy] = useState(false);

    const handleDecryptTopToBottom = async () => {
        setErrorMsg('');
        setIsBusy(true);
        try {
            if (!encryptedBundleText.trim()) throw new Error('Encrypted bundle is empty.');
            if (!jwkText.trim()) throw new Error('JWK is required.');

            const bundle = JSON.parse(encryptedBundleText);
            const jwk = JSON.parse(jwkText);

            const decrypted = await decryptBundleWithJWE(bundle, jwk);
            setPlainBundleText(JSON.stringify(decrypted, null, 2));
        } catch (err) {
            console.error(err);
            setErrorMsg(err.message || String(err));
        } finally {
            setIsBusy(false);
        }
    };

    const handleEncryptBottomToTop = async () => {
        setErrorMsg('');
        setIsBusy(true);
        try {
            if (!plainBundleText.trim()) throw new Error('Plain bundle is empty.');
            if (!jwkText.trim()) throw new Error('JWK is required.');

            const bundle = JSON.parse(plainBundleText);
            const jwk = JSON.parse(jwkText);

            const alg = selectedAlg;
            const enc = selectedEnc;

            const encrypted = await encryptBundleWithJWE(bundle, jwk, alg, enc);
            setEncryptedBundleText(JSON.stringify(encrypted, null, 2));
        } catch (err) {
            console.error(err);
            setErrorMsg(err.message || String(err));
        } finally {
            setIsBusy(false);
        }
    };

    const handleGenerateNewJwk = async () => {
        setErrorMsg('');
        setIsBusy(true);
        try {
            // Base algorithm for key generation (strip KW suffix if present)
            const baseAlg = selectedAlg.startsWith('ECDH-ES') ? 'ECDH-ES' : selectedAlg;

            // Generate an EC keypair (P-521 to match the Dutch example)
            const { privateKey } = await generateKeyPair(baseAlg, {
                crv: 'P-521',
                extractable: true,   // ⬅️ allow exportJWK() to work
            });

            // Export the *private* JWK (we'll derive the public part inside encryptBundleWithJWE)
            const jwk = await exportJWK(privateKey);

            jwk.kty = jwk.kty || 'EC';
            jwk.use = 'enc';
            jwk.alg = selectedAlg;                 // reflect current UI choice
            jwk.kid = `demo-${Date.now()}`;        // simple unique-ish kid

            setJwkText(JSON.stringify(jwk, null, 2));
        } catch (err) {
            console.error(err);
            setErrorMsg(err.message || String(err));
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <div className="app">
            <div className="container">
                <h3>JWE Field-Level Lab (Encrypt & Decrypt)</h3>
                <p className="noteFont">
                    Paste a FHIR bundle and JWK. Use the buttons to decrypt (top → bottom) or encrypt (bottom → top).
                    You can tweak the JWE protected header JSON to experiment with parameters like <code>alg</code> and <code>enc</code>.
                </p>

                {errorMsg && (
                    <Alert variant="danger" className="mb-3">
                        {errorMsg}
                    </Alert>
                )}

                <Row className="mb-3">
                    <Col md={8}>
                        <h5>Encrypted Bundle JSON (output for Encrypt, input for Decrypt)</h5>
                        <Form.Control
                            as="textarea"
                            rows={12}
                            value={encryptedBundleText}
                            onChange={(e) => setEncryptedBundleText(e.target.value)}
                            placeholder="Encrypted bundle (with JWE valueBase64Binary) goes here"
                        />
                    </Col>
                    <Col md={4}>
                        <h5>JWK (Private for Decrypt, Public/Private for Encrypt)</h5>
                        <Form.Control
                            as="textarea"
                            rows={8}
                            value={jwkText}
                            onChange={(e) => setJwkText(e.target.value)}
                            placeholder="Paste EC JWK here (P-521 / ECDH-ES etc.)"
                            className="mb-3"
                        />
                        <Button
                            variant="outline-secondary"
                            size="sm"
                            className="mb-3"
                            onClick={handleGenerateNewJwk}
                            disabled={isBusy}
                        >
                            {isBusy ? 'Working…' : 'Generate new JWK'}
                        </Button>
                        <h6>Protected Header</h6>
                        <div className="mb-2">
                            <Form.Label>alg</Form.Label>
                            <Form.Select
                                value={selectedAlg}
                                onChange={(e) => setSelectedAlg(e.target.value)}
                            >
                                {ALG_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </Form.Select>
                        </div>
                        <div>
                            <Form.Label>enc</Form.Label>
                            <Form.Select
                                value={selectedEnc}
                                onChange={(e) => setSelectedEnc(e.target.value)}
                            >
                                {ENC_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </Form.Select>
                        </div>

                    </Col>
                </Row>

                <div className="mb-3">
                    <Button
                        variant="secondary"
                        className="me-2"
                        onClick={handleDecryptTopToBottom}
                        disabled={isBusy}
                    >
                        {isBusy ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" className="me-2" />
                                Working…
                            </>
                        ) : (
                            'Decrypt (top → bottom)'
                        )}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleEncryptBottomToTop}
                        disabled={isBusy}
                    >
                        {isBusy ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" className="me-2" />
                                Working…
                            </>
                        ) : (
                            'Encrypt (bottom → top)'
                        )}
                    </Button>
                </div>

                <h5>Plain Bundle JSON (output for Decrypt, input for Encrypt)</h5>
                <Form.Control
                    as="textarea"
                    rows={16}
                    value={plainBundleText}
                    onChange={(e) => setPlainBundleText(e.target.value)}
                    placeholder="Plain FHIR bundle goes here"
                />
            </div>
        </div>
    );
}
