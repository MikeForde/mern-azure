import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import pako from 'pako';
import axios from 'axios';
import { Button, Toast, ToastContainer, Alert, Card, Spinner } from 'react-bootstrap';
import { generatePDF } from './Components/generatePDF';

export default function PayloadPage() {
  const [searchParams] = useSearchParams();
  const [payload, setPayload] = useState('');                 // current displayed payload
  const [jsonData, setJsonData] = useState(null);             // parsed IPS JSON bundle
  const [readableData, setReadableData] = useState('');       // human-readable text
  const [nosqlData, setNosqlData] = useState(null);           // cached NoSQL JSON object
  const [viewMode, setViewMode] = useState('readable');       // 'readable' or 'nosql'
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState(null);            // import/convert/export status
  const [toast, setToast] = useState({ show: false, msg: '', variant: 'info' });

  const toStandardBase64 = (b64) =>
    b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(b64.length + (4 - b64.length % 4) % 4, '=');

  useEffect(() => {
    async function decodeAndConvert() {
      try {
        const b64 = searchParams.get('d');
        if (!b64) throw new Error('No data found in URL.');
        const std = toStandardBase64(b64);
        const bytes = Uint8Array.from(atob(std), c => c.charCodeAt(0));
        const text = pako.ungzip(bytes, { to: 'string' });

        if (text.trim().startsWith('{') && text.includes('"resourceType"') && text.includes('Bundle')) {
          const parsed = JSON.parse(text);
          setJsonData(parsed);

          const resp = await axios.post(
            '/convertips2plaintext', parsed,
            { headers: { 'Content-Type': 'application/json' }, responseType: 'text' }
          );
          setReadableData(resp.data);
          setPayload(resp.data);
          setViewMode('readable');
        } else {
          setReadableData(text);
          setPayload(text);
          setViewMode('readable');
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

  const showToast = (msg, variant = 'info') => setToast({ show: true, msg, variant });

  const handleImport = async () => {
    if (!payload) return;
    setOperation('import');
    try {
      let endpoint, body, isJson;
      if (jsonData) { endpoint = '/ipsbundle'; body = jsonData; isJson = true; }
      else if (payload.startsWith('MSH')) { endpoint = '/ipsfromhl72x'; body = payload; isJson = false; }
      else if (payload.startsWith('H9')) { endpoint = '/ipsfrombeer'; body = payload; isJson = false; }
      else throw new Error('Unrecognized format');
      await axios.post(endpoint, body, { headers: { 'Content-Type': isJson ? 'application/json' : 'text/plain' } });
      showToast('Import successful', 'success');
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'danger');
    } finally {
      setOperation(null);
    }
  };

  const fetchNoSQL = async () => {
    let endpoint;
    if (jsonData) endpoint = '/convertips2mongo';
    else if (payload.startsWith('MSH') || payload.startsWith('H9')) {
      // raw text payload: HL7 or Beer, but caching only IPS JSON -> Mongo
      throw new Error('No JSON Bundle to convert to NoSQL');
    } else {
      throw new Error('No JSON Bundle to convert to NoSQL');
    }
    const resp = await axios.post(endpoint, jsonData, { headers: { 'Content-Type': 'application/json' } });
    return resp.data;
  };

  const handleToggleNoSQL = async () => {
    if (viewMode === 'readable') {
      // switch to NoSQL view
      if (nosqlData) {
        setPayload(JSON.stringify(nosqlData, null, 2));
        setViewMode('nosql');
      } else {
        setOperation('NoSQL');
        try {
          const data = await fetchNoSQL();
          setNosqlData(data);
          setPayload(JSON.stringify(data, null, 2));
          setViewMode('nosql');
          showToast('Conversion to NoSQL successful', 'success');
        } catch (err) {
          showToast(`NoSQL conversion failed: ${err.message}`, 'danger');
        } finally {
          setOperation(null);
        }
      }
    } else {
      // switch back to readable
      setPayload(readableData);
      setViewMode('readable');
    }
  };

  const handleExportFHIR = async () => {
    if (!jsonData) return;
    setOperation('ExportFHIR');
    try {
      // reuse cached or fetch fresh NoSQL for naming
      const data = nosqlData || await fetchNoSQL();
      setNosqlData(data);

      const today = new Date(); const pad = n => n.toString().padStart(2, '0');
      const yyyymmdd = `${today.getFullYear()}${pad(today.getMonth()+1)}${pad(today.getDate())}`;
      const { packageUUID, patient: { name: familyName, given: givenName } } = data;
      const sanitize = str => str.normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      const fam = sanitize(familyName), giv = sanitize(givenName), last6 = packageUUID.slice(-6);
      const fileName = `${yyyymmdd}-${fam}_${giv}_${last6}_fhir.json`;

      const blob = new Blob([JSON.stringify(data, null,2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);

      // revert to readable view
      setPayload(readableData);
      setViewMode('readable');
      showToast('FHIR download initiated', 'success');
    } catch (err) {
      showToast(`FHIR download failed: ${err.message}`, 'danger');
    } finally {
      setOperation(null);
    }
  };

  const handleExportPDF = async () => {
    if (!jsonData) return;
    setOperation('ExportPDF');
    try {
      const data = nosqlData || await fetchNoSQL();
      setNosqlData(data);
      await generatePDF(data);
      showToast('PDF export initiated', 'success');
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
          {operation==='import' ? <Spinner animation="border" size="sm"/> : 'Import'}
        </Button>
        <Button
          variant="secondary"
          onClick={handleToggleNoSQL}
          disabled={!!operation}
          className="me-2"
        >
          {operation==='NoSQL'
            ? <Spinner animation="border" size="sm"/>
            : viewMode==='readable'
              ? 'NoSQL'
              : 'Simple'
          }
        </Button>
        <Button variant="primary" onClick={handleExportFHIR} disabled={!jsonData || !!operation} className="me-2">
          {operation==='ExportFHIR' ? <Spinner animation="border" size="sm"/> : 'Export FHIR'}
        </Button>
        <Button variant="dark" onClick={handleExportPDF} disabled={!jsonData || !!operation}>
          {operation==='ExportPDF' ? <Spinner animation="border" size="sm"/> : 'Export PDF'}
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
        <Toast onClose={() => setToast(t => ({...t, show: false}))} show={toast.show} bg={toast.variant} delay={4000} autohide>
          <Toast.Header><strong className="me-auto">IPS MERN NFC</strong></Toast.Header>
          <Toast.Body className={toast.variant!=='light'?'text-white':''}>{toast.msg}</Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}
