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
  const [selectedItem, setSelectedItem] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState(null);
  const [toast, setToast] = useState({ show: false, msg: '', variant: 'info' });


  const timelineContainer = useRef(null);

  const timelineInstance = useRef(null);

  // Zoom bounds
  const ZOOM_MIN = 1000 * 60 * 60;              // 1 hour
  const ZOOM_MAX = 1000 * 60 * 60 * 24 * 365 * 10;    // 1 year

  // Zoom helper functions
  const handleZoomInTimeline = () => {
    if (!timelineInstance.current) return;
    const win = timelineInstance.current.getWindow();
    const start = win.start.valueOf();
    const end = win.end.valueOf();
    const center = (start + end) / 2;
    let interval = end - start;
    interval = Math.max(interval * 0.5, ZOOM_MIN);
    const newStart = new Date(center - interval / 2);
    const newEnd = new Date(center + interval / 2);
    timelineInstance.current.setWindow(newStart, newEnd);
  };

  const handleZoomOutTimeline = () => {
    if (!timelineInstance.current) return;
    const win = timelineInstance.current.getWindow();
    const start = win.start.valueOf();
    const end = win.end.valueOf();
    const center = (start + end) / 2;
    let interval = end - start;
    interval = Math.min(interval * 2, ZOOM_MAX);
    const newStart = new Date(center - interval / 2);
    const newEnd = new Date(center + interval / 2);
    timelineInstance.current.setWindow(newStart, newEnd);
  };

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
        group: groupId,
        data: res,
      };
    }).filter(item => item);
    setItems(mapped);
  }, [jsonData]);

  // Initialize or update VisTimeline when switching to timeline
  useEffect(() => {
    if (viewMode !== 'timeline' || !timelineContainer.current) return;

    const dataItems = new DataSet(items);
    const dataGroups = new DataSet(TIMELINE_GROUPS);

    let start, end;

    if (items.length) {
      // 1) find absolute min/max
      const times = items.map(i => new Date(i.start).valueOf());
      const minT = Math.min(...times);
      const maxT = Math.max(...times);
      const span = maxT - minT;

      // 2) choose padding: 5% of span, but at least 5 minutes
      const MIN_PAD = 1000 * 60 * 5;
      const pad = Math.max(span * 0.05, MIN_PAD);

      // 3) build window corners
      start = new Date(minT - pad);
      end = new Date(maxT + pad);
    }

    // 4) ensure zoomMax is ≥ your initial window span
    const windowSpan = end.getTime() - start.getTime();
    const dynamicZoomMax = Math.max(ZOOM_MAX, windowSpan);

    const options = {
      start,
      end,
      zoomMin: ZOOM_MIN,
      zoomMax: dynamicZoomMax,
      zoomKey: null,
      horizontalScroll: true,
      zoomable: true,
      moveable: true,
      stack: false,
      tooltip: {
        followMouse: true,
        overflowMethod: 'cap'
      }
    };

    if (timelineInstance.current) {
      timelineInstance.current.destroy();
    }
    timelineInstance.current = new VisTimeline(
      timelineContainer.current,
      dataItems,
      dataGroups,
      options
    );

    // listen for select (works on touch & click)
    timelineInstance.current.on('select', ({ items: selectedIds }) => {
      if (selectedIds.length > 0) {
        const id = selectedIds[0];
        const itm = items.find(i => i.id === id);
        setSelectedItem(itm?.data ?? null);
      }
    });

    // clear when you click outside or deselect
    timelineInstance.current.on('deselect', () => {
      setSelectedItem(null);
    });
  }, [viewMode, items, ZOOM_MIN, ZOOM_MAX]);


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
      const yyyymmdd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
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
        NFC card can be viewed as text or as a timeline. No data is held on this website.
      </Alert>
      <div className="mb-3 d-flex flex-wrap align-items-center">
        <Button variant="secondary" onClick={handleViewTimeline} className="me-2 mb-2">
          {viewMode === 'timeline' ? 'Text' : 'Timeline'}
        </Button>
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
        <>
          <div
            ref={timelineContainer}
            style={{ height: '35vh', border: '1px solid #ddd' }}
          />

          <div className="mt-2 mb-4 text-center">
            <Button
              variant="outline-primary"
              onClick={handleZoomInTimeline}
              className="me-2"
            >
              Zoom In
            </Button>
            <Button
              variant="outline-primary"
              onClick={handleZoomOutTimeline}
            >
              Zoom Out
            </Button>
          </div>

          {/* ←←← INSERT YOUR DETAILS CARD HERE →→→ */}
          {selectedItem && (
            <Card className="mb-4" style={{ fontSize: '0.9rem' }}>
              <Card.Header className="py-1">Details — {selectedItem.resourceType}</Card.Header>
              <Card.Body className="py-2">
                <dl className="row mb-0">
                  <dt className="col-4">Date</dt>
                  <dd className="col-8">
                    {new Date(
                      selectedItem.authoredOn ||
                      selectedItem.onsetDateTime ||
                      selectedItem.effectiveDateTime
                    ).toLocaleString()}
                  </dd>

                  <dt className="col-4">Name</dt>
                  <dd className="col-8">
                    {selectedItem.code?.coding?.[0]?.display ||
                      selectedItem.medicationReference?.display}
                  </dd>

                  <dt className="col-4">Code</dt>
                  <dd className="col-8">
                    {selectedItem.code?.coding?.[0]?.code} (
                    <small>{selectedItem.code?.coding?.[0]?.system}</small>)
                  </dd>

                  {selectedItem.resourceType === 'MedicationRequest' && (
                    <>
                      <dt className="col-4">Dosage</dt>
                      <dd className="col-8">{selectedItem.dosageInstruction?.[0]?.text || '—'}</dd>
                    </>
                  )}

                  {selectedItem.resourceType === 'AllergyIntolerance' && (
                    <>
                      <dt className="col-4">Criticality</dt>
                      <dd className="col-8">{selectedItem.criticality}</dd>
                    </>
                  )}

                  {selectedItem.resourceType === 'Observation' && selectedItem.valueQuantity && (
                    <>
                      <dt className="col-4">Value</dt>
                      <dd className="col-8">
                        {selectedItem.valueQuantity.value}{' '}
                        {selectedItem.valueQuantity.unit}
                      </dd>
                    </>
                  )}
                </dl>
              </Card.Body>
            </Card>
          )}
          {/* ←←← DETAILS CARD END →→→ */}

        </>
      ) : viewMode === 'nosql' ? (
        <Card>
          <Card.Body>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(nosqlData, null, 2)}
            </pre>
          </Card.Body>
        </Card>
      ) : (
        <Card>
          <Card.Body>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {readableData}
            </pre>
          </Card.Body>
        </Card>
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
