import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Button, ProgressBar, Alert } from 'react-bootstrap';
import './AnimatedQRReaderPage.css';

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function countMissing(chunkMap, total) {
  if (!total || total <= 0) return null;
  let missing = 0;
  for (let i = 0; i < total; i++) {
    if (chunkMap[i] == null) missing++;
  }
  return missing;
}

function AnimatedQRReaderPage() {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);

  const chunksRef = useRef({});
  const totalRef = useRef(null);
  const completedRef = useRef(false);

  const [progress, setProgress] = useState(0);
  const [totalChunks, setTotalChunks] = useState(null);
  const [decodedPayload, setDecodedPayload] = useState(null);
  const [error, setError] = useState(null);

  const [lastPacketInfo, setLastPacketInfo] = useState('');
  const [receivedCount, setReceivedCount] = useState(0);
  const [missingCount, setMissingCount] = useState(null);
  const [lastSeenAt, setLastSeenAt] = useState(null);

  const completeMessage = useCallback((chunkMap, total) => {
    if (completedRef.current) return;
    completedRef.current = true;

    try {
      for (let i = 0; i < total; i++) {
        if (chunkMap[i] == null) {
          completedRef.current = false;
          return;
        }
      }

      const reconstructed = Array.from({ length: total }, (_, i) => chunkMap[i]).join('');
      const envelope = JSON.parse(reconstructed);

      if (!envelope || typeof envelope !== 'object') throw new Error('Envelope not JSON object');
      if (typeof envelope.data !== 'string') throw new Error('Envelope missing "data" string');
      if (typeof envelope.mimeType !== 'string') throw new Error('Envelope missing "mimeType" string');

      const bytes = base64ToBytes(envelope.data);
      const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

      setDecodedPayload({
        mimeType: envelope.mimeType,
        payload: utf8,
      });
    } catch (e) {
      console.error(e);
      setError(`Failed to decode message: ${e?.message || String(e)}`);
      completedRef.current = false;
    }
  }, []);

  const handlePacket = useCallback((packet) => {
    if (completedRef.current) return;
    if (!packet || packet.length < 4) return;

    const total = packet.charCodeAt(0);
    const firstIndex = packet.charCodeAt(1);
    const secondIndex = packet.charCodeAt(2);
    const secondStart = packet.charCodeAt(3);

    if (!Number.isFinite(total) || total <= 0) return;
    if (firstIndex < 0 || secondIndex < 0) return;
    if (firstIndex >= total || secondIndex >= total) return;
    if (secondStart < 4 || secondStart > packet.length) return;

    // Lock total immediately and ignore other sessions
    if (totalRef.current == null) {
      totalRef.current = total;
      setTotalChunks(total);
    } else if (totalRef.current !== total) {
      return;
    }

    const firstPayload = packet.substring(4, secondStart);
    const secondPayload = packet.substring(secondStart);

    setLastSeenAt(Date.now());
    setLastPacketInfo(`total=${total}, i1=${firstIndex}, i2=${secondIndex}, start2=${secondStart}, len=${packet.length}`);

    const updated = chunksRef.current;

    if (updated[firstIndex] == null) updated[firstIndex] = firstPayload;
    if (updated[secondIndex] == null) updated[secondIndex] = secondPayload;

    const received = Object.keys(updated).length;
    setReceivedCount(received);

    const missing = countMissing(updated, total);
    setMissingCount(missing);

    setProgress(Math.floor((received / total) * 100));

    if (received === total) {
      completeMessage(updated, total);
    }
  }, [completeMessage]);

  useEffect(() => {
    let isMounted = true;
    const reader = new BrowserMultiFormatReader();

    // Capture current video node for cleanup correctness
    const videoEl = videoRef.current;

    (async () => {
      try {
        const constraints = {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        };

        const controls = await reader.decodeFromConstraints(
          constraints,
          videoEl,
          (result) => {
            if (!isMounted) return;
            if (completedRef.current) return;
            if (result) handlePacket(result.getText());
          }
        );

        if (!isMounted) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
      } catch (e) {
        console.error('Camera/scanner start failed:', e);
        const name = e?.name || 'Error';
        const msg = e?.message || String(e);
        setError(`${name}: ${msg}`);
      }
    })();

    return () => {
      isMounted = false;

      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }

      const stream = videoEl?.srcObject;
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (videoEl) videoEl.srcObject = null;
    };
  }, [handlePacket]);

  const reset = useCallback(() => {
    completedRef.current = false;
    totalRef.current = null;
    chunksRef.current = {};

    setTotalChunks(null);
    setProgress(0);
    setDecodedPayload(null);
    setError(null);

    setLastPacketInfo('');
    setReceivedCount(0);
    setMissingCount(null);
    setLastSeenAt(null);
  }, []);

  return (
    <div className="container">
      <h3>Animated QR Reader</h3>

      {!decodedPayload && (
        <>
          <div className="aqr-reader">
            <video ref={videoRef} className="aqr-video" muted playsInline />
            <div className="aqr-overlay">
              <div className="aqr-window aqr-left" />
              <div className="aqr-window aqr-right" />
            </div>
          </div>

          <ProgressBar now={progress} label={`${progress}%`} />

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            <div><strong>Status:</strong> {lastSeenAt ? 'Scanning (seeing QRs)' : 'Scanning (no QRs seen yet)'}</div>
            <div><strong>Last packet:</strong> {lastPacketInfo || '(none yet)'}</div>
            <div>
              <strong>Received:</strong> {receivedCount}{totalChunks ? ` / ${totalChunks}` : ''}
              {missingCount != null ? <span> &nbsp;|&nbsp; <strong>Missing:</strong> {missingCount}</span> : null}
            </div>
          </div>
        </>
      )}

      {decodedPayload && (
        <>
          <Alert variant="success">Scan Complete</Alert>
          <p><strong>MIME:</strong> {decodedPayload.mimeType}</p>
          <pre style={{ maxHeight: 400, overflow: 'auto' }}>
            {decodedPayload.payload}
          </pre>
          <Button onClick={reset}>Scan Another</Button>
        </>
      )}

      {error && <Alert variant="danger" style={{ marginTop: 10 }}>{error}</Alert>}
    </div>
  );
}

export default AnimatedQRReaderPage;
