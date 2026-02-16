import React, { useState, useEffect, useContext, useMemo } from 'react';
import QRCode from 'qrcode.react';
import axios from 'axios';
import { Button, Alert, DropdownButton, Dropdown, Form } from 'react-bootstrap';
import './Page.css';
import { PatientContext } from '../PatientContext';
import { useLoading } from '../contexts/LoadingContext';
import pako from 'pako';

const ANIMATED_QR_TARGET_FPS = 10;
const ANIMATED_QR_METADATA_LENGTH = 4; // header is 4 chars
const OFFSET_DIVISOR = 4; // Android uses ANIMATED_QR_METADATA_LENGTH for spacing

// Mirror their conservative capacity table (matches their chunker assumptions)
const EC_LEVELS = {
  L: { label: 'L (max capacity)', maxByteContent: 251 },
  M: { label: 'M', maxByteContent: 213 },
  Q: { label: 'Q', maxByteContent: 88 },
  H: { label: 'H (most robust)', maxByteContent: 68 },
};

// --- gzip helpers (frontend payload gzip + base64) ---
function uint8ToBase64(u8) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < u8.length; i += chunkSize) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function gzipToBase64(str) {
  const gz = pako.gzip(str); // Uint8Array
  return uint8ToBase64(gz);
}

function base64EncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// --- Kotlin-equivalent UTF-8 safe chunking ---
function calculateAnimatedQrChunks(input, maxByteContent) {
  const bytes = new TextEncoder().encode(input);

  const maxIndividual = maxByteContent - ANIMATED_QR_METADATA_LENGTH;
  const chunkSize = maxIndividual > 0 ? Math.floor(maxIndividual / 2) : 0;
  if (chunkSize <= 0) return [];

  const out = [];
  let offset = 0;

  while (offset < bytes.length) {
    let end = Math.min(offset + chunkSize, bytes.length);

    // Avoid splitting UTF-8 continuation bytes (10xxxxxx)
    while (end < bytes.length && (bytes[end] & 0b11000000) === 0b10000000) {
      end--;
    }

    // Defensive fallback
    if (end <= offset) end = Math.min(offset + 1, bytes.length);

    out.push(new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(offset, end)));
    offset = end;
  }

  return out;
}

// --- Android-equivalent packet builder: 4-char header + two chunks ---
function buildQrPacket(chunks, primaryChunkIndex, secondaryChunkIndex) {
  if (!chunks.length) return null;
  if (primaryChunkIndex < 0 || primaryChunkIndex >= chunks.length) return null;
  if (secondaryChunkIndex < 0 || secondaryChunkIndex >= chunks.length) return null;

  const firstPacketData = chunks[primaryChunkIndex];
  const secondPacketData = chunks[secondaryChunkIndex];

  // Kotlin: secondPacketStartIndex = 4 + firstPacketData.length (string length!)
  const secondPacketStartIndex = ANIMATED_QR_METADATA_LENGTH + firstPacketData.length;

  // Kotlin: "${chunks.size.toChar()}${primaryChunkIndex.toChar()}${secondaryChunkIndex.toChar()}${secondPacketStartIndex.toChar()}"
  const metadata =
    String.fromCharCode(chunks.length) +
    String.fromCharCode(primaryChunkIndex) +
    String.fromCharCode(secondaryChunkIndex) +
    String.fromCharCode(secondPacketStartIndex);

  return metadata + firstPacketData + secondPacketData;
}

function AnimatedQR2Page() {
  const { selectedPatients, selectedPatient, setSelectedPatient } = useContext(PatientContext);
  const { startLoading, stopLoading } = useLoading();

  const [mode, setMode] = useState('nps');

  const [useCompressionAndEncryption, setUseCompressionAndEncryption] = useState(false);
  const [useIncludeKey, setUseIncludeKey] = useState(false);
  const [useGzipOnly, setUseGzipOnly] = useState(false);

  const [payload, setPayload] = useState('');
  const [responseSize, setResponseSize] = useState(0);
  const [fetchError, setFetchError] = useState('');

  const [ecLevel, setEcLevel] = useState('L');
  const [fps, setFps] = useState(ANIMATED_QR_TARGET_FPS);
  const [isPlaying, setIsPlaying] = useState(true);

  const [frameIndex, setFrameIndex] = useState(0);

  const handleRecordChange = (recordId) => {
    const record = selectedPatients.find(r => r._id === recordId);
    startLoading();
    setSelectedPatient(record);
  };

  const handleModeChange = (selectedMode) => {
    startLoading();
    setMode(selectedMode);
  };

  // keep includeKey meaningful
  useEffect(() => {
    if (!useCompressionAndEncryption && useIncludeKey) setUseIncludeKey(false);
  }, [useCompressionAndEncryption, useIncludeKey]);

  // Fetch/build payload like QRPage
  useEffect(() => {
    if (!selectedPatient) return;

    setFetchError('');
    let endpoint;

    if (mode === 'ipsbeerwithdelim') {
      endpoint = `/ipsbeer/${selectedPatient._id}/pipe`;
    } else {
      endpoint = `/${mode}/${selectedPatient._id}`;
    }

    if (mode === 'ipsurl') {
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/ips/${selectedPatient.packageUUID}`;

      const finalPayload = useGzipOnly ? gzipToBase64(url) : url;

      setPayload(finalPayload);
      setResponseSize(new TextEncoder().encode(finalPayload).length);
      setFrameIndex(0);
      stopLoading();
      return;
    }

    const headers = {};
    if (useCompressionAndEncryption) {
      headers['Accept-Extra'] = useIncludeKey ? 'insomzip, base64, includeKey' : 'insomzip, base64';
      headers['Accept-Encryption'] = 'aes256';
    }
    // IMPORTANT: do NOT set insomzip for gzip-only; gzip-only is done client-side for QR

    axios.get(endpoint, { headers })
      .then(response => {
        let responseData;

        if (useCompressionAndEncryption) {
          responseData = (typeof response.data === 'string') ? response.data : JSON.stringify(response.data);
        } else if (mode === 'ipsminimal' || mode === 'ipsbeer' || mode === 'ipsbeerwithdelim' || mode === 'ipshl72x') {
          responseData = response.data;
        } else {
          responseData = JSON.stringify(response.data);
        }

        if (useGzipOnly && !useCompressionAndEncryption) {
          responseData = gzipToBase64(responseData);
        }

        const size = new TextEncoder().encode(responseData).length;
        setResponseSize(size);
        setPayload(responseData);
        setFrameIndex(0);
      })
      .catch(error => {
        console.error('Error fetching IPS record:', error);
        setFetchError('Error fetching IPS record');
        setPayload('');
        setResponseSize(0);
      })
      .finally(() => stopLoading());
  }, [selectedPatient, mode, useCompressionAndEncryption, useIncludeKey, useGzipOnly, stopLoading]);

    // --- helpers ---
  function looksBase64(str) {
    if (typeof str !== 'string') return false;
    const s = str.trim();
    if (!s || s.length % 4 !== 0) return false;
    // allow base64 + base64url
    return /^[A-Za-z0-9+/=_-]+$/.test(s);
  }

  const chunks = useMemo(() => {
    if (!payload) return [];

    const maxByteContent = EC_LEVELS[ecLevel]?.maxByteContent ?? EC_LEVELS.L.maxByteContent;

    const mimeType =
      mode === 'ipsurl'
        ? (useGzipOnly ? 'application/x.ips.gzip.v1-0' : 'text/uri-list')
        : (useCompressionAndEncryption
          ? 'application/x.ips.gzip.aes256.v1-0'
          : (useGzipOnly ? 'application/x.ips.gzip.v1-0' : 'application/x.ips.v1-0'));

    // IMPORTANT:
    // - Plain: payload is JSON/text -> base64(utf8(payload))
    // - Gzip-only: payload is already base64(gzipBytes) -> use as-is
    // - Gzip+Encrypt: payload is typically JSON like {"encryptedData":...,"iv":...,"mac":...}
    //               -> base64(utf8(payload)) unless the server already returned base64
    let data;
    if (useGzipOnly) {
      data = payload; // already base64(gzip bytes)
    } else if (useCompressionAndEncryption) {
      const p = String(payload).trim();
      data = looksBase64(p) ? p : base64EncodeUtf8(p);
    } else {
      data = base64EncodeUtf8(payload);
    }

    const wrapped = JSON.stringify({ data, mimeType });
    return calculateAnimatedQrChunks(wrapped, maxByteContent);
  }, [payload, ecLevel, mode, useGzipOnly, useCompressionAndEncryption]);


  const N = chunks.length;
  const offset = N > 0 ? Math.floor(N / OFFSET_DIVISOR) : 0;

  // Build the two QR packets for the current frame (Android scheduling)
  const leftPacket = useMemo(() => {
    if (!N) return '';
    return buildQrPacket(chunks, frameIndex % N, (frameIndex + offset) % N) ?? '';
  }, [chunks, frameIndex, offset, N]);

  const rightPacket = useMemo(() => {
    if (!N) return '';
    return buildQrPacket(
      chunks,
      (frameIndex + 2 * offset) % N,
      (frameIndex + 3 * offset) % N
    ) ?? '';
  }, [chunks, frameIndex, offset, N]);

  // Animate frameIndex at fps
  useEffect(() => {
    if (!isPlaying) return;
    if (!N) return;

    const intervalMs = Math.max(50, Math.floor(1000 / Math.max(1, fps)));
    const t = setInterval(() => {
      setFrameIndex(prev => (N ? (prev + 1) % N : 0));
    }, intervalMs);

    return () => clearInterval(t);
  }, [isPlaying, fps, N]);

  // QR sizing: keep each code readable; use half width when side-by-side
  const maxQRSize = 520;
  const available = Math.min(window.innerWidth * 0.9, maxQRSize * 2);
  const qrSize = Math.min((available - 16) / 2, window.innerHeight * 0.6, maxQRSize);

  const showChunkWarning = payload && N === 0;
  const showOffsetWarning = N > 0 && offset === 0 && N >= 2;

  const downloadCanvas = (canvasId, suggestedName) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = (which) => {
    if (!selectedPatient) return;

    const pad = (n) => n.toString().padStart(2, '0');
    const d = new Date();
    const yyyymmdd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

    const sanitize = (str) =>
      str
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

    const {
      packageUUID,
      patient: { name: familyName, given: givenName }
    } = selectedPatient;

    const fam = sanitize(familyName);
    const giv = sanitize(givenName);
    const last6 = packageUUID.slice(-6);

    const flags = [];
    if (mode !== 'ipsurl') {
      if (useGzipOnly) flags.push('gz');
      if (useCompressionAndEncryption) flags.push('ce');
      if (useIncludeKey && useCompressionAndEncryption) flags.push('ik');
    } else {
      if (useGzipOnly) flags.push('gz');
    }
    flags.push(`ec${ecLevel.toLowerCase()}`);
    flags.push(`fps${fps}`);
    const flagPart = flags.length ? `_${flags.join('_')}` : '';

    const framePart = N ? `_idx${String(frameIndex).padStart(4, '0')}_of_${String(N).padStart(4, '0')}` : '';
    const side = which === 'left' ? 'L' : 'R';
    const fileName = `${yyyymmdd}-${fam}_${giv}_${last6}_${mode}${flagPart}${framePart}_${side}.png`;

    downloadCanvas(which === 'left' ? 'qr-canvas-left' : 'qr-canvas-right', fileName);
  };

  return (
    <div className="app">
      <div className="container">
        <h3>
          Generate Animated 2-QR Code{mode !== 'ipsurl' ? ` - ${responseSize} bytes` : ''}
        </h3>

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
            <div className="row g-3 mb-2 align-items-center flex-wrap small">
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

            {/* --- Third row: EC dropdown + play/pause + fps slider compact --- */}
            <div className="row g-2 mb-3 align-items-center flex-wrap small">
              <div className="col-auto">
                <DropdownButton
                  id="dropdown-ec"
                  title={`EC: ${ecLevel}`}
                  onSelect={(lvl) => setEcLevel(lvl)}
                  size="sm"
                  variant="secondary"
                >
                  {Object.keys(EC_LEVELS).map((lvl) => (
                    <Dropdown.Item key={lvl} eventKey={lvl} active={ecLevel === lvl}>
                      {lvl} - {EC_LEVELS[lvl].label}
                    </Dropdown.Item>
                  ))}
                </DropdownButton>
              </div>

              <div className="col-auto">
                <Button
                  size="sm"
                  variant={isPlaying ? 'secondary' : 'primary'}
                  onClick={() => setIsPlaying((p) => !p)}
                  disabled={!N}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
              </div>

              <div className="col-auto" style={{ minWidth: 240 }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  FPS: <strong>{fps}</strong>
                </div>
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
            </div>
          </>
        )}

        {fetchError && (
          <Alert variant="danger" style={{ marginTop: 10 }}>
            {fetchError}
          </Alert>
        )}

        {showChunkWarning && (
          <Alert variant="warning" style={{ marginTop: 10 }}>
            Payload present, but chunking returned 0 chunks. Try EC=L or reduce payload size.
          </Alert>
        )}

        {showOffsetWarning && (
          <Alert variant="info" style={{ marginTop: 10 }}>
            Offset computed as 0 (N/4). This happens for small N. Transfer will still work but may be less efficient.
          </Alert>
        )}

        {!payload ? (
          <Alert variant="info" style={{ marginTop: 10 }}>
            Select a patient to generate an animated 2-QR stream.
          </Alert>
        ) : (
          <>
            <div
              className="qr-container"
              style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center' }}
            >
              <div style={{ flex: 1, maxWidth: qrSize }}>
                <QRCode id="qr-canvas-left" value={leftPacket} size={qrSize} includeMargin={true} />
              </div>

              <div style={{ flex: 1, maxWidth: qrSize }}>
                <QRCode id="qr-canvas-right" value={rightPacket} size={qrSize} includeMargin={true} />
              </div>
            </div>

            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <div>
                Chunks: <strong>{N}</strong> &nbsp;|&nbsp;
                Base index: <strong>{N ? frameIndex : 0}</strong> &nbsp;|&nbsp;
                Offset: <strong>{offset}</strong>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                (Android format: 4-char header + chunkA + chunkB per QR; 2 QRs per frame)
              </div>
            </div>
          </>
        )}

        <br />
        <div className="button-container" style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button className="mb-3" onClick={() => handleDownload('left')} disabled={!leftPacket}>
            Download Left QR (current)
          </Button>
          <Button className="mb-3" onClick={() => handleDownload('right')} disabled={!rightPacket}>
            Download Right QR (current)
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AnimatedQR2Page;
