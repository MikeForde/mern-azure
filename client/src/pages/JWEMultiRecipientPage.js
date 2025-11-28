// src/pages/JWEMultiRecipientPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Row, Col, Card, Alert } from 'react-bootstrap';
import {
    GeneralEncrypt,
    generalDecrypt,
    importJWK,
    generateKeyPair,
    exportJWK,
} from 'jose';

const te = new TextEncoder();
const td = new TextDecoder();

function JWEMultiRecipientPage() {
    const [plainBundle, setPlainBundle] = useState('');
    const [encryptedJwe, setEncryptedJwe] = useState('');

    // Public + private JWK arrays as JSON text
    const [publicRecipients, setPublicRecipients] = useState('[]');
    const [privateKeys, setPrivateKeys] = useState('[]');

    // Number of recipients (1–5)
    const [recipientCount, setRecipientCount] = useState(1);

    const [aad, setAad] = useState('Patient/identifier[1]');
    const [encAlg, setEncAlg] = useState('A256GCM');
    const [kwAlg, setKwAlg] = useState('ECDH-ES+A256KW');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');

    const parseJsonArray = (label, text) => {
        try {
            const val = JSON.parse(text);
            if (!Array.isArray(val)) {
                throw new Error(`${label} must be a JSON array`);
            }
            return val;
        } catch (e) {
            throw new Error(`${label} JSON error: ${e.message}`);
        }
    };

    const encryptIdentifiersForRecipients = async (bundleObj, recipientsArr) => {
        const entries = bundleObj.entry || [];

        for (const entry of entries) {
            const res = entry.resource;
            if (!res || !Array.isArray(res.identifier)) continue;

            for (const id of res.identifier) {
                if (!id.value || id.value === 'redacted') continue;

                const pt = te.encode(String(id.value));

                // General JWE with multi-recipient key wrap
                const protectedHeader = {
                    alg: kwAlg,   // e.g. "ECDH-ES+A256KW"
                    enc: encAlg,  // e.g. "A256GCM"
                };

                const je = new GeneralEncrypt(pt).setProtectedHeader(protectedHeader);

                if (aad.trim()) {
                    je.setAdditionalAuthenticatedData(te.encode(aad.trim()));
                }

                for (const r of recipientsArr) {
                    const pubKey = await importJWK(r, kwAlg);
                    je.addRecipient(pubKey);
                }

                const jwe = await je.encrypt();

                // Store as base64(JSON(JWE)) in extension, as before
                const b64 = btoa(JSON.stringify(jwe));

                const url =
                    id.system === 'http://fhir.nl/fhir/NamingSystem/bsn'
                        ? 'https://sensorium.app/fhir/StructureDefinition/encrypted-bsn'
                        : 'https://example.org/fhir/StructureDefinition/encrypted-identifier';

                if (!Array.isArray(id.extension)) id.extension = [];
                id.extension.push({
                    url,
                    valueBase64Binary: b64,
                });

                // redact visible value
                id.value = 'redacted';
            }
        }

        return bundleObj;
    };

    const decryptIdentifiersWithPrivateKeys = async (bundleObj, privArr) => {
        const entries = bundleObj.entry || [];

        for (const entry of entries) {
            const res = entry.resource;
            if (!res || !Array.isArray(res.identifier)) continue;

            for (const id of res.identifier) {
                if (!Array.isArray(id.extension)) continue;

                const newExt = [];

                for (const ext of id.extension) {
                    const b64 = ext.valueBase64Binary;
                    if (!b64) {
                        newExt.push(ext);
                        continue;
                    }

                    let jwe;
                    try {
                        const jweJson = atob(b64);
                        jwe = JSON.parse(jweJson);
                    } catch {
                        // not one of ours – keep it
                        newExt.push(ext);
                        continue;
                    }

                    let decrypted = null;

                    for (const pk of privArr) {
                        try {
                            const key = await importJWK(pk, kwAlg);
                            const { plaintext } = await generalDecrypt(jwe, key);
                            decrypted = td.decode(plaintext);
                            break;
                        } catch {
                            // try next private key
                            continue;
                        }
                    }

                    if (decrypted != null) {
                        // restore plaintext and drop this encrypted extension
                        id.value = decrypted;
                        // do NOT push ext => removes encrypted blob
                    } else {
                        // no matching key – leave extension untouched
                        newExt.push(ext);
                    }
                }

                id.extension = newExt;
            }
        }

        return bundleObj;
    };

    // Generate N real EC keypairs for demo use and populate both arrays
    const regenerateRecipients = useCallback(
        async (n) => {
            setError('');
            setInfo(`Generating ${n} EC keypair(s) for recipients...`);

            const pubArr = [];
            const privArr = [];

            for (let i = 0; i < n; i++) {
                // ✅ Use base ECDH-ES and make keys extractable for exportJWK()
                const { publicKey, privateKey } = await generateKeyPair('ECDH-ES', {
                    crv: 'P-521',
                    extractable: true,
                });

                const pubJwk = await exportJWK(publicKey);
                const privJwk = await exportJWK(privateKey);

                const kid = `rec_${i + 1}`;

                pubJwk.kty = pubJwk.kty || 'EC';
                pubJwk.use = 'enc';
                pubJwk.alg = kwAlg;   // still advertise KW variant for JWE
                pubJwk.kid = kid;

                privJwk.kty = privJwk.kty || 'EC';
                privJwk.use = 'enc';
                privJwk.alg = kwAlg;;
                privJwk.kid = kid;

                pubArr.push(pubJwk);
                privArr.push(privJwk);
            }

            setPublicRecipients(JSON.stringify(pubArr, null, 2));
            setPrivateKeys(JSON.stringify(privArr, null, 2));
            setInfo(`Generated ${n} recipient keypair(s).`);
        },
        [kwAlg]
    );

    // Initial keypair generation (1 recipient)
    useEffect(() => {
        regenerateRecipients(recipientCount).catch((e) => {
            console.error(e);
            setError(e.message || String(e));
        });
    }, [regenerateRecipients, recipientCount]);

        const handleEncrypt = async () => {
        setError('');
        setInfo('');
        try {
            if (!plainBundle.trim()) {
                throw new Error('Plain Bundle JSON is empty');
            }

            const bundleObj = JSON.parse(plainBundle);
            const recipientsArr = parseJsonArray('Public recipients', publicRecipients);

            if (recipientsArr.length === 0) {
                throw new Error('At least one public recipient key is required');
            }

            await encryptIdentifiersForRecipients(bundleObj, recipientsArr);

            const sizePlain = JSON.stringify(JSON.parse(plainBundle)).length;
            const sizeEncrypted = JSON.stringify(bundleObj).length;

            setEncryptedJwe(JSON.stringify(bundleObj, null, 2));
            setInfo(
                `Encrypted identifier values for ${recipientsArr.length} recipient(s). ` +
                `Original bundle size: ${sizePlain} bytes, protected bundle size: ${sizeEncrypted} bytes.`
            );
        } catch (e) {
            console.error(e);
            setError(e.message || String(e));
        }
    };

        const handleDecrypt = async () => {
        setError('');
        setInfo('');
        try {
            if (!encryptedJwe.trim()) {
                throw new Error('Encrypted bundle JSON is empty');
            }

            const bundleObj = JSON.parse(encryptedJwe);
            const privArr = parseJsonArray('Private keys', privateKeys);

            if (privArr.length === 0) {
                throw new Error('At least one private key is required');
            }

            const result = await decryptIdentifiersWithPrivateKeys(bundleObj, privArr);

            const sizePlain = JSON.stringify(result).length;
            setPlainBundle(JSON.stringify(result, null, 2));
            setInfo(
                `Decryption attempt complete. Restored any identifier values for which a matching key was found. ` +
                `Resulting bundle size: ${sizePlain} bytes.`
            );
        } catch (e) {
            console.error(e);
            setError(e.message || String(e));
        }
    };


    const handleRecipientCountChange = async (e) => {
        const n = Number(e.target.value) || 1;
        const clamped = Math.min(5, Math.max(1, n));
        setRecipientCount(clamped);
        await regenerateRecipients(clamped);
    };

    return (
        <div className="app">
            <div className="container">
                <h3>JWE Multi-Recipient Demo</h3>
                <p className="text-muted">
                    Choose 1–5 recipients, auto-generate EC keypairs, encrypt a FHIR Bundle JSON to a General
                    JWE (<code>recipients[]</code>), and decrypt using one of the corresponding private keys.
                </p>

                {error && (
                    <Alert variant="danger" className="mb-3">
                        {error}
                    </Alert>
                )}
                {info && (
                    <Alert variant="info" className="mb-3">
                        {info}
                    </Alert>
                )}

                <Row className="mb-3">
                    <Col md={4}>
                        <Form.Group className="mb-2">
                            <Form.Label>Number of recipients</Form.Label>
                            <Form.Select value={recipientCount} onChange={handleRecipientCountChange}>
                                <option value={1}>1 recipient</option>
                                <option value={2}>2 recipients</option>
                                <option value={3}>3 recipients</option>
                                <option value={4}>4 recipients</option>
                                <option value={5}>5 recipients</option>
                            </Form.Select>
                            <Form.Text className="text-muted">
                                Changing this regenerates demo public/private JWK arrays.
                            </Form.Text>
                        </Form.Group>
                    </Col>
                    <Col md={4}>
                        <Form.Group className="mb-2">
                            <Form.Label>Key Wrap Algorithm (per recipient)</Form.Label>
                            <Form.Select
                                value={kwAlg}
                                onChange={(e) => setKwAlg(e.target.value)}
                            >
                                <option value="ECDH-ES+A256KW">ECDH-ES + A256KW</option>
                                <option value="ECDH-ES+A192KW">ECDH-ES + A192KW</option>
                                <option value="ECDH-ES+A128KW">ECDH-ES + A128KW</option>
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={4}>
                        <Form.Group className="mb-2">
                            <Form.Label>Content Encryption (enc)</Form.Label>
                            <Form.Select
                                value={encAlg}
                                onChange={(e) => setEncAlg(e.target.value)}
                            >
                                <option value="A256GCM">A256GCM</option>
                                <option value="A192GCM">A192GCM</option>
                                <option value="A128GCM">A128GCM</option>
                            </Form.Select>
                        </Form.Group>
                    </Col>
                </Row>

                <Row className="mb-3">
                    <Col md={12}>
                        <Form.Group className="mb-2">
                            <Form.Label>Additional Authenticated Data (AAD)</Form.Label>
                            <Form.Control
                                type="text"
                                value={aad}
                                onChange={(e) => setAad(e.target.value)}
                                placeholder="Optional context string, e.g., Patient/identifier[1]"
                            />
                        </Form.Group>
                    </Col>
                </Row>

                <Row className="mb-3">
                    <Col md={6}>
                        <Card className="mb-3">
                            <Card.Header>Plain Bundle JSON</Card.Header>
                            <Card.Body>
                                <Form.Control
                                    as="textarea"
                                    rows={12}
                                    value={plainBundle}
                                    onChange={(e) => setPlainBundle(e.target.value)}
                                    placeholder='Paste a FHIR Bundle JSON here...'
                                />
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col md={6}>
                        <Card className="mb-3">
                            <Card.Header>Encrypted JWE JSON</Card.Header>
                            <Card.Body>
                                <Form.Control
                                    as="textarea"
                                    rows={12}
                                    value={encryptedJwe}
                                    onChange={(e) => setEncryptedJwe(e.target.value)}
                                    placeholder='General JWE (with "recipients" array) will appear here...'
                                />
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                <Row className="mb-3">
                    <Col md={6}>
                        <Card className="mb-3">
                            <Card.Header>Public Recipient Keys (JWK array)</Card.Header>
                            <Card.Body>
                                <Form.Control
                                    as="textarea"
                                    rows={8}
                                    value={publicRecipients}
                                    onChange={(e) => setPublicRecipients(e.target.value)}
                                />
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col md={6}>
                        <Card className="mb-3">
                            <Card.Header>Private Recipient Keys (JWK array)</Card.Header>
                            <Card.Body>
                                <Form.Control
                                    as="textarea"
                                    rows={8}
                                    value={privateKeys}
                                    onChange={(e) => setPrivateKeys(e.target.value)}
                                />
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                <Row className="mb-4">
                    <Col md={6} className="d-grid gap-2 mb-2">
                        <Button variant="primary" onClick={handleEncrypt}>
                            Encrypt for Recipients
                        </Button>
                    </Col>
                    <Col md={6} className="d-grid gap-2 mb-2">
                        <Button variant="secondary" onClick={handleDecrypt}>
                            Decrypt with Private Keys
                        </Button>
                    </Col>
                </Row>
            </div>
        </div>
    );
}

export default JWEMultiRecipientPage;
