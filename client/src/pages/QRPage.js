import React, { useState, useEffect, useContext } from 'react';
import QRCode from 'qrcode.react';
import axios from 'axios';
import { Button, Alert, DropdownButton, Dropdown, Form } from 'react-bootstrap';
import './Page.css';
import { PatientContext } from '../PatientContext';
import { useLoading } from '../contexts/LoadingContext';
import pako from 'pako';

function uint8ToBase64(u8) {
  // Avoid call-stack issues by chunking
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < u8.length; i += chunkSize) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function gzipToBase64(str) {
  const gz = pako.gzip(str);              // Uint8Array
  return uint8ToBase64(gz);
}


function QRPage() {
  const { selectedPatients, selectedPatient, setSelectedPatient } = useContext(PatientContext);
  const [qrData, setQRData] = useState('');
  const [mode, setMode] = useState('ipsurl');
  const [showNotification, setShowNotification] = useState(false);
  const [responseSize, setResponseSize] = useState(0);
  const { startLoading, stopLoading } = useLoading();
  const [useCompressionAndEncryption, setUseCompressionAndEncryption] = useState(false);
  const [useIncludeKey, setUseIncludeKey] = useState(false);
  const [useGzipOnly, setUseGzipOnly] = useState(false);




  const handleRecordChange = (recordId) => {
    const record = selectedPatients.find(record => record._id === recordId);
    startLoading();
    setSelectedPatient(record);
  };

  const THRESHOLD = 3000;

  useEffect(() => {
    if (selectedPatient) {
      let endpoint;

      if (mode === 'ipsbeerwithdelim') {
        endpoint = `/ipsbeer/${selectedPatient._id}/pipe`;
      } else {
        endpoint = `/${mode}/${selectedPatient._id}`;
      }

      if (mode === 'ipsurl') {
        const baseUrl = window.location.origin; // Get the base URL of the application
        const url = `${baseUrl}/ips/${selectedPatient.packageUUID}`;
        setQRData(url);
        setResponseSize(url.length);
        setShowNotification(false);
        stopLoading();
      } else {
        const headers = {};

        if (useCompressionAndEncryption) {
          headers['Accept-Extra'] = useIncludeKey ? 'insomzip, base64, includeKey' : 'insomzip, base64';
          headers['Accept-Encryption'] = 'aes256';
        }

        axios.get(endpoint, { headers })
          .then(response => {
            let responseData;

            if (useCompressionAndEncryption) {
              // encrypted response is JSON (or string) from server; don't gzip locally
              responseData = (typeof response.data === 'string') ? response.data : JSON.stringify(response.data);
            } else if (mode === 'ipsminimal' || mode === 'ipsbeer' || mode === 'ipsbeerwithdelim' || mode === 'ipshl72x') {
              responseData = response.data;
            } else {
              responseData = JSON.stringify(response.data);
            }

            if (useGzipOnly) {
              responseData = gzipToBase64(responseData);
            }



            const responseSize = new TextEncoder().encode(responseData).length;
            setResponseSize(responseSize);

            console.log('Response data length:', responseSize);

            if (responseSize > THRESHOLD) {
              setShowNotification(true);
            } else {
              setQRData(responseData);
              console.log('QR Data:', responseData);
              setShowNotification(false);
            }
          })
          .catch(error => {
            console.error('Error fetching IPS record:', error);
          })
          .finally(() => {
            stopLoading();
          });
      }
    }
  }, [selectedPatient, mode, useCompressionAndEncryption, useGzipOnly, useIncludeKey, stopLoading]);


  const handleDownloadQR = () => {
    if (!selectedPatient) return;

    const pad = n => n.toString().padStart(2, '0');

    const getYYYYMMDD = () => {
      const d = new Date();
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    };

    const sanitize = str =>
      str
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

    // 1) date
    const yyyymmdd = getYYYYMMDD();

    // 2) patient pieces
    const {
      packageUUID,
      patient: { name: familyName, given: givenName }
    } = selectedPatient;
    const fam = sanitize(familyName);
    const giv = sanitize(givenName);
    const last6 = packageUUID.slice(-6);

    // 3) flags (_ce for compress+encrypt, _ik for includeKey)
    const flags = [];
    if (mode !== 'ipsurl') {
      if (useGzipOnly) flags.push('gz');
      if (useCompressionAndEncryption) flags.push('ce');
      if (useIncludeKey && useCompressionAndEncryption) flags.push('ik');
    }
    const flagPart = flags.length ? `_${flags.join('_')}` : '';

    // 4) assemble filename
    //    e.g. 20250430-DOE_JENNIFER_38346e_ipsunified_ce_ik.png
    const fileName = `${yyyymmdd}-${fam}_${giv}_${last6}_${mode}${flagPart}.png`;

    // 5) grab canvas and download
    const canvas = document.getElementById('qr-canvas');
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const handleModeChange = (selectedMode) => {
    startLoading();
    setMode(selectedMode);
  };

  const maxQRSize = 600; // QR code canvas Max Size

  const qrSize = Math.min(window.innerWidth * 0.8, window.innerHeight * 0.8, maxQRSize);

  return (
    <div className="app">
      <div className="container">
        {/* <div className="header-container"> */}
        <h3>
          Generate QR Code{mode !== 'ipsurl' ? ` - ${responseSize} bytes` : ''}
        </h3>
        {/* </div> */}
        {selectedPatients.length > 0 && selectedPatient && (
          <>
            {/* --- Top row: patient + mode dropdowns side-by-side --- */}
            <div className="row g-2 mb-2 align-items-center">
              <div className="col-auto">
                <DropdownButton
                  id="dropdown-record"
                  title={`Patient: ${selectedPatient.patient.given} ${selectedPatient.patient.name}`}
                  onSelect={handleRecordChange}
                  size="sm"
                  variant="secondary"
                >
                  {selectedPatients.map(record => (
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
                  title={`Mode: ${mode}`}
                  onSelect={handleModeChange}
                  size="sm"
                  variant="secondary"
                >
                  <Dropdown.Item eventKey="ipsurl">IPS URL</Dropdown.Item>
                  <Dropdown.Item eventKey="nps">NPS JSON Bundle</Dropdown.Item>
                  <Dropdown.Item eventKey="ips">IPS JSON Bundle</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsbasic">IPS Minimal</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsmongo">IPS MongoDB</Dropdown.Item>
                  <Dropdown.Item eventKey="ipslegacy">IPS Legacy JSON Bundle</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsbeer">IPS BEER (newline)</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsbeerwithdelim">IPS BEER with Delimiter (pipe |)</Dropdown.Item>
                  <Dropdown.Item eventKey="ipshl72x">IPS HL7 v2.3</Dropdown.Item>
                </DropdownButton>
              </div>
            </div>

            {/* --- Second row: compact checkbox bar --- */}
            <div className="row g-3 mb-3 align-items-center flex-wrap small">
              <div className="col-auto">
                <Form.Check
                  type="checkbox"
                  id="gzipOnly"
                  label="Compress only (gzip base64)"
                  checked={useGzipOnly}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setUseGzipOnly(checked);
                    if (checked) {
                      setUseCompressionAndEncryption(false);
                      setUseIncludeKey(false);
                    }
                  }}
                />
              </div>

              <div className="col-auto">
                <Form.Check
                  type="checkbox"
                  id="compressionEncryption"
                  label="Gzip + Encrypt (aes256 base64)"
                  checked={useCompressionAndEncryption}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setUseCompressionAndEncryption(checked);
                    if (checked) {
                      setUseGzipOnly(false);
                    } else {
                      setUseIncludeKey(false);
                    }
                  }}
                />
              </div>

              <div className="col-auto">
                <Form.Check
                  type="checkbox"
                  id="includeKey"
                  label="Include key in response"
                  checked={useIncludeKey}
                  disabled={!useCompressionAndEncryption}
                  onChange={(e) => setUseIncludeKey(e.target.checked)}
                />
              </div>
            </div>
          </>
        )}
        {showNotification ? (
          <Alert variant="danger">
            Data is too large to display
            {useCompressionAndEncryption
              ? ", even with compression, please try a different mode."
              : ". Please try a different mode, or enable compression and encryption."}
          </Alert>
        ) : (
          <div className="qr-container">
            <QRCode id="qr-canvas" value={qrData} size={qrSize} />
          </div>
        )}
        <br />
        <div className="button-container">
          <Button className="mb-3" onClick={handleDownloadQR}>Download QR Code</Button>
        </div>
      </div>
    </div>
  );
}

export default QRPage;