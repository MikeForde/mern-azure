import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import QRCode from 'qrcode.react';
import axios from 'axios';
import { Button, Alert, DropdownButton, Dropdown } from 'react-bootstrap';
import './Page.css';
import { PatientContext } from '../PatientContext';
import { useLoading } from '../contexts/LoadingContext';

// Kotlin constants mirrored
const QR_PACKET_METADATA_SIZE = 4;

// Mirror your Kotlin enum “conservative” capacities
const EC_LEVELS = {
  L: { label: 'L (max capacity)', maxByteContent: 251 },
  M: { label: 'M', maxByteContent: 213 },
  Q: { label: 'Q', maxByteContent: 88 },
  H: { label: 'H (most robust)', maxByteContent: 68 },
};

// --- UTF-8 safe chunking, equivalent to your Kotlin approach ---
function calculateAnimatedQrChunks(input, maxByteContent) {
  const bytes = new TextEncoder().encode(input);

  const maxIndividualQRPacketSize = maxByteContent - QR_PACKET_METADATA_SIZE;
  const chunkSize = maxIndividualQRPacketSize > 0 ? Math.floor(maxIndividualQRPacketSize / 2) : 0;

  if (chunkSize <= 0) return [];

  const out = [];
  let offset = 0;

  while (offset < bytes.length) {
    let end = Math.min(offset + chunkSize, bytes.length);

    // Avoid cutting a multibyte UTF-8 codepoint (continuation bytes are 10xxxxxx)
    while (end < bytes.length && (bytes[end] & 0b11000000) === 0b10000000) {
      end--;
    }

    // Defensive fallback if we backed up too far (should be rare)
    if (end <= offset) {
      end = Math.min(offset + 1, bytes.length);
    }

    const slice = bytes.slice(offset, end);
    out.push(new TextDecoder('utf-8', { fatal: false }).decode(slice));
    offset = end;
  }

  return out;
}

function randomSessionId() {
  // short, URL-safe-ish session id
  return Math.random().toString(36).slice(2, 10);
}

function AnimatedQRPage() {
  const { selectedPatients, selectedPatient, setSelectedPatient } = useContext(PatientContext);

  const [payload, setPayload] = useState(''); // the full payload to transmit
  const [mode, setMode] = useState('ipsurl');
  const [responseSize, setResponseSize] = useState(0);

  const { startLoading, stopLoading } = useLoading();

  const [useCompressionAndEncryption, setUseCompressionAndEncryption] = useState(false);
  const [useIncludeKey, setUseIncludeKey] = useState(false);

  // Animation / chunking controls
  const [ecLevel, setEcLevel] = useState('M');
  const [fps, setFps] = useState(10);
  const [isPlaying, setIsPlaying] = useState(true);

  // Session id changes when payload changes (so receiver can distinguish streams)
  const sessionIdRef = useRef(randomSessionId());

  const handleRecordChange = (recordId) => {
    const record = selectedPatients.find(record => record._id === recordId);
    startLoading();
    setSelectedPatient(record);
  };

  const handleModeChange = (selectedMode) => {
    startLoading();
    setMode(selectedMode);
  };

  // Fetch/build payload exactly like QRPage does (but we won’t reject large payloads)
  useEffect(() => {
    if (!selectedPatient) return;

    let endpoint;
    if (mode === 'ipsbeerwithdelim') {
      endpoint = `/ipsbeer/${selectedPatient._id}/pipe`;
    } else {
      endpoint = `/${mode}/${selectedPatient._id}`;
    }

    if (mode === 'ipsurl') {
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/ips/${selectedPatient.packageUUID}`;
      setPayload(url);
      setResponseSize(new TextEncoder().encode(url).length);
      sessionIdRef.current = randomSessionId();
      stopLoading();
      return;
    }

    const headers = {};
    if (useCompressionAndEncryption) {
      headers['Accept-Extra'] = useIncludeKey ? 'insomzip, base64, includeKey' : 'insomzip, base64';
      headers['Accept-Encryption'] = 'aes256';
    }

    axios.get(endpoint, { headers })
      .then(response => {
        let responseData;

        if (useCompressionAndEncryption) {
          responseData = JSON.stringify(response.data);
        } else if (mode === 'ipsminimal' || mode === 'ipsbeer' || mode === 'ipsbeerwithdelim' || mode === 'ipshl72x') {
          responseData = response.data;
        } else {
          responseData = JSON.stringify(response.data);
        }

        const size = new TextEncoder().encode(responseData).length;
        setResponseSize(size);
        setPayload(responseData);
        sessionIdRef.current = randomSessionId();
      })
      .catch(error => {
        console.error('Error fetching IPS record:', error);
        setPayload('');
        setResponseSize(0);
      })
      .finally(() => stopLoading());
  }, [selectedPatient, mode, useCompressionAndEncryption, useIncludeKey, stopLoading]);

  // If compression is off, force includeKey off (matches UI intent)
  useEffect(() => {
    if (!useCompressionAndEncryption && useIncludeKey) setUseIncludeKey(false);
  }, [useCompressionAndEncryption, useIncludeKey]);

  // Build frames (chunks + metadata wrapper)
  const frames = useMemo(() => {
    if (!payload) return [];

    // For URL mode, just one frame (still wrapped for consistency)
    const maxByteContent = EC_LEVELS[ecLevel]?.maxByteContent ?? EC_LEVELS.M.maxByteContent;

    const chunks = calculateAnimatedQrChunks(payload, maxByteContent);

    // If chunking produced nothing but payload exists, fall back to single frame
    const safeChunks = (chunks.length > 0) ? chunks : [payload];

    const n = safeChunks.length;
    const s = sessionIdRef.current;

    // Minimal metadata for future reassembly:
    // s = session, i = index, n = total, m = mime type, p = payload chunk
    // NOTE: mime is a placeholder until you decide your exact types
    const mime =
      mode === 'ipsurl'
        ? 'text/uri-list'
        : 'application/x.ips.v1-0';

    return safeChunks.map((chunk, i) =>
      JSON.stringify({ s, i, n, m: mime, p: chunk })
    );
  }, [payload, ecLevel, mode]);

  // Animation index
  const [frameIndex, setFrameIndex] = useState(0);

  // Reset frame index when frames change
  useEffect(() => {
    setFrameIndex(0);
  }, [frames.length, ecLevel, payload]);

  // Drive the animation
  useEffect(() => {
    if (!isPlaying) return;
    if (frames.length <= 1) return;

    const intervalMs = Math.max(50, Math.floor(1000 / Math.max(1, fps)));
    const t = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, intervalMs);

    return () => clearInterval(t);
  }, [isPlaying, frames.length, fps]);

  const currentValue = frames.length ? frames[frameIndex] : '';

  const maxQRSize = 600;
  const qrSize = Math.min(window.innerWidth * 0.8, window.innerHeight * 0.8, maxQRSize);

  const showTooBigWarning = frames.length > 1 && ecLevel === 'H';

  const handleDownloadQR = () => {
    // Download ONLY the currently displayed frame (same behaviour as your static page)
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

    const yyyymmdd = getYYYYMMDD();

    if (!selectedPatient) return;

    const {
      packageUUID,
      patient: { name: familyName, given: givenName }
    } = selectedPatient;

    const fam = sanitize(familyName);
    const giv = sanitize(givenName);
    const last6 = packageUUID.slice(-6);

    const flags = [];
    if (mode !== 'ipsurl') {
      if (useCompressionAndEncryption) flags.push('ce');
      if (useIncludeKey && useCompressionAndEncryption) flags.push('ik');
    }
    flags.push(`ec${ecLevel.toLowerCase()}`);
    flags.push(`f${fps}`);

    const flagPart = flags.length ? `_${flags.join('_')}` : '';
    const idxPart = frames.length > 1 ? `_frame${String(frameIndex + 1).padStart(3, '0')}of${String(frames.length).padStart(3, '0')}` : '';

    const fileName = `${yyyymmdd}-${fam}_${giv}_${last6}_${mode}${flagPart}${idxPart}.png`;

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

  return (
    <div className="app">
      <div className="container">
        <h3>
          Generate Animated QR Code
          {mode !== 'ipsurl' && (
            <span className="response-size"> - {responseSize} bytes</span>
          )}
        </h3>

        {selectedPatients.length > 0 && selectedPatient && <>
          <div className="dropdown-container">
            <DropdownButton
              id="dropdown-record"
              title={`Patient: ${selectedPatient.patient.given} ${selectedPatient.patient.name}`}
              onSelect={handleRecordChange}
              className="dropdown-button"
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

          <div className="dropdown-container">
            <DropdownButton
              id="dropdown-mode"
              title={`Mode: ${mode}`}
              onSelect={handleModeChange}
              className="dropdown-button"
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

          <div className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id="compressionEncryption"
              checked={useCompressionAndEncryption}
              onChange={(e) => setUseCompressionAndEncryption(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="compressionEncryption">
              Compress (gzip) and Encrypt (aes256 base 64)
            </label>
          </div>

          <div className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id="includeKey"
              checked={useIncludeKey}
              disabled={!useCompressionAndEncryption}
              onChange={(e) => setUseIncludeKey(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="includeKey">
              Include key in response
            </label>
          </div>

          {/* Chunking / animation controls */}
          <div className="dropdown-container" style={{ marginTop: 10 }}>
            <DropdownButton
              id="dropdown-ec"
              title={`EC Level: ${ecLevel} - ${EC_LEVELS[ecLevel].label}`}
              onSelect={(lvl) => setEcLevel(lvl)}
              className="dropdown-button"
            >
              {Object.keys(EC_LEVELS).map((lvl) => (
                <Dropdown.Item key={lvl} eventKey={lvl} active={ecLevel === lvl}>
                  {lvl} - {EC_LEVELS[lvl].label}
                </Dropdown.Item>
              ))}
            </DropdownButton>
          </div>

          <div className="form-check" style={{ marginTop: 10 }}>
            <label className="form-check-label" htmlFor="fpsRange" style={{ display: 'block' }}>
              Frame rate: {fps} fps
            </label>
            <input
              id="fpsRange"
              type="range"
              min="1"
              max="20"
              value={fps}
              onChange={(e) => setFps(parseInt(e.target.value, 10))}
              style={{ width: '100%' }}
            />
          </div>

          <div className="button-container" style={{ marginTop: 10 }}>
            <Button
              variant={isPlaying ? 'secondary' : 'primary'}
              onClick={() => setIsPlaying((p) => !p)}
              disabled={frames.length <= 1}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
          </div>
        </>}

        {showTooBigWarning && (
          <Alert variant="warning" style={{ marginTop: 10 }}>
            Lots of frames at EC=H is expected (small per-frame capacity). Consider EC=M or EC=Q.
          </Alert>
        )}

        {!currentValue ? (
          <Alert variant="info" style={{ marginTop: 10 }}>
            Select a patient to generate an animated QR.
          </Alert>
        ) : (
          <>
            <div className="qr-container">
              <QRCode id="qr-canvas" value={currentValue} size={qrSize} />
            </div>

            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <div>
                Frame: <strong>{frames.length ? (frameIndex + 1) : 0}</strong> / <strong>{frames.length}</strong>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Session: {sessionIdRef.current}
              </div>
            </div>
          </>
        )}

        <br />
        <div className="button-container">
          <Button className="mb-3" onClick={handleDownloadQR} disabled={!currentValue}>
            Download Current Frame
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AnimatedQRPage;
