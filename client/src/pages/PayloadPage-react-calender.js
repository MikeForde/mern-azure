// import React, { useEffect, useState, useCallback } from 'react';
// import { useSearchParams } from 'react-router-dom';
// import pako from 'pako';
// import axios from 'axios';
// import { Button, Toast, ToastContainer, Alert, Card, Spinner } from 'react-bootstrap';
// import Timeline from 'react-calendar-timeline';
// import 'react-calendar-timeline/lib/Timeline.css';
// import { generatePDF } from './Components/generatePDF';

// export default function PayloadPage() {
//   const [searchParams] = useSearchParams();
//   const [jsonData, setJsonData] = useState(null);
//   const [readableData, setReadableData] = useState('');
//   const [nosqlData, setNosqlData] = useState(null);
//   const [viewMode, setViewMode] = useState('readable'); // 'readable', 'nosql', 'timeline'
//   const [items, setItems] = useState([]);
//   const [groups, setGroups] = useState([]);
//   const [visibleTimeStart, setVisibleTimeStart] = useState(null);
//   const [visibleTimeEnd, setVisibleTimeEnd] = useState(null);
//   const [selectedItem, setSelectedItem] = useState(null);
//   const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
//   const [error, setError] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [operation, setOperation] = useState(null);
//   const [toast, setToast] = useState({ show: false, msg: '', variant: 'info' });

//   const toStandardBase64 = (b64) =>
//     b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(b64.length + (4 - b64.length % 4) % 4, '=');

//   useEffect(() => {
//     const onResize = () => setIsMobile(window.innerWidth < 768);
//     window.addEventListener('resize', onResize);
//     return () => window.removeEventListener('resize', onResize);
//   }, []);

//   useEffect(() => {
//     async function decodeAndPrepare() {
//       try {
//         const b64 = searchParams.get('d');
//         if (!b64) throw new Error('No data found in URL.');
//         const std = toStandardBase64(b64);
//         const bytes = Uint8Array.from(atob(std), c => c.charCodeAt(0));
//         const text = pako.ungzip(bytes, { to: 'string' });
//         if (/^\{/.test(text) && text.includes('"resourceType"') && text.includes('Bundle')) {
//           const parsed = JSON.parse(text);
//           setJsonData(parsed);
//           const resp = await axios.post('/convertips2plaintext', parsed, { headers: { 'Content-Type': 'application/json' }, responseType: 'text' });
//           setReadableData(resp.data);
//         } else {
//           setReadableData(text);
//         }
//       } catch (err) {
//         console.error(err);
//         setError(err.message);
//       } finally {
//         setLoading(false);
//       }
//     }
//     decodeAndPrepare();
//   }, [searchParams]);

//   useEffect(() => {
//     if (!jsonData) return;
//     const entries = jsonData.entry || [];
//     const typeSet = new Set();
//     const tmpItems = entries
//       .filter(e => e.resource && e.resource.effectiveDateTime)
//       .map((e, idx) => {
//         const { resourceType, effectiveDateTime, code } = e.resource;
//         typeSet.add(resourceType);
//         const time = new Date(effectiveDateTime).getTime();
//         return {
//           id: idx + 1,
//           group: resourceType,
//           title: code?.text || resourceType,
//           start_time: time,
//           end_time: time + 1000 * 60
//         };
//       });
//     const tmpGroups = Array.from(typeSet).map(type => ({ id: type, title: type }));
//     setItems(tmpItems);
//     setGroups(tmpGroups);
//     if (tmpItems.length) {
//       const times = tmpItems.map(i => i.start_time);
//       const minT = Math.min(...times);
//       const maxT = Math.max(...times);
//       const padding = (maxT - minT) * 0.1;
//       setVisibleTimeStart(minT - padding);
//       setVisibleTimeEnd(maxT + padding);
//     }
//   }, [jsonData]);

//   const showToast = (msg, variant = 'info') => setToast({ show: true, msg, variant });

//   const zoom = useCallback((factor) => {
//     if (visibleTimeStart == null || visibleTimeEnd == null) return;
//     const center = (visibleTimeStart + visibleTimeEnd) / 2;
//     const span = (visibleTimeEnd - visibleTimeStart) * factor;
//     setVisibleTimeStart(Math.round(center - span / 2));
//     setVisibleTimeEnd(Math.round(center + span / 2));
//   }, [visibleTimeStart, visibleTimeEnd]);

//   const fetchNoSQL = async () => {
//     if (!jsonData) throw new Error('No JSON bundle to convert');
//     const resp = await axios.post('/convertips2mongo', jsonData, { headers: { 'Content-Type': 'application/json' } });
//     return resp.data;
//   };

//   const handleToggleNoSQL = async () => {
//     if (viewMode !== 'nosql') {
//       if (nosqlData) {
//         setViewMode('nosql');
//       } else {
//         setOperation('NoSQL');
//         try {
//           const data = await fetchNoSQL();
//           setNosqlData(data);
//           setViewMode('nosql');
//           showToast('Converted to NoSQL', 'success');
//         } catch (err) {
//           showToast(`Conversion failed: ${err.message}`, 'danger');
//         } finally {
//           setOperation(null);
//         }
//       }
//     } else {
//       setViewMode('readable');
//     }
//   };

//   const handleImport = async () => {
//     setOperation('import');
//     try {
//       if (!jsonData) throw new Error('Nothing to import');
//       await axios.post('/ipsbundle', jsonData, { headers: { 'Content-Type': 'application/json' } });
//       showToast('Import successful', 'success');
//     } catch (err) {
//       showToast(`Import failed: ${err.message}`, 'danger');
//     } finally {
//       setOperation(null);
//     }
//   };

//   const handleExportFHIR = async () => {
//     setOperation('ExportFHIR');
//     try {
//       const data = nosqlData || await fetchNoSQL();
//       setNosqlData(data);
//       const now = new Date(); const pad = n => n.toString().padStart(2, '0');
//       const yyyymmdd = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
//       const { packageUUID, patient: { name: familyName, given: givenName } } = data;
//       const sanitize = str => str.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase()
//         .replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
//       const fam = sanitize(familyName);
//       const giv = sanitize(givenName);
//       const last6 = packageUUID.slice(-6);
//       const fileName = `${yyyymmdd}-${fam}_${giv}_${last6}_fhir.json`;
//       const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
//       const url = URL.createObjectURL(blob);
//       const a = document.createElement('a'); a.href = url; a.download = fileName;
//       document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
//       setViewMode('readable');
//       showToast('FHIR download initiated', 'success');
//     } catch (err) {
//       showToast(`Download failed: ${err.message}`, 'danger');
//     } finally {
//       setOperation(null);
//     }
//   };

//   const handleExportPDF = async () => {
//     setOperation('ExportPDF');
//     try {
//       const data = nosqlData || await fetchNoSQL();
//       setNosqlData(data);
//       await generatePDF(data);
//       setViewMode('readable');
//       showToast('PDF export initiated', 'success');
//     } catch (err) {
//       showToast(`PDF export failed: ${err.message}`, 'danger');
//     } finally {
//       setOperation(null);
//     }
//   };

//   const handleViewTimeline = () => {
//     setSelectedItem(null);
//     setViewMode(vm => (vm === 'timeline' ? 'readable' : 'timeline'));
//   };

//   return (
//     <div className="container mt-4">
//       <h4>CWIX Payload Viewer</h4>
//       <Alert variant="info">
//         This site displays the data on the NFC card presented. It can be exported to various formats for import into an electronic health record. No data is held on this website.
//       </Alert>
//       <div className="mb-3 d-flex flex-wrap align-items-center">
//         <Button variant="secondary" onClick={handleViewTimeline} className="me-2 mb-2">
//           {viewMode === 'timeline' ? 'Show Text' : 'Show Timeline'}
//         </Button>
//         {viewMode === 'timeline' && (
//           <>
//             <Button variant="outline-primary" onClick={() => zoom(0.5)} className="me-2 mb-2">Zoom In</Button>
//             <Button variant="outline-primary" onClick={() => zoom(2)} className="me-2 mb-2">Zoom Out</Button>
//           </>
//         )}
//         <Button variant="success" onClick={handleImport} disabled={!!operation} className="me-2 mb-2">
//           {operation === 'import' ? <Spinner animation="border" size="sm" /> : 'Import'}
//         </Button>
//         <Button variant="secondary" onClick={handleToggleNoSQL} disabled={!!operation} className="me-2 mb-2">
//           {operation === 'NoSQL'
//             ? <Spinner animation="border" size="sm" />
//             : viewMode === 'nosql' ? 'Readable' : 'NoSQL'}
//         </Button>
//         <Button variant="primary" onClick={handleExportFHIR} disabled={!jsonData || !!operation} className="me-2 mb-2">
//           {operation === 'ExportFHIR' ? <Spinner animation="border" size="sm" /> : 'Export FHIR'}
//         </Button>
//         <Button variant="dark" onClick={handleExportPDF} disabled={!jsonData || !!operation} className="mb-2">
//           {operation === 'ExportPDF' ? <Spinner animation="border" size="sm" /> : 'Export PDF'}
//         </Button>
//       </div>

//       {loading ? (
//         <div>Loading...</div>
//       ) : error ? (
//         <Alert variant="danger">{error}</Alert>
//       ) : viewMode === 'timeline' ? (
//         <Card>
//           <Card.Body style={{ overflowX: 'auto', padding: 0 }}>
//             <div style={{ width: '100%', height: isMobile ? '60vh' : '80vh' }}>
//               <Timeline
//                 groups={groups}
//                 items={items}
//                 visibleTimeStart={visibleTimeStart}
//                 visibleTimeEnd={visibleTimeEnd}
//                 onTimeChange={(start, end) => { setVisibleTimeStart(start); setVisibleTimeEnd(end); }}
//                 onItemSelect={id => setSelectedItem(items.find(i => i.id === id))}
//                 onCanvasClick={() => setSelectedItem(null)}
//                 canMove={false}
//                 canResize={false}
//                 sidebarWidth={isMobile ? 80 : 150}
//                 lineHeight={isMobile ? 40 : 70}
//                 itemHeightRatio={isMobile ? 0.9 : 1.0}
//               />
//             </div>
//             {selectedItem && (
//               <Card className="mt-2">
//                 <Card.Body>
//                   <h6>{selectedItem.title}</h6>
//                   <div>{new Date(selectedItem.start_time).toLocaleString()}</div>
//                   <pre style={{ whiteSpace: 'pre-wrap' }}>
//                     {JSON.stringify(
//                       jsonData.entry.find((_, idx) => idx + 1 === selectedItem.id).resource,
//                       null,
//                       2
//                     )}
//                   </pre>
//                 </Card.Body>
//               </Card>
//             )}
//           </Card.Body>
//         </Card>
//       ) : viewMode === 'nosql' ? (
//         <Card>
//           <Card.Body>
//             <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(nosqlData, null, 2)}</pre>
//           </Card.Body>
//         </Card>
//       ) : (
//         <Card>
//           <Card.Body>
//             <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{readableData}</pre>
//           </Card.Body>
//         </Card>
//       )}

//       <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
//         <Toast show={toast.show} bg={toast.variant} delay={4000} autohide onClose={() => setToast(t => ({ ...t, show: false }))}>
//           <Toast.Header><strong className="me-auto">IPS MERN NFC</strong></Toast.Header>
//           <Toast.Body className={toast.variant !== 'light' ? 'text-white' : ''}>{toast.msg}</Toast.Body>
//         </Toast>
//       </ToastContainer>
//     </div>
//   );
// }
