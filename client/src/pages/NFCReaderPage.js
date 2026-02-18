import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button, Form, Toast, ToastContainer } from 'react-bootstrap';
import './Page.css';

const NFC_SESSION_KEY = 'nfc:lastRead:v1';

function saveNfcSession(state) {
  try {
    sessionStorage.setItem(NFC_SESSION_KEY, JSON.stringify({ savedAt: Date.now(), ...state }));
  } catch { }
}

function loadNfcSession() {
  try {
    const raw = sessionStorage.getItem(NFC_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearNfcSession() {
  try { sessionStorage.removeItem(NFC_SESSION_KEY); } catch { }
}


export default function NFCReaderPage() {
  const [readData, setReadData] = useState('');
  const [originalData, setOriginalData] = useState('');
  // const [convertedData, setConvertedData] = useState('');
  // const [validationData, setValidationData] = useState('');

  const [rawPayload, setRawPayload] = useState('');
  const [cardInfo, setCardInfo] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVariant, setToastVariant] = useState('info');

  // Custom MIME type
  const BINARY_MIME_ENC = 'application/x.ips.gzip.aes256.v1-0';
  const BINARY_MIME_GZIP = 'application/x.ips.gzip.v1-0';

  useEffect(() => {
    const restored = loadNfcSession();
    if (!restored) return;

    // restore only the meaningful bits
    if (typeof restored.readData === 'string') setReadData(restored.readData);
    if (typeof restored.originalData === 'string') setOriginalData(restored.originalData);
    if (typeof restored.rawPayload === 'string') setRawPayload(restored.rawPayload);
    if (typeof restored.cardInfo === 'string') setCardInfo(restored.cardInfo);
  }, []);

  useEffect(() => {
    // Only persist when we actually have something worth restoring
    if (!rawPayload && !readData && !cardInfo) return;

    saveNfcSession({
      readData,
      originalData,
      rawPayload,
      cardInfo,
    });
  }, [readData, originalData, rawPayload, cardInfo]);

  const handleReadFromNfc = async () => {
    if (!('NDEFReader' in window)) {
      setToastMsg('Web NFC is not supported on this device/browser.');
      setToastVariant('warning');
      setShowToast(true);
      return;
    }

    clearNfcSession();
    setIsReading(true);
    setReadData('');
    setOriginalData('');
    // setConvertedData('');
    // setValidationData('');
    setRawPayload('');
    setCardInfo('');
    try {
      const reader = new window.NDEFReader();
      await reader.scan();

      reader.onreadingerror = () => {
        throw new Error('Cannot read data from the NFC tag.');
      };

      reader.onreading = async ({ serialNumber, message }) => {
        setCardInfo(
          `UID: ${serialNumber}\nRecords: ${message.records.length}` +
          (message.records[0]?.mediaType ? `\nMIME: ${message.records[0].mediaType}` : '')
        );

        let extracted = '';

        if (message.records.length > 0) {
          const record = message.records[0];
          // ... existing decoding logic ...
          if (record.recordType === 'mime' && record.mediaType === BINARY_MIME_ENC) {
            const buffer = record.data instanceof ArrayBuffer
              ? record.data
              : record.data.buffer;
            try {
              const resp = await axios.post(
                '/test',
                buffer,
                {
                  headers: { 'Content-Type': 'application/octet-stream' },
                  responseType: 'text'
                }
              );
              let bodyStr = typeof resp.data === 'object'
                ? JSON.stringify(resp.data, null, 2)
                : (() => {
                  try { return JSON.stringify(JSON.parse(resp.data), null, 2); }
                  catch { return resp.data; }
                })();
              extracted = bodyStr;
            } catch (err) {
              extracted = `Error decoding binary: ${err.message}`;
            }
          } else if (record.recordType === 'mime' &&
            (record.mediaType === BINARY_MIME_GZIP || record.mediaType === 'application/gzip')) {
            // Gzip-only: gunzip locally and show the UTF-8 text
            try {
              const buf = record.data instanceof ArrayBuffer
                ? new Uint8Array(record.data)
                : new Uint8Array(record.data?.buffer || record.data);
              // lazy import to avoid bundling if unused
              const { default: pako } = await import('pako');
              const ungz = pako.ungzip(buf);
              const text = new TextDecoder('utf-8').decode(ungz);
              // If it's JSON, pretty-print; otherwise show as-is
              try {
                extracted = JSON.stringify(JSON.parse(text), null, 2);
              } catch {
                extracted = text;
              }
            } catch (err) {
              extracted = `Error gunzipping payload: ${err.message}`;
            }
          } else if (record.recordType === 'text') {
            const decoder = new TextDecoder(record.encoding || 'utf-8');
            extracted = decoder.decode(record.data);
          } else if (record.recordType === 'url') {
            const decoder = new TextDecoder();
            extracted = `URL: ${decoder.decode(record.data)}`;
          } else {
            extracted = Array.from(new Uint8Array(record.data))
              .map(b => b.toString(16).padStart(2, '0')).join(' ');
          }
        }

        setRawPayload(extracted);
        setOriginalData(extracted);
        setReadData(extracted);
        setToastMsg('NFC tag read successfully!');
        setToastVariant('success');
        setShowToast(true);
        setIsReading(false);
      };
    } catch (err) {
      console.error(err);
      setToastMsg(`Failed to read NFC: ${err.message}`);
      setToastVariant('danger');
      setShowToast(true);
      setIsReading(false);
    }
  };

  const handleImport = async () => {
    if (!rawPayload) return;
    setIsImporting(true);
    let endpoint;
    let payloadToSend;

    try {
      if (rawPayload.trim().startsWith('{') && rawPayload.includes('"resourceType"') && rawPayload.includes('Bundle')) {
        endpoint = '/ipsbundle';
        payloadToSend = JSON.parse(rawPayload);
      }
      else if (rawPayload.startsWith('MSH')) {
        endpoint = '/ipsfromhl72x';
        payloadToSend = rawPayload;
      }
      else if (rawPayload.startsWith('H9')) {
        endpoint = '/ipsfrombeer';
        payloadToSend = rawPayload;
      } else {
        throw new Error('Unrecognized IPS format');
      }

      const isJson = endpoint === '/ipsbundle';
      const contentType = isJson ? 'application/json' : 'text/plain';

      const resp = await axios.post(
        endpoint,
        payloadToSend,
        { headers: { 'Content-Type': contentType } }
      );
      setToastMsg(`Import success: ${resp.status} ${resp.statusText}`);
      setToastVariant('success');
    } catch (err) {
      setToastMsg(`Import failed: ${err.message}`);
      setToastVariant('danger');
    } finally {
      setShowToast(true);
      setIsImporting(false);
    }
  };

  const handleConvertOnly = async () => {
    if (!rawPayload) return;
    setIsConverting(true);
    try {
      const resp = await axios.post(
        '/convertips2mongo',
        JSON.parse(rawPayload),
        { headers: { 'Content-Type': 'application/json' } }
      );
      const converted = JSON.stringify(resp.data, null, 2);
      // setConvertedData(converted);
      setReadData(converted);
      setToastMsg('Conversion successful');
      setToastVariant('success');
    } catch (err) {
      setToastMsg(`Conversion failed: ${err.message}`);
      setToastVariant('danger');
    } finally {
      setShowToast(true);
      setIsConverting(false);
    }
  };

  const handleValidate = async () => {
    if (!rawPayload) return;
    setIsValidating(true);
    try {
      const resp = await axios.post(
        '/ipsUniVal',
        JSON.parse(rawPayload),
        { headers: { 'Content-Type': 'application/json' } }
      );
      let formatted;
      if (resp.data.valid) {
        formatted = '✅ Valid!';
      } else {
        formatted = resp.data.errors
          .map(err => `${err.path || '/'}: ${err.message}`)
          .join('\n');
      }
      // setValidationData(formatted);
      setReadData(formatted);
      setToastMsg(resp.data.valid ? 'Validation passed' : 'Validation errors');
      setToastVariant(resp.data.valid ? 'success' : 'warning');
    } catch (err) {
      setToastMsg(`Validation failed: ${err.message}`);
      setToastVariant('danger');
    } finally {
      setShowToast(true);
      setIsValidating(false);
    }
  };

  const showOriginal = () => setReadData(originalData);

  return (
    <div className="app">
      <div className="container">
        <h3>NFC Reader</h3>
        <div className="button-container mb-3">
          <Button variant={isReading ? 'dark' : 'primary'} onClick={handleReadFromNfc} disabled={isReading}>
            {isReading ? 'Waiting...' : 'Read card'}
          </Button>
          <Button variant="success" className="ms-2" onClick={handleImport} disabled={!rawPayload || isImporting}>
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
          <Button variant="secondary" className="ms-2" onClick={handleConvertOnly} disabled={!rawPayload || isConverting}>
            {isConverting ? 'Converting...' : 'NoSQL'}
          </Button>
          <Button variant="info" className="ms-2" onClick={handleValidate} disabled={!rawPayload || isValidating}>
            {isValidating ? 'Validating...' : 'Validate'}
          </Button>
          <Button variant="outline-secondary" className="ms-2" onClick={showOriginal} disabled={!originalData}>
            Original
          </Button>
          <Button
            variant="outline-danger"
            className="ms-3"
            onClick={() => {
              const confirmed = window.confirm(
                "This will permanently clear the current NFC payload from memory.\n\nAre you sure?"
              );
              if (!confirmed) return;

              clearNfcSession();
              setReadData('');
              setOriginalData('');
              setRawPayload('');
              setCardInfo('');
            }}
            disabled={!rawPayload && !readData && !cardInfo}
          >
            Clear
          </Button>

        </div>

        <h5>Card Info</h5>
        <Form.Control as="textarea" rows={3} value={cardInfo} readOnly className="mb-3" />

        <h5>Payload</h5>
        <Form.Control as="textarea" rows={15} value={readData} readOnly className="resultTextArea" />
      </div>

      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        <Toast onClose={() => setShowToast(false)} show={showToast} bg={toastVariant} delay={4000} autohide>
          <Toast.Header>
            <strong className="me-auto">IPS MERN NFC</strong>
          </Toast.Header>
          <Toast.Body className={toastVariant !== 'light' ? 'text-white' : ''}>
            {toastMsg}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}
