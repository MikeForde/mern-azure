import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import pako from 'pako';
import axios from 'axios';
import { Button, Toast, ToastContainer, Alert, Card, Spinner } from 'react-bootstrap';

export default function PayloadPage() {
  const [searchParams] = useSearchParams();
  const [payload, setPayload] = useState('');        // raw decoded payload or human-readable
  const [jsonData, setJsonData] = useState(null);    // parsed JSON bundle
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState(null);   // import/convert/export status
  const [toast, setToast] = useState({ show: false, msg: '', variant: 'info' });

  // Utility to normalize base64
  const toStandardBase64 = (b64) =>
    b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(b64.length + (4 - b64.length % 4) % 4, '=');

  useEffect(() => {
    async function decodeAndConvert() {
      try {
        const b64 = searchParams.get('d');
        if (!b64) throw new Error('No data found in URL.');
        // decode & unzip
        const std = toStandardBase64(b64);
        const bytes = Uint8Array.from(atob(std), c => c.charCodeAt(0));
        const text = pako.ungzip(bytes, { to: 'string' });

        // try parse JSON for IPS bundle
        let parsed = null;
        if (text.trim().startsWith('{') && text.includes('"resourceType"') && text.includes('Bundle')) {
          parsed = JSON.parse(text);
          setJsonData(parsed);
          // fetch human-readable
          const resp = await axios.post(
            '/convertips2plaintext', parsed,
            { headers: { 'Content-Type': 'application/json' }, responseType: 'text' }
          );
          setPayload(resp.data);
        } else {
          // non-JSON fallback
          setPayload(text);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    decodeAndConvert();
  }, [searchParams]);

  const showToast = (msg, variant='info') => setToast({ show: true, msg, variant });

  const handleImport = async () => {
    if (!payload) return;
    setOperation('import');
    try {
      let endpoint, body, json;
      if (jsonData) { endpoint = '/ipsbundle'; body = jsonData; json = true; }
      else if (payload.startsWith('MSH')) { endpoint = '/ipsfromhl72x'; body = payload; json = false; }
      else if (payload.startsWith('H9')) { endpoint = '/ipsfrombeer'; body = payload; json = false; }
      else throw new Error('Unrecognized format');
      await axios.post(endpoint, body, { headers: { 'Content-Type': json? 'application/json' : 'text/plain' } });
      showToast('Import successful', 'success');
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'danger');
    } finally {
      setOperation(null);
    }
  };

  const handleConvert = async (type) => {
    if (!payload) return;
    setOperation(type);
    try {
      let endpoint;
      if (type === 'NoSQL') {
        if (jsonData) endpoint = '/convertips2mongo';
        else if (payload.startsWith('MSH')) endpoint = '/converthl72xtomongo';
        else if (payload.startsWith('H9')) endpoint = '/convertbeer2mongo';
      } else if (type === 'ExportFHIR') {
        endpoint = '/export/fhir';
      }
      const config = { headers: { 'Content-Type': endpoint.includes('ips2mongo')? 'application/json':'text/plain' } };
      if (type === 'ExportFHIR') config.responseType = 'blob';
      const resp = await axios.post(endpoint, type==='ExportFHIR'? jsonData||payload : (jsonData||payload), config);

      if (type === 'NoSQL') {
        const data = typeof resp.data === 'object' ? JSON.stringify(resp.data, null, 2) : resp.data;
        setPayload(data);
        showToast('Conversion successful', 'success');
      } else if (type === 'ExportFHIR') {
        // trigger download
        const blob = new Blob([resp.data], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'export.fhir.json'; document.body.appendChild(a); a.click(); a.remove();
        showToast('FHIR export downloaded', 'success');
      }
    } catch (err) {
      showToast(`${type} failed: ${err.message}`, 'danger');
    } finally {
      setOperation(null);
    }
  };

  const handleExportPDF = async () => {
    setOperation('ExportPDF');
    try {
      const resp = await axios.post(
        '/export/pdf', jsonData,
        { headers: { 'Content-Type': 'application/json' }, responseType: 'blob' }
      );
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'export.pdf'; document.body.appendChild(a); a.click(); a.remove();
      showToast('PDF exported', 'success');
    } catch (err) {
      showToast(`PDF export failed: ${err.message}`, 'danger');
    } finally {
      setOperation(null);
    }
  };

  return (
    <div className="container mt-4">
      <h4>CWIX Payload Viewer</h4>
      <Alert variant="info">
        This site displays the data on the NFC card presented. It can be exported to various formats for import into an electronic health record. No data is held on this website.
      </Alert>

      <div className="mb-3">
        <Button variant="success" onClick={handleImport} disabled={!!operation} className="me-2">
          {operation==='import'? <Spinner animation="border" size="sm"/>:'Import'}
        </Button>
        <Button variant="secondary" onClick={() => handleConvert('NoSQL')} disabled={!!operation} className="me-2">
          {operation==='NoSQL'? <Spinner animation="border" size="sm"/>:'NoSQL'}
        </Button>
        <Button variant="primary" onClick={() => handleConvert('ExportFHIR')} disabled={!jsonData||!!operation} className="me-2">
          {operation==='ExportFHIR'? <Spinner animation="border" size="sm"/>:'Export FHIR'}
        </Button>
        <Button variant="dark" onClick={handleExportPDF} disabled={!jsonData||!!operation}>
          {operation==='ExportPDF'? <Spinner animation="border" size="sm"/>:'Export PDF'}
        </Button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : (
        <Card>
          <Card.Body>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{payload}</pre>
          </Card.Body>
        </Card>
      )}

      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        <Toast onClose={() => setToast(t => ({...t, show:false}))} show={toast.show} bg={toast.variant} delay={4000} autohide>
          <Toast.Header><strong className="me-auto">IPS MERN NFC</strong></Toast.Header>
          <Toast.Body className={toast.variant!=='light'?'text-white':''}>{toast.msg}</Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}
