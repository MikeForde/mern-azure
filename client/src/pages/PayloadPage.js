import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import pako from 'pako';
import axios from 'axios';
import { Button, Toast, ToastContainer, Alert, Card, Spinner } from 'react-bootstrap';
import { DataSet } from 'vis-data';
import { Timeline as VisTimeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.min.css';
import { generatePDF } from './Components/generatePDF';

// Define fixed lanes/categories
const TIMELINE_GROUPS = [
  { id: 'Medications', content: 'Medications' },
  { id: 'Allergies', content: 'Allergies' },
  { id: 'Conditions', content: 'Conditions' },
  { id: 'Observations', content: 'Observations' }
];

export default function PayloadPage() {
  const [searchParams] = useSearchParams();
  const [jsonData, setJsonData] = useState(null);
  const [readableData, setReadableData] = useState('');
  const [nosqlData, setNosqlData] = useState(null);
  const [viewMode, setViewMode] = useState('readable'); // 'readable', 'nosql', 'timeline'
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState(null);
  const [toast, setToast] = useState({ show: false, msg: '', variant: 'info' });

  const timelineContainer = useRef(null);
  const timelineInstance = useRef(null);

  const toStandardBase64 = (b64) =>
    b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(b64.length + (4 - b64.length % 4) % 4, '=');

  // On load: decode and get plaintext
  useEffect(() => {
    async function decodeAndPrepare() {
      try {
        const b64 = searchParams.get('d');
        if (!b64) throw new Error('No data found in URL.');
        const std = toStandardBase64(b64);
        const bytes = Uint8Array.from(atob(std), c => c.charCodeAt(0));
        const text = pako.ungzip(bytes, { to: 'string' });
        if (/^\{/.test(text) && text.includes('"resourceType"') && text.includes('Bundle')) {
          const parsed = JSON.parse(text);
          setJsonData(parsed);
          const resp = await axios.post(
            '/convertips2plaintext', parsed,
            { headers: { 'Content-Type': 'application/json' }, responseType: 'text' }
          );
          setReadableData(resp.data);
        } else {
          setReadableData(text);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    decodeAndPrepare();
  }, [searchParams]);

  // Prepare timeline items grouped into fixed lanes
  useEffect(() => {
    if (!jsonData) return;
    const entries = jsonData.entry || [];
    const mapped = entries.map((e, idx) => {
      const res = e.resource;
      let groupId, start, content;
      switch (res.resourceType) {
        case 'MedicationRequest':
          groupId = 'Medications';
          start = res.authoredOn;
          content = res.medicationReference?.display || res.id;
          break;
        case 'AllergyIntolerance':
          groupId = 'Allergies';
          start = res.onsetDateTime;
          content = res.code?.coding?.[0]?.display || res.id;
          break;
        case 'Condition':
          groupId = 'Conditions';
          start = res.onsetDateTime;
          content = res.code?.coding?.[0]?.display || res.id;
          break;
        case 'Observation':
          groupId = 'Observations';
          start = res.effectiveDateTime;
          if (res.valueQuantity) {
            content = `${res.code?.coding?.[0]?.display}: ${res.valueQuantity.value} ${res.valueQuantity.unit}`;
          } else if (res.bodySite) {
            content = `${res.code?.coding?.[0]?.display} (${res.bodySite.coding?.[0]?.display})`;
          } else {
            content = res.code?.coding?.[0]?.display || res.id;
          }
          break;
        default:
          return null;
      }
      if (!start) return null;
      return {
        id: idx + 1,
        content,
        start,
        group: groupId
      };
    }).filter(item => item);
    setItems(mapped);
  }, [jsonData]);

  // Initialize or update VisTimeline when switching to timeline
  useEffect(() => {
    if (viewMode !== 'timeline' || !timelineContainer.current) return;
    const dataItems = new DataSet(items);
    const dataGroups = new DataSet(TIMELINE_GROUPS);
    const options = {
      zoomMin: 1000 * 60 * 60 * 24,        // 1 day
      zoomMax: 1000 * 60 * 60 * 24 * 365,  // 1 year
      horizontalScroll: true,
      zoomable: true,
      moveable: true,
      stack: false,
      groupOrder: 'content',
      tooltip: { followMouse: true, overflowMethod: 'cap' }
    };
    if (timelineInstance.current) timelineInstance.current.destroy();
    timelineInstance.current = new VisTimeline(
      timelineContainer.current,
      dataItems,
      dataGroups,
      options
    );
    timelineInstance.current.on('itemclick', props => {
      const itm = items.find(i => i.id === props.item);
      if (itm) alert(`${itm.content}\n${new Date(itm.start).toLocaleString()}`);
    });
  }, [viewMode, items]);

  const showToast = (msg, variant = 'info') => setToast({ show: true, msg, variant });

  const handleImport = async () => {
    setOperation('import');
    try {
      if (!jsonData) throw new Error('Nothing to import');
      await axios.post('/ipsbundle', jsonData, { headers: { 'Content-Type': 'application/json' } });
      showToast('Import successful', 'success');
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'danger');
    } finally {
      setOperation(null);
    }
  };

  const fetchNoSQL = async () => {
    if (!jsonData) throw new Error('No JSON bundle to convert');
    const resp = await axios.post('/convertips2mongo', jsonData, { headers: { 'Content-Type': 'application/json' } });
    return resp.data;
  };

  const handleToggleNoSQL = async () => {
    if (viewMode !== 'nosql') {
      setOperation('NoSQL');
      if (nosqlData) {
        setViewMode('nosql');
        showToast('Showing cached NoSQL', 'info');
        setOperation(null);
      } else {
        try {
          const data = await fetchNoSQL();
          setNosqlData(data);
          setViewMode('nosql');
          showToast('Converted to NoSQL', 'success');
        } catch (err) {
          showToast(`Conversion failed: ${err.message}`, 'danger');
        } finally {
          setOperation(null);
        }
      }
    } else {
      setViewMode('readable');
    }
  };

  const handleExportFHIR = async () => {
    setOperation('ExportFHIR');
    try {
      const data = nosqlData || await fetchNoSQL();
      setNosqlData(data);
      const now = new Date(); const pad = n => n.toString().padStart(2, '0');
      const yyyymmdd = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
      const { packageUUID, patient: { name: familyName, given: givenName } } = data;
      const sanitize = str => str.normalize('NFKD').replace(/[^\w]/g, '_').toUpperCase();
      const fileName = `${yyyymmdd}-${sanitize(familyName)}_${sanitize(givenName)}_${packageUUID.slice(-6)}_fhir.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      setViewMode('readable'); showToast('FHIR download initiated', 'success');
    } catch (err) {
      showToast(`Download failed: ${err.message}`, 'danger');
    } finally { setOperation(null); }
  };

  const handleExportPDF = async () => {
    setOperation('ExportPDF');
    try {
      const data = nosqlData || await fetchNoSQL();
      setNosqlData(data);
      await generatePDF(data);
      setViewMode('readable'); showToast('PDF export initiated', 'success');
    } catch (err) {
      showToast(`PDF export failed: ${err.message}`, 'danger');
    } finally { setOperation(null); }
  };

  const handleViewTimeline = () => setViewMode(vm => (vm === 'timeline' ? 'readable' : 'timeline'));

  return (
    <div className="container mt-4">
      <h4>CWIX Payload Viewer</h4>
      <Alert variant="info">
        This site displays the data on the NFC card presented. It can be viewed as text or as a timeline. No data is held on this website.
      </Alert>
      <div className="mb-3 d-flex flex-wrap align-items-center">
        <Button variant="secondary" onClick={handleViewTimeline} className="me-2 mb-2">
          {viewMode === 'timeline' ? 'Text' : 'Timeline'}
        </Button>
        {viewMode === 'timeline' && (
          <>
            <Button variant="outline-primary" onClick={() => timelineInstance.current.zoomIn()} className="me-2 mb-2">
              Zoom In
            </Button>
            <Button variant="outline-primary" onClick={() => timelineInstance.current.zoomOut()} className="me-2 mb-2">
              Zoom Out
            </Button>
          </>
        )}
        <Button variant="success" onClick={handleImport} disabled={!!operation} className="me-2 mb-2">
          {operation === 'import' ? <Spinner animation="border" size="sm" /> : 'Import'}
        </Button>
        <Button variant="secondary" onClick={handleToggleNoSQL} disabled={!!operation} className="me-2 mb-2">
          {operation === 'NoSQL' ? <Spinner animation="border" size="sm" /> : viewMode === 'nosql' ? 'Readable' : 'NoSQL'}
        </Button>
        <Button variant="primary" onClick={handleExportFHIR} disabled={!jsonData || !!operation} className="me-2 mb-2">
          {operation === 'ExportFHIR' ? <Spinner animation="border" size="sm" /> : 'FHIR'}
        </Button>
        <Button variant="dark" onClick={handleExportPDF} disabled={!jsonData || !!operation} className="mb-2">
          {operation === 'ExportPDF' ? <Spinner animation="border" size="sm" /> : 'PDF'}
        </Button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : viewMode === 'timeline' ? (
        <div ref={timelineContainer} style={{ height: '70vh', border: '1px solid #ddd' }} />
      ) : viewMode === 'nosql' ? (
        <Card><Card.Body><pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(nosqlData, null, 2)}</pre></Card.Body></Card>
      ) : (
        <Card><Card.Body><pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{readableData}</pre></Card.Body></Card>
      )}

      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        <Toast show={toast.show} bg={toast.variant} delay={4000} autohide onClose={() => setToast(t => ({ ...t, show: false }))}>
          <Toast.Header><strong className="me-auto">IPS MERN NFC</strong></Toast.Header>
          <Toast.Body className={toast.variant !== 'light' ? 'text-white' : ''}>{toast.msg}</Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}
