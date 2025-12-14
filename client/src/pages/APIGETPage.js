import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Button, Alert, Form, DropdownButton, Dropdown, Toast, ToastContainer } from 'react-bootstrap';
import './Page.css';
import { PatientContext } from '../PatientContext';
import { useLoading } from '../contexts/LoadingContext';
import pako from 'pako';

function APIGETPage() {
  const { selectedPatients, selectedPatient, setSelectedPatient } = useContext(PatientContext);
  const { startLoading, stopLoading } = useLoading();
  const [data, setData] = useState('');
  const [mode, setMode] = useState('ipsunified');
  const [modeText, setModeText] = useState('NPS JSON Bundle - /ipsunified/:id');
  const [showNotification, setShowNotification] = useState(false);
  const [responseSize, setResponseSize] = useState(0);
  const [useCompressionAndEncryption, setUseCompressionAndEncryption] = useState(false);
  const [useIncludeKey, setUseIncludeKey] = useState(false);
  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVariant, setToastVariant] = useState('info');
  const [isWriting, setIsWriting] = useState(false);
  const [useFieldEncrypt, setUseFieldEncrypt] = useState(false); // => protect=1 (JWE)
  const [useIdOmit, setUseIdOmit] = useState(false);             // => protect=2 (omit)
  // const [useBinary, setUseBinary] = useState(false);



  const handleRecordChange = (recordId) => {
    const record = selectedPatients.find((record) => record._id === recordId);
    startLoading();
    setSelectedPatient(record);
  };

  useEffect(() => {
    if (selectedPatient) {
      const fetchData = async () => {
        let endpoint;
        if (mode === 'ipsbeerwithdelim') {
          endpoint = `/ipsbeer/${selectedPatient._id}/pipe`;
        } else {
          endpoint = `/${mode}/${selectedPatient._id}`;
        }

        // add protect flag for ipsunified only
        if (mode === 'ipsunified') {
          if (useFieldEncrypt) {
            endpoint += (endpoint.includes('?') ? '&' : '?') + 'protect=1';
          } else if (useIdOmit) {
            endpoint += (endpoint.includes('?') ? '&' : '?') + 'protect=2';
          }
        }

        console.log('Fetching data from:', endpoint);
        try {
          const headers = {};
          if (useCompressionAndEncryption) {
            headers['Accept-Extra'] = 'insomzip, base64';
            headers['Accept-Encryption'] = 'aes256';
            if (useIncludeKey) {
              headers['Accept-Extra'] = 'insomzip, base64, includeKey';
            }
          }

          const response = await axios.get(endpoint, { headers });
          let responseData;

          if (useCompressionAndEncryption) {
            setResponseSize(JSON.stringify(response.data).length);
            responseData = JSON.stringify(response.data, null, 2);
          } else if (mode === 'ipsbasic' || mode === 'ipsbeer' || mode === 'ipsbeerwithdelim' || mode === 'ipshl72x' || mode === 'ipsplaintext') {
            responseData = response.data;
            setResponseSize(responseData.length);
          } else if (mode === 'ipsxml') {
            responseData = formatXML(response.data);
            setResponseSize(responseData.length);
          } else {
            setResponseSize(JSON.stringify(response.data).length);
            responseData = JSON.stringify(response.data, null, 2);
          }

          setData(responseData);
          console.log('Data:', responseData);
          setShowNotification(false);
        } catch (error) {
          console.error('Error fetching IPS record:', error);
        } finally {
          stopLoading();
        }
      };

      fetchData();
    }
  }, [selectedPatient, mode, useCompressionAndEncryption, stopLoading, startLoading, useIncludeKey, useFieldEncrypt, useIdOmit]);

  const handleDownloadData = () => {
    if (!selectedPatient) return;

    // 1) Format today as YYYYMMDD
    const today = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const yyyymmdd = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;

    // 2) Pull patient info
    const { packageUUID, patient: { name: familyName, given: givenName } } = selectedPatient;

    console.log('Patient:', selectedPatient);

    // 3) Decide extension & MIME type
    let extension, mimeType;
    if (useCompressionAndEncryption) {
      extension = 'json';
      mimeType = 'application/json';
    } else if (mode === 'ipsxml') {
      extension = 'xml';
      mimeType = 'application/xml';
    } else if (
      ['ipsbasic', 'ipsbeer', 'ipsbeerwithdelim', 'ipshl72x', 'ipsplaintext'].includes(mode)
    ) {
      extension = 'txt';
      mimeType = 'text/plain';
    } else {
      extension = 'json';
      mimeType = 'application/json';
    }

    // 4) Build filename: date-FAMILY_GIVEN_last6_apitype.ext
    const sanitize = str =>
      str
        .normalize('NFKD')                   // strip accents
        .replace(/[\u0300-\u036f]/g, '')     // remove remaining diacritics
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')          // only allow A–Z,0–9 → underscore
        .replace(/_+/g, '_')                 // collapse repeats
        .replace(/^_|_$/g, '');              // trim leading/trailing underscores

    const fam = sanitize(familyName);
    const giv = sanitize(givenName);
    const last6 = packageUUID.slice(-6);
    // 4) Suffix for GE
    const ikSuffix = useIncludeKey && useCompressionAndEncryption ? '_ik' : '';
    const ceSuffix = useCompressionAndEncryption ? '_ce' : '';
    const pmSuffix = mode === 'ipsunified' ? useFieldEncrypt ? '_jwefld' : (useIdOmit ? '_omit' : '') : '';
    const fileName = `${yyyymmdd}-${fam}_${giv}_${last6}_${mode}${pmSuffix}${ceSuffix}${ikSuffix}.${extension}`;

    // 5) Create & click the download link
    const blob = new Blob([data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };


  const handleModeChange = (selectedMode) => {
    startLoading();
    setMode(selectedMode);
    switch (selectedMode) {
      case 'ips':
        setModeText('IPS JSON Bundle - /ips/:id or /ipsbyname/:name/:given');
        break;
      case 'ipsxml':
        setModeText('IPS XML Bundle - /ipsxml/:id');
        break;
      case 'ipslegacy':
        setModeText('NPS Legacy JSON Bundle - /ipslegacy/:id');
        break;
      case 'ipsunified':
        setModeText('NPS JSON Bundle - /ipsunified/:id');
        break;
      case 'ipsmongo':
        setModeText('IPS NoSQL - /ipsmongo/:id');
        break;
      case 'ipsbasic':
        setModeText('IPS Minimal - /ipsbasic/:id');
        break;
      case 'ipsbeer':
        setModeText('IPS BEER - /ipsbeer/:id');
        break;
      case 'ipsbeerwithdelim':
        setModeText('IPS BEER - /ipsbeer/:id/pipe)');
        break;
      case 'ipshl72x':
        setModeText('IPS HL7 2.x - /ipshl72x/:id');
        break;
      case 'ipsplaintext':
        setModeText('IPS Plain Text - /ipsplaintext/:id');
        break;
      default:
        setModeText('NPS JSON Bundle - /ipsunified/:id');
    }
  };

  const formatXML = (xml) => {
    const formatted = xml.replace(/></g, '>\n<');
    return formatted;
  };

  const handleNfcWriteMode = async (nfctype) => {
    try {
      if (nfctype === 'copyurl') {
        // Dev only: copy gzipped data URL to clipboard
        const gzipped = pako.gzip(data);
        const base64 = btoa(String.fromCharCode(...gzipped))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const url = `${window.location.origin}/cwix/payload?d=${base64}`;
        await navigator.clipboard.writeText(url);
        setToastMsg('Gzipped data URL copied to clipboard!');
        setToastVariant('success');
        setShowToast(true);
        return;
      }

      if (!('NDEFReader' in window)) {
        setToastMsg('Web NFC not supported on this device/browser.');
        setToastVariant('warning');
        setShowToast(true);
        return;
      }
      setIsWriting(true);
      const writer = new window.NDEFReader();
      if (nfctype === 'plain') {
        await writer.write(data);
      } else if (nfctype === 'binary') {
        const resp = await axios.get(
          `/${mode}/${selectedPatient._id}`, { headers: { Accept: 'application/octet-stream' }, responseType: 'arraybuffer' }
        );
        await writer.write({ records: [{ recordType: 'mime', mediaType: 'application/x.ips.gzip.aes256.v1-0', data: new Uint8Array(resp.data) }] });
      } else if (nfctype === 'gzipbin') {
        // Gzip the visible text and write as a binary MIME record (no encryption)
        const gzipped = pako.gzip(data); // Uint8Array
        await writer.write({
          records: [{
            recordType: 'mime',
            mediaType: 'application/x.ips.gzip.v1-0', // custom; use 'application/gzip' if you prefer
            data: gzipped
          }]
        });
      } else if (nfctype === 'url') {
        const gzipped = pako.gzip(data);
        const base64 = btoa(String.fromCharCode(...gzipped))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const url = `${window.location.origin}/cwix/payload?d=${base64}`;
        await writer.write({ records: [{ recordType: 'url', data: url }] });
      }
      setToastMsg(`NFC write success (${nfctype})!`);
      setToastVariant('success');
    } catch (err) {
      console.error(err);
      setToastMsg(`NFC write failed: ${err.message}`);
      setToastVariant('danger');
    } finally {
      setIsWriting(false);
      setShowToast(true);
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h3>
          API GET - IPS Data: {responseSize}
        </h3>
        {selectedPatients.length > 0 && selectedPatient && (
          <>
            {/* --- Top row: patient + API dropdowns side-by-side --- */}
            <div className="row g-2 mb-2 align-items-center">
              <div className="col-auto">
                <DropdownButton
                  id="dropdown-record"
                  title={`Patient: ${selectedPatient.patient.given} ${selectedPatient.patient.name}`}
                  onSelect={handleRecordChange}
                  size="sm"
                  variant="secondary"
                >
                  {selectedPatients.map((record) => (
                    <Dropdown.Item
                      key={record._id}
                      eventKey={record._id}
                      active={selectedPatient && selectedPatient._id === record._id}
                    >
                      {record.patient.given} {record.patient.name}
                    </Dropdown.Item>
                  ))}
                </DropdownButton>
              </div>

              <div className="col-auto">
                <DropdownButton
                  id="dropdown-mode"
                  title={`API: ${modeText}`}
                  onSelect={handleModeChange}
                  size="sm"
                  variant="secondary"
                >
                  <Dropdown.Item eventKey="ipsunified">NPS JSON Bundle - /ipsunified/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipshl72x">IPS HL7 2.3 - /ipshl72x/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsmongo">IPS NoSQL - /ipsmongo/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsbeer">IPS BEER - /ipsbeer/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsbeerwithdelim">IPS BEER - /ipsbeer/:id/pipe</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsbasic">IPS Minimal - /ipsbasic/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ips">IPS JSON Bundle - /ips/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsxml">IPS XML Bundle - /ipsxml/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipslegacy">NPS Legacy JSON Bundle - /ipslegacy/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsplaintext">IPS Plain Text - /ipsplaintext/:id</Dropdown.Item>
                </DropdownButton>
              </div>
            </div>

            {/* --- Second row: compact checkbox bar --- */}
            <div className="row g-3 mb-3 align-items-center flex-wrap small">
              <div className="col-auto">
                <Form.Check
                  type="checkbox"
                  id="compressionEncryption"
                  label="Gzip + Encrypt (aes256 base64)"
                  checked={useCompressionAndEncryption}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setUseCompressionAndEncryption(v);
                  }}
                />
              </div>

              <div className="col-auto">
                <Form.Check
                  type="checkbox"
                  id="includeKey"
                  label="Include key in response"
                  checked={useIncludeKey}
                  onChange={(e) => setUseIncludeKey(e.target.checked)}
                />
              </div>

              <div className="col-auto">
                <Form.Check
                  type="checkbox"
                  id="fldEnc"
                  label="Field-Level Id Encrypt"
                  disabled={mode !== 'ipsunified'}
                  checked={useFieldEncrypt}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setUseFieldEncrypt(v);
                    if (v) setUseIdOmit(false);
                  }}
                />
              </div>

              <div className="col-auto">
                <Form.Check
                  type="checkbox"
                  id="idOmit"
                  label="Id Omit"
                  disabled={mode !== 'ipsunified'}
                  checked={useIdOmit}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setUseIdOmit(v);
                    if (v) setUseFieldEncrypt(false);
                  }}
                />
              </div>
            </div>
          </>
        )}
        {showNotification ? (
          <Alert variant="danger">Data is too large to display. Please try a different mode.</Alert>
        ) : (
          <div className="text-area">
            <Form.Control
              as="textarea"
              rows={10}
              value={data}
              readOnly
              className="resultTextArea"
            />
          </div>
        )}
        <br />
        <div className="container">
          <div className="row mb-3 align-items-start">
            <div className="col-auto">
              <Button onClick={handleDownloadData} disabled={!data}>
                Download Data
              </Button>
            </div>

            {mode === 'ips' && (
              <div className="col-auto">
                <Button
                  variant="primary"
                  onClick={() => window.open('https://ipsviewer.com', '_blank')}
                  disabled={!data}
                >
                  Open IPS Viewer
                </Button>
              </div>
            )}

            <div className="col-auto">
              <DropdownButton
                variant={isWriting ? 'dark' : 'primary'}
                title={isWriting ? 'Writing...' : 'Write to NFC'}
                disabled={!data || isWriting}
                onSelect={handleNfcWriteMode}
              >
                <Dropdown.Item eventKey="plain">As Shown Above</Dropdown.Item>
                <Dropdown.Item eventKey="binary">Binary (AES256 + gzip) - regardless to above</Dropdown.Item>
                <Dropdown.Item eventKey="gzipbin">Gzip (as shown)</Dropdown.Item>
                <Dropdown.Item eventKey="url">Gzipped Data URL</Dropdown.Item>
                <Dropdown.Item eventKey="copyurl">Gzipped Data URL - CopyPaste Buffer Only</Dropdown.Item>
              </DropdownButton>
            </div>
          </div>
        </div>

      </div>
      {/* Floating Toast, just like in IPS.js */}
      <ToastContainer
        position="bottom-end"
        className="p-3"
        style={{ zIndex: 9999 }}
      >
        <Toast
          onClose={() => setShowToast(false)}
          show={showToast}
          bg={toastVariant}
          delay={4000}
          autohide
        >
          <Toast.Header>
            <strong className="me-auto">IPS MERN NFC</strong>
          </Toast.Header>
          <Toast.Body className={toastVariant === 'light' ? '' : 'text-white'}>
            {toastMsg}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}

export default APIGETPage;
