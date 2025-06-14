import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useContext } from 'react';
import { PatientContext } from '../PatientContext';
import { useSearchParams } from 'react-router-dom';
import pako from 'pako';
import axios from 'axios';
import { Button, Toast, ToastContainer, Alert, Card, Spinner } from 'react-bootstrap';
import { DataSet } from 'vis-data';
import { Timeline as VisTimeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.min.css';
import { generatePDF } from './Components/generatePDF';
import { useLoading } from '../contexts/LoadingContext';

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
  const { selectedPatient } = useContext(PatientContext);
  const [readableData, setReadableData] = useState('');
  const [nosqlData, setNosqlData] = useState(null);
  const [viewMode, setViewMode] = useState('readable'); // 'readable', 'nosql', 'timeline'
  const [selectedItem, setSelectedItem] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState(null);
  const [toast, setToast] = useState({ show: false, msg: '', variant: 'info' });
  const { stopLoading } = useLoading();

  const viaUrl = Boolean(searchParams.get('d'));


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
    // helper to take a bundle → plain text
    const convertToText = async bundle => {
      setJsonData(bundle);
      try {
        const resp = await axios.post(
          '/convertips2plaintext',
          bundle,
          { headers: { 'Content-Type': 'application/json' }, responseType: 'text' }
        );
        setReadableData(resp.data);
      } catch (err) {
        console.error('Conversion failed:', err);
        setError(err.message);
      } finally {
        // conversion is done
        setLoading(false);
      }
    };

    async function loadBundle() {
      const b64 = searchParams.get('d');
      let bundle;

      try {
        if (b64) {
          // decode from URL
          const std = toStandardBase64(b64);
          const bytes = Uint8Array.from(atob(std), c => c.charCodeAt(0));
          const text = pako.ungzip(bytes, { to: 'string' });
          bundle = JSON.parse(text);

        } else if (selectedPatient) {
          // fetch unified IPS bundle for context‐selected patient
          const resp = await axios.get(`/ipsunified/${selectedPatient._id}`);
          bundle = resp.data;

        } else {
          throw new Error('No data source: neither URL payload nor selected patient');
        }

        // we have the raw bundle—stop the global spinner now
        stopLoading();

        // now convert to plaintext (this only flips local `loading`)
        await convertToText(bundle);

      } catch (err) {
        console.error('Load failed:', err);
        setError(err.message);
        setLoading(false);
        stopLoading();
      }
    }

    loadBundle();
  }, [searchParams, selectedPatient, stopLoading]);

  const fetchNoSQL = useCallback(async () => {
    if (!jsonData) throw new Error('No JSON bundle to convert');
    const resp = await axios.post('/convertips2mongo', jsonData, { headers: { 'Content-Type': 'application/json' } });
    return resp.data;
  }, [jsonData]);


  // Prepare timeline items grouped into fixed lanes
  useEffect(() => {
    // only build items when we switch to the timeline
    if (viewMode !== 'timeline') return;

    // helper to build items from the flattened NoSQL shape
    const buildFromNoSQL = data => {
      let idx = 0;
      const mapList = (arr, group) =>
        (arr || []).map(o => ({
          id: ++idx,
          content: o.name,
          start: o.date,
          group,
          data: o
        }));

      return [
        ...mapList(data.medication, 'Medications'),
        ...mapList(data.allergies, 'Allergies'),
        ...mapList(data.conditions, 'Conditions'),
        ...mapList(data.observations, 'Observations')
      ];
    };

    // if we have NoSQL already, use it…
    if (nosqlData) {
      setItems(buildFromNoSQL(nosqlData));
      return;
    }

    // otherwise fetch it once, then map…
    fetchNoSQL()
      .then(data => {
        setNosqlData(data);
        setItems(buildFromNoSQL(data));
      })
      .catch(err => {
        console.error('Failed to fetch NoSQL for timeline', err);
      });
  }, [viewMode, nosqlData, fetchNoSQL]);

  // Initialize or update VisTimeline when switching to timeline
  // Initialize or update VisTimeline when switching to timeline
  useEffect(() => {
    if (viewMode !== 'timeline' || !timelineContainer.current) return;

    const dataItems = new DataSet(items);
    const dataGroups = new DataSet(TIMELINE_GROUPS);

    // compute optional start/end with padding
    let start, end;
    if (items.length) {
      const times = items.map(i => new Date(i.start).valueOf());
      const minT = Math.min(...times);
      const maxT = Math.max(...times);
      const span = maxT - minT;
      const MIN_PAD = 1000 * 60 * 5;           // 5 minutes
      const pad = Math.max(span * 0.05, MIN_PAD);
      start = new Date(minT - pad);
      end = new Date(maxT + pad);
    }

    // determine zoomMax so it’s at least big enough to show all items
    const windowSpan = start && end ? end.getTime() - start.getTime() : 0;
    const dynamicZoomMax = Math.max(ZOOM_MAX, windowSpan);

    // base options
    const options = {
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

    // only inject start/end if we computed them
    if (start && end) {
      options.start = start;
      options.end = end;
    }

    // destroy & recreate the timeline
    if (timelineInstance.current) {
      timelineInstance.current.destroy();
    }
    timelineInstance.current = new VisTimeline(
      timelineContainer.current,
      dataItems,
      dataGroups,
      options
    );

    // touch & click selection
    timelineInstance.current.on('select', ({ items: selectedIds }) => {
      if (selectedIds.length > 0) {
        const itm = items.find(i => i.id === selectedIds[0]);
        setSelectedItem(itm ?? null);
      }
    });

    // clear on deselect
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

  const handleExportPDF = () => {
    // —— APP NAVIGATION MODE ——
    // we already have the unified bundle in selectedPatient, so call generatePDF
    if (!viaUrl && selectedPatient) {
      generatePDF(selectedPatient);
      return;
    }

    // —— URL PAYLOAD MODE ——
    setOperation('ExportPDF');
    (async () => {
      try {
        const data = nosqlData || await fetchNoSQL();
        setNosqlData(data);
        await generatePDF(data);
        setViewMode('readable');
        showToast('PDF export initiated', 'success');
      } catch (err) {
        showToast(`PDF export failed: ${err.message}`, 'danger');
      } finally {
        setOperation(null);
      }
    })();
  };

  const handleViewTimeline = () => setViewMode(vm => (vm === 'timeline' ? 'readable' : 'timeline'));

  return (
    <div className="container mt-4">
      <h4>{viaUrl ? 'CWIX Payload Viewer' : 'Viewer'}</h4>
      {viaUrl && (
        <Alert variant="info">
          This site displays the data on the NFC card presented. It can be viewed as text or as a timeline. No data is held on this website.
        </Alert>
      )}
      <div className="mb-3 d-flex flex-wrap align-items-center">
        <Button variant="secondary" onClick={handleViewTimeline} className="me-2 mb-2">
          {viewMode === 'timeline' ? 'Text' : 'Timeline'}
        </Button>
        {viaUrl && (
          <Button variant="success" onClick={handleImport} disabled={!!operation} className="me-2 mb-2">
            {operation === 'import' ? <Spinner animation="border" size="sm" /> : 'Import'}
          </Button>
        )}
        <Button variant="secondary" onClick={handleToggleNoSQL} disabled={!!operation} className="me-2 mb-2">
          {operation === 'NoSQL' ? <Spinner animation="border" size="sm" /> : viewMode === 'nosql' ? 'Readable' : 'NoSQL'}
        </Button>
        {viaUrl && (
          <Button variant="primary" onClick={handleExportFHIR} disabled={!jsonData || !!operation} className="me-2 mb-2">
            {operation === 'ExportFHIR' ? <Spinner animation="border" size="sm" /> : 'FHIR'}
          </Button>
        )}
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
              <Card.Header className="py-1">
                Details — {selectedItem.group}
              </Card.Header>
              <Card.Body className="py-2">
                <dl className="row mb-0">
                  <dt className="col-4">Date</dt>
                  <dd className="col-8">
                    {(() => {
                      const d = new Date(selectedItem.data.date);
                      const datePart = d.toISOString().split('T')[0];      // "YYYY-MM-DD"
                      const timePart = d.toLocaleTimeString();            // local "HH:MM:SS"
                      return `${datePart} ${timePart}`;
                    })()}
                  </dd>

                  <dt className="col-4">Name</dt>
                  <dd className="col-8">{selectedItem.data.name}</dd>

                  <dt className="col-4">Code</dt>
                  <dd className="col-8">
                    {selectedItem.data.code ?? '—'}{' '}
                    <small>({selectedItem.data.system ?? '—'})</small>
                  </dd>

                  {/* Medication-specific */}
                  {selectedItem.data.dosage && (
                    <>
                      <dt className="col-4">Dosage</dt>
                      <dd className="col-8">{selectedItem.data.dosage}</dd>
                    </>
                  )}
                  {selectedItem.data.status && (
                    <>
                      <dt className="col-4">Status</dt>
                      <dd className="col-8">{selectedItem.data.status}</dd>
                    </>
                  )}

                  {/* Allergy-specific */}
                  {selectedItem.data.criticality && (
                    <>
                      <dt className="col-4">Criticality</dt>
                      <dd className="col-8">{selectedItem.data.criticality}</dd>
                    </>
                  )}

                  {/* Observation-specific */}
                  {selectedItem.data.value && (
                    <>
                      <dt className="col-4">Value</dt>
                      <dd className="col-8">{selectedItem.data.value}</dd>
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
