import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import pako from 'pako';
import axios from 'axios';
import { Button, Toast, ToastContainer } from 'react-bootstrap';

export default function PayloadPage() {
  const [searchParams] = useSearchParams();
  const [decodedData, setDecodedData] = useState('');
  const [error, setError] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVariant, setToastVariant] = useState('info');
  const [isReadable, setIsReadable] = useState(false);


  const toStandardBase64 = (b64) =>
    b64
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(b64.length + (4 - b64.length % 4) % 4, '=');


  useEffect(() => {
    const base64data = searchParams.get('d');
    if (!base64data) {
      setError('No data found in URL.');
      return;
    }

    try {
      const standardBase64 = toStandardBase64(base64data);

      // Decode base64
      const byteArray = Uint8Array.from(atob(standardBase64), c => c.charCodeAt(0));
      // Gunzip
      const unzipped = pako.ungzip(byteArray, { to: 'string' });
      setDecodedData(unzipped);
    } catch (err) {
      console.error('Failed to decompress:', err);
      setError('Failed to decode or decompress payload.' + base64data);
    }
  }, [searchParams]);

  const handleImport = async () => {
    if (!decodedData) return;
    setIsImporting(true);
    let endpoint;
    let payloadToSend;

    try {
      if (decodedData.trim().startsWith('{') && decodedData.includes('"resourceType"') && decodedData.includes('Bundle')) {
        endpoint = '/ipsbundle';
        payloadToSend = JSON.parse(decodedData);
      } else if (decodedData.startsWith('MSH')) {
        endpoint = '/ipsfromhl72x';
        payloadToSend = decodedData;
      } else if (decodedData.startsWith('H9')) {
        endpoint = '/ipsfrombeer';
        payloadToSend = decodedData;
      } else {
        throw new Error('Unrecognized IPS format');
      }

      const isJson = endpoint === '/ipsbundle';
      const contentType = isJson ? 'application/json' : 'text/plain';

      const resp = await axios.post(endpoint, payloadToSend, {
        headers: { 'Content-Type': contentType }
      });

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
    if (!decodedData) return;
    setIsConverting(true);
    let endpoint;
    let payloadToSend;

    try {
      if (decodedData.trim().startsWith('{') && decodedData.includes('"resourceType"') && decodedData.includes('Bundle')) {
        endpoint = '/convertips2mongo';
        payloadToSend = JSON.parse(decodedData);
      } else if (decodedData.startsWith('MSH')) {
        endpoint = '/converthl72xtomongo';
        payloadToSend = decodedData;
      } else if (decodedData.startsWith('H9')) {
        endpoint = '/convertbeer2mongo';
        payloadToSend = decodedData;
      } else {
        throw new Error('Unrecognized IPS format');
      }

      const isJson = endpoint === '/convertips2mongo';
      const contentType = isJson ? 'application/json' : 'text/plain';

      const resp = await axios.post(endpoint, payloadToSend, {
        headers: { 'Content-Type': contentType },
        responseType: 'json'
      });

      const converted = typeof resp.data === 'object'
        ? JSON.stringify(resp.data, null, 2)
        : resp.data;

      setDecodedData(converted);
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

  const handleHumanReadable = async () => {
    if (!decodedData) return;
    setIsReadable(true);

    try {
      if (!(decodedData.trim().startsWith('{') && decodedData.includes('"resourceType"') && decodedData.includes('Bundle'))) {
        throw new Error('Human-readable view only works with IPS JSON format.');
      }

      const payload = JSON.parse(decodedData);

      const resp = await axios.post('/convertips2plaintext', payload, {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'text'
      });

      setDecodedData(resp.data);
      setToastMsg('Converted to human-readable text');
      setToastVariant('success');
    } catch (err) {
      setToastMsg(`Human-readable failed: ${err.message}`);
      setToastVariant('danger');
    } finally {
      setShowToast(true);
      setIsReadable(false);
    }
  };



  return (
    <div className="container mt-4">
      <h4>CIWX Payload Viewer</h4>

      <div className="mb-3">
        <Button
          variant="success"
          className="me-2"
          onClick={handleImport}
          disabled={!decodedData || isImporting}
        >
          {isImporting ? 'Importing...' : 'Import'}
        </Button>
        <Button
          variant="secondary"
          onClick={handleConvertOnly}
          disabled={!decodedData || isConverting}
        >
          {isConverting ? 'Converting...' : 'NoSQL'}
        </Button>

        <Button
          variant="warning"
          onClick={handleHumanReadable}
          disabled={!decodedData || isReadable}
        >
          {isReadable ? 'Converting...' : 'Human Readable'}
        </Button>
      </div>

      {error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {decodedData}
        </pre>
      )}

      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        <Toast
          onClose={() => setShowToast(false)}
          show={showToast}
          bg={toastVariant}
          delay={4000}
          autohide
        >
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
