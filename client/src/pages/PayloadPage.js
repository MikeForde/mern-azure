import React, { useEffect, useState, useRef, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import pako from 'pako';
import axios from 'axios';
import {
  Button,
  Toast,
  ToastContainer,
  Alert,
  Card,
  Spinner
} from 'react-bootstrap';
import { DataSet } from 'vis-data';
import { Timeline as VisTimeline } from 'vis-timeline/standalone';
import 'vis-timeline/styles/vis-timeline-graph2d.min.css';
import { generatePDF } from './Components/generatePDF';
import { useLoading } from '../contexts/LoadingContext';
import { PatientContext } from '../PatientContext';

// Define fixed lanes/categories
const TIMELINE_GROUPS = [
  { id: 'Medications', content: 'Medications' },
  { id: 'Allergies', content: 'Allergies' },
  { id: 'Conditions', content: 'Conditions' },
  { id: 'Observations', content: 'Observations' },
  { id: 'Procedures', content: 'Procedures' }
];

// Informational copy shown when user lands via URL (NFC flow)
const infoHtml = `
<p>This NATO patient tag contains the digital record of this patient and their recent care. This information has been carried securely by the patient without the requirement for transmission elsewhere.</p>
<p>You can now digitally import the patient, their diagnoses, symptoms, observations and treatments to your electronic health record. It can be exported in different open formats or viewed as a PDF.</p>
<p>This enables digital patient handover to any other medical facility, enabling optimal care for all.</p>
<p><strong>This Defence Medical Services innovation is offered as a free good in the service of all.</strong></p>
`;

const BRAND = {
  primary: '#1f73d4',   // deep blue
  accent: '#00ad85',    // teal
  light: '#f2f7ff',     // very light blue
  text: '#1a1a1e',      // near-black
  subtle: '#8c8f91',    // muted grey
  stripe: '#f5f5f7'     // zebra background
};



export default function PayloadPage() {
  const [searchParams] = useSearchParams();
  const viaUrl = Boolean(searchParams.get('d'));
  const { selectedPatient } = useContext(PatientContext);
  const { stopLoading } = useLoading();

  const [jsonData, setJsonData] = useState(null);
  const [readableData, setReadableData] = useState('');
  const [nosqlData, setNosqlData] = useState(null);
  const [viewMode, setViewMode] = useState(viaUrl ? 'info' : 'readable'); // 'info', 'readable', 'report', 'nosql', 'timeline'
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState(null);
  const [toast, setToast] = useState({ show: false, msg: '', variant: 'info' });

  const timelineContainer = useRef(null);
  const timelineInstance = useRef(null);

  // Zoom bounds
  const ZOOM_MIN = 1000 * 60 * 60;               // 1 hour
  const ZOOM_MAX = 1000 * 60 * 60 * 24 * 365 * 10; // 10 years

  // Helpers
  const toStandardBase64 = b64 =>
    b64.replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(b64.length + (4 - b64.length % 4) % 4, '=');

  const showToast = (msg, variant = 'info') =>
    setToast({ show: true, msg, variant });

  // Load both plaintext & NoSQL on entry
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const b64 = searchParams.get('d');

      try {
        if (viaUrl) {
          // decode URL payload - usually from NFC card but could be a link to pasted in browser
          const std = toStandardBase64(b64);
          const bytes = Uint8Array.from(atob(std), c => c.charCodeAt(0));
          const text = pako.ungzip(bytes, { to: 'string' });
          const bundle = JSON.parse(text);
          setJsonData(bundle);

          // plaintext conversion
          const ptResp = await axios.post(
            '/convertips2plaintext',
            bundle,
            { headers: { 'Content-Type': 'application/json' }, responseType: 'text' }
          );
          if (cancelled) return;
          setReadableData(ptResp.data);

          // NoSQL conversion
          const nsResp = await axios.post(
            '/convertips2mongo',
            bundle,
            { headers: { 'Content-Type': 'application/json' } }
          );
          if (cancelled) return;
          setNosqlData(nsResp.data);

        } else if (selectedPatient) {
          // navigation mode: selectedPatient is already NoSQL
          setNosqlData(selectedPatient);

          // plaintext via server endpoint
          const ptResp = await axios.get(`/ipsplaintext/${selectedPatient._id}`);
          if (cancelled) return;
          setReadableData(ptResp.data);
        } else {
          throw new Error('No data source: neither URL payload nor selected patient');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Load failed:', err);
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          stopLoading();
        }
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, [viaUrl, searchParams, selectedPatient, stopLoading]);


  // Build timeline items when switching to timeline
  useEffect(() => {
    if (viewMode !== 'timeline') return;

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
        ...mapList(data.observations, 'Observations'),
        ...mapList(data.procedures, 'Procedures'),
      ];
    };

    if (nosqlData) {
      setItems(buildFromNoSQL(nosqlData));
      return;
    }
  }, [viewMode, nosqlData]);


  // 4) Initialize/update VisTimeline
  useEffect(() => {
    if (viewMode !== 'timeline' || !timelineContainer.current) return;
    if (!items.length) return;

    const dataItems = new DataSet(items);
    const dataGroups = new DataSet(TIMELINE_GROUPS);

    // compute padded window
    const times = items.map(i => new Date(i.start).valueOf());
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const span = maxT - minT;
    const MIN_PAD = 1000 * 60 * 5;
    const pad = Math.max(span * 0.05, MIN_PAD);

    const start = new Date(minT - pad);
    const end = new Date(maxT + pad);
    const windowSpan = end.getTime() - start.getTime();
    const dynamicZoomMax = Math.max(ZOOM_MAX, windowSpan);

    const options = {
      zoomMin: ZOOM_MIN,
      zoomMax: dynamicZoomMax,
      zoomKey: null,
      horizontalScroll: true,
      zoomable: true,
      moveable: true,
      stack: false,
      tooltip: { followMouse: true, overflowMethod: 'cap' },
      start,
      end
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

    timelineInstance.current.on('select', ({ items: selectedIds }) => {
      if (selectedIds.length) {
        const itm = items.find(i => i.id === selectedIds[0]);
        setSelectedItem(itm ?? null);
      }
    });
    timelineInstance.current.on('deselect', () => setSelectedItem(null));

  }, [viewMode, items, ZOOM_MAX, ZOOM_MIN]);


  // Zoom controls
  const handleZoomInTimeline = () => {
    if (!timelineInstance.current) return;
    const win = timelineInstance.current.getWindow();
    const startMs = win.start.valueOf();
    const endMs = win.end.valueOf();
    const center = (startMs + endMs) / 2;
    let interval = endMs - startMs;
    interval = Math.max(interval * 0.5, ZOOM_MIN);
    timelineInstance.current.setWindow(
      new Date(center - interval / 2),
      new Date(center + interval / 2)
    );
  };
  const handleZoomOutTimeline = () => {
    if (!timelineInstance.current) return;
    const win = timelineInstance.current.getWindow();
    const startMs = win.start.valueOf();
    const endMs = win.end.valueOf();
    const center = (startMs + endMs) / 2;
    let interval = endMs - startMs;
    interval = Math.min(interval * 2, ZOOM_MAX);
    timelineInstance.current.setWindow(
      new Date(center - interval / 2),
      new Date(center + interval / 2)
    );
  };


  // Action handlers
  const handleImport = async () => {
    setOperation('import');
    try {
      if (!jsonData) throw new Error('No bundle to import');
      await axios.post('/ipsbundle', jsonData, {
        headers: { 'Content-Type': 'application/json' }
      });
      showToast('Import successful', 'success');
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'danger');
    } finally {
      setOperation(null);
    }
  };

  // Cycle Info/Readable/NoSQL (Info only participates when viaUrl)
  const handleCycleInfoReadableNoSQL = () => {
    if (viaUrl) {
      setViewMode(prev => (prev === 'info' ? 'readable' : prev === 'readable' ? 'report' : prev === 'report' ? 'nosql' : 'info'));
    } else {
      setViewMode(prev => (prev === 'readable' ? 'report' : prev === 'report' ? 'nosql' : 'readable'));
    }
  };


  const handleExportFHIR = async () => {
    setOperation('ExportFHIR');
    try {
      const data = nosqlData;
      const now = new Date();
      const pad = n => n.toString().padStart(2, '0');
      const yyyymmdd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
      const { packageUUID, patient: { name: familyName, given: givenName } } = data;
      const sanitize = str => str.normalize('NFKD').replace(/[^\w]/g, '_').toUpperCase();
      const fileName = `${yyyymmdd}-${sanitize(familyName)}_${sanitize(givenName)}_${packageUUID.slice(-6)}_fhir.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setViewMode('readable');
      showToast('FHIR download initiated', 'success');
    } catch (err) {
      showToast(`Download failed: ${err.message}`, 'danger');
    } finally {
      setOperation(null);
    }
  };

  const handleExportPDF = () => {
    if (!viaUrl && selectedPatient) {
      // synchronous PDF in navigation mode
      generatePDF(selectedPatient);
      return;
    }
    setOperation('ExportPDF');
    (async () => {
      try {
        const data = nosqlData;
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

  const handleViewTimeline = () =>
    setViewMode(vm => vm === 'timeline' ? 'readable' : 'timeline');

  // ---- helpers mirroring generatePDF ----
  const formatDateNoTime = (dateString) => (String(dateString || '').split('T')[0] || '');
  const toEpoch = (v) => {
    if (!v) return Infinity;
    const s = String(v).trim();
    const iso = s.includes('T') ? s : s.includes(' ') ? s.replace(' ', 'T') : s;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? Infinity : t;
  };
  const byOldest = (a, b) => toEpoch(a?.date) - toEpoch(b?.date);


  // Render
  return (
    <div className="container mt-4">
      <h4>{viaUrl ? 'NATO Patient Tag Viewer' : 'Viewer'}</h4>
      {viaUrl && (
        <Alert variant="info">
          This site displays the data on the NFC card presented. It can be viewed here in various formats. No data is held on this website unless you choose to import it.
        </Alert>
      )}

      <div className="mb-3 d-flex flex-wrap align-items-center">
        <Button
          variant="secondary"
          onClick={handleViewTimeline}
          className="me-2 mb-2"
        >
          {viewMode === 'timeline' ? 'Text' : 'Timeline'}
        </Button>

        {viaUrl && (
          <Button
            variant="success"
            onClick={handleImport}
            disabled={!!operation}
            className="me-2 mb-2"
          >
            {operation === 'import'
              ? <Spinner animation="border" size="sm" />
              : 'Import'}
          </Button>
        )}

        <Button
          variant="secondary"
          onClick={handleCycleInfoReadableNoSQL}
          className="me-2 mb-2"
        >
          {viaUrl
            ? viewMode === 'info'
              ? 'Simple Text'
              : viewMode === 'readable'
                ? 'Formatted Text'
                : viewMode === 'report'
                  ? 'NoSQL'
                  : 'Info'
            : viewMode === 'readable'
              ? 'Formatted Text'
              : viewMode === 'report'
                ? 'NoSQL'
                : 'Simple Text'}
        </Button>


        {viaUrl && (
          <Button
            variant="primary"
            onClick={handleExportFHIR}
            disabled={!nosqlData || !!operation}
            className="me-2 mb-2"
          >
            {operation === 'ExportFHIR'
              ? <Spinner animation="border" size="sm" />
              : 'FHIR'}
          </Button>
        )}

        <Button
          variant="dark"
          onClick={handleExportPDF}
          disabled={(!nosqlData && !selectedPatient) || !!operation}
          className="mb-2"
        >
          {operation === 'ExportPDF'
            ? <Spinner animation="border" size="sm" />
            : 'PDF'}
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
                      const datePart = d.toISOString().slice(0, 10);
                      const timePart = d.toLocaleTimeString();
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
                  {selectedItem.data.criticality && (
                    <>
                      <dt className="col-4">Criticality</dt>
                      <dd className="col-8">{selectedItem.data.criticality}</dd>
                    </>
                  )}
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
        </>
      ) : viewMode === 'nosql' ? (
        <Card>
          <Card.Body>
            <h5>This is the data in machine-readable JSON format</h5>
            <p>This could also be entered directly into a NoSQL Database</p>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(nosqlData, null, 2)}
            </pre>
          </Card.Body>
        </Card>
      ) : viewMode === 'info' ? (
        <Card>
          <Card.Body>
            <div dangerouslySetInnerHTML={{ __html: infoHtml }} />
          </Card.Body>
        </Card>
      ) : viewMode === 'report' ? (
        <div>
          <h5>This is the data as HTML Formatted text</h5>
          {/* Patient header card */}
          <Card className="mb-3">
            <Card.Header style={{ backgroundColor: BRAND.primary, color: 'white', fontWeight: 'bold' }}>International Patient Summary</Card.Header>
            <Card.Body style={{ color: BRAND.text }}>
              <div className="row">
                <div className="col-12 col-md-6">
                  <div className="mb-1"><strong>Name: </strong>{nosqlData?.patient?.given} {nosqlData?.patient?.name}</div>
                  <div className="mb-1"><strong>DOB: </strong>{formatDateNoTime(nosqlData?.patient?.dob)}</div>
                  <div className="mb-1"><strong>Gender: </strong>{nosqlData?.patient?.gender}</div>
                  <div className="mb-1"><strong>NATO id: </strong>{nosqlData?.patient?.identifier}</div>
                </div>
                <div className="col-12 col-md-6">
                  <div className="mb-1"><strong>Country: </strong>{nosqlData?.patient?.nation}</div>
                  <div className="mb-1"><strong>Practitioner: </strong>{nosqlData?.patient?.practitioner}</div>
                  <div className="mb-1"><strong>Organization: </strong>{nosqlData?.patient?.organization}</div>
                  <div className="mb-1"><strong>National id: </strong>{nosqlData?.patient?.identifier2}</div>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Section helper */}
          {Boolean(nosqlData?.medication?.length) && (
            <Card className="mb-3 border-0 shadow-sm">
              <Card.Header style={{ backgroundColor: BRAND.primary, color: 'white', fontWeight: 'bold' }}>Medications</Card.Header>
              <Card.Body style={{ backgroundColor: BRAND.light, color: BRAND.text }}>
                <div className="table-responsive">
                  <table className="table table-sm table-striped align-middle" style={{ backgroundColor: 'white', border: `1px solid ${BRAND.primary}` }}>
                    <thead style={{ backgroundColor: BRAND.light, color: BRAND.primary }}>
                      <tr>
                        <th style={{ width: '30%' }}>Name</th>
                        <th style={{ width: '22%' }}>Dosage</th>
                        <th style={{ width: '14%' }}>Code</th>
                        <th style={{ width: '16%' }}>System</th>
                        <th style={{ width: '18%' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(nosqlData.medication || [])].sort(byOldest).map((m, i) => (
                        <tr key={i}>
                          <td>{m.name || ''}</td>
                          <td className="text-muted">{m.dosage || ''}</td>
                          <td>{m.code || ''}</td>
                          <td className="text-muted">{m.system || ''}</td>
                          <td>{m.date ? m.date.replace('T', ' ').split('.')[0] : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>
          )}

          {Boolean(nosqlData?.allergies?.length) && (
            <Card className="mb-3">
              <Card.Header style={{ backgroundColor: BRAND.primary, color: 'white', fontWeight: 'bold' }}>Allergies</Card.Header>
              <Card.Body style={{ backgroundColor: BRAND.light, color: BRAND.text }}>
                <div className="table-responsive">
                  <table className="table table-sm table-striped align-middle" style={{ backgroundColor: 'white', border: `1px solid ${BRAND.primary}` }}>
                    <thead style={{ backgroundColor: BRAND.light, color: BRAND.primary }}>
                      <tr>
                        <th style={{ width: '32%' }}>Name</th>
                        <th style={{ width: '16%' }}>Criticality</th>
                        <th style={{ width: '16%' }}>Code</th>
                        <th style={{ width: '18%' }}>System</th>
                        <th style={{ width: '18%' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(nosqlData.allergies || [])].sort(byOldest).map((a, i) => (
                        <tr key={i}>
                          <td>{a.name || ''}</td>
                          <td>{a.criticality || ''}</td>
                          <td>{a.code || ''}</td>
                          <td className="text-muted">{a.system || ''}</td>
                          <td>{a.date ? a.date.replace('T', ' ').split('.')[0] : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>
          )}

          {Boolean(nosqlData?.conditions?.length) && (
            <Card className="mb-3">
              <Card.Header style={{ backgroundColor: BRAND.primary, color: 'white', fontWeight: 'bold' }}>Conditions</Card.Header>
              <Card.Body style={{ backgroundColor: BRAND.light, color: BRAND.text }}>
                <div className="table-responsive">
                  <table className="table table-sm table-striped align-middle" style={{ backgroundColor: 'white', border: `1px solid ${BRAND.primary}` }}>
                    <thead style={{ backgroundColor: BRAND.light, color: BRAND.primary }}>
                      <tr>
                        <th style={{ width: '46%' }}>Name</th>
                        <th style={{ width: '18%' }}>Code</th>
                        <th style={{ width: '18%' }}>System</th>
                        <th style={{ width: '18%' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(nosqlData.conditions || [])].sort(byOldest).map((c, i) => (
                        <tr key={i}>
                          <td>{c.name || ''}</td>
                          <td>{c.code || ''}</td>
                          <td className="text-muted">{c.system || ''}</td>
                          <td>{c.date ? c.date.replace('T', ' ').split('.')[0] : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>
          )}

          {Boolean(nosqlData?.observations?.length) && (
            <Card className="mb-3">
              <Card.Header style={{ backgroundColor: BRAND.primary, color: 'white', fontWeight: 'bold' }}>Observations</Card.Header>
              <Card.Body style={{ backgroundColor: BRAND.light, color: BRAND.text }}>
                <div className="table-responsive">
                  <table className="table table-sm table-striped align-middle" style={{ backgroundColor: 'white', border: `1px solid ${BRAND.primary}` }}>
                    <thead style={{ backgroundColor: BRAND.light, color: BRAND.primary }}>
                      <tr>
                        <th style={{ width: '30%' }}>Name</th>
                        <th style={{ width: '22%' }}>Value</th>
                        <th style={{ width: '14%' }}>Code</th>
                        <th style={{ width: '16%' }}>System</th>
                        <th style={{ width: '18%' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(nosqlData.observations || [])].sort(byOldest).map((o, i) => (
                        <tr key={i}>
                          <td>{o.name || ''}</td>
                          <td>{o.value || ''}</td>
                          <td>{o.code || ''}</td>
                          <td className="text-muted">{o.system || ''}</td>
                          <td>{o.date ? o.date.replace('T', ' ').split('.')[0] : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>
          )}

          {Boolean(nosqlData?.immunizations?.length) && (
            <Card className="mb-3">
              <Card.Header style={{ backgroundColor: BRAND.primary, color: 'white', fontWeight: 'bold' }}>
                Immunizations
              </Card.Header>
              <Card.Body style={{ backgroundColor: BRAND.light, color: BRAND.text }}>
                <div className="table-responsive">
                  <table
                    className="table table-sm table-striped align-middle"
                    style={{ backgroundColor: 'white', border: `1px solid ${BRAND.primary}` }}
                  >
                    <thead style={{ backgroundColor: BRAND.light, color: BRAND.primary }}>
                      <tr>
                        <th style={{ width: '44%' }}>Name</th>
                        <th style={{ width: '18%' }}>Date</th>
                        <th style={{ width: '20%' }}>System</th>
                        <th style={{ width: '18%' }}>Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(nosqlData.immunizations || [])].sort(byOldest).map((i, idx) => (
                        <tr key={idx}>
                          <td>{i.name || ''}</td>
                          <td>{i.date ? i.date.replace('T', ' ').split('.')[0] : ''}</td>
                          <td className="text-muted">{i.system || ''}</td>
                          <td>{i.code || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>
          )}

          {Boolean(nosqlData?.procedures?.length) && (
            <Card className="mb-3">
              <Card.Header style={{ backgroundColor: BRAND.primary, color: 'white', fontWeight: 'bold' }}>
                Procedures
              </Card.Header>
              <Card.Body style={{ backgroundColor: BRAND.light, color: BRAND.text }}>
                <div className="table-responsive">
                  <table
                    className="table table-sm table-striped align-middle"
                    style={{ backgroundColor: 'white', border: `1px solid ${BRAND.primary}` }}
                  >
                    <thead style={{ backgroundColor: BRAND.light, color: BRAND.primary }}>
                      <tr>
                        <th style={{ width: '46%' }}>Name</th>
                        <th style={{ width: '18%' }}>System</th>
                        <th style={{ width: '18%' }}>Code</th>
                        <th style={{ width: '18%' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(nosqlData.procedures || [])].sort(byOldest).map((p, idx) => (
                        <tr key={idx}>
                          <td>{p.name || ''}</td>
                          <td className="text-muted">{p.system || ''}</td>
                          <td>{p.code || ''}</td>
                          <td>{p.date ? p.date.replace('T', ' ').split('.')[0] : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>
          )}


        </div>
      ) : (
        <Card>
          <Card.Body>
            <h5>This is the data as simple plain text</h5>
            <p>When displayed in non-proportional font - e.g. courier - then the data will appear aligned as though in a table.</p>
            <p>It will therefore display perfectly if copied and pasted into programs like JChat.</p>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {readableData}
            </pre>
          </Card.Body>
        </Card>
      )}

      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        <Toast
          show={toast.show}
          bg={toast.variant}
          delay={4000}
          autohide
          onClose={() => setToast(t => ({ ...t, show: false }))}
        >
          <Toast.Header>
            <strong className="me-auto">IPS MERN NFC</strong>
          </Toast.Header>
          <Toast.Body className={toast.variant === 'light' ? '' : 'text-white'}>
            {toast.msg}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}
