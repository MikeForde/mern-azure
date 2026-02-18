import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Button, ProgressBar, Alert, Form, Toast, ToastContainer } from 'react-bootstrap';
import axios from 'axios';
import './AnimatedQRReaderPage.css';
import pako from 'pako';
import { useLoading } from '../contexts/LoadingContext';



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

function bytesToUtf8(bytes) {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function looksGzipped(bytes) {
  return bytes?.length >= 3 && bytes[0] === 0x1f && bytes[1] === 0x8b && bytes[2] === 0x08;
}

function AnimatedQRReaderPage() {
  const { stopLoading } = useLoading();
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
  const [scanSession, setScanSession] = useState(0);

  const uiThrottleRef = useRef({ lastUiMs: 0 });
  const seenPacketsRef = useRef(new Set());

  const overlayRef = useRef(null);
  const leftBoxRef = useRef(null);
  const rightBoxRef = useRef(null);

  const hitTimerLeftRef = useRef(null);
  const hitTimerRightRef = useRef(null);

  // --- “NFC-style” actions state ---
  const [readData, setReadData] = useState('');
  const [originalData, setOriginalData] = useState('');
  const [rawPayload, setRawPayload] = useState('');

  const [isImporting, setIsImporting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVariant, setToastVariant] = useState('info');


  useEffect(() => {
    // If we navigated here after another page set the global spinner,
    // clear it so the QR reader doesn't inherit a stale loading state.
    stopLoading();
    return () => {
      stopLoading();
    };
  }, [stopLoading]);


  const flashHit = useCallback((side) => {
    const el = side === 'left' ? leftBoxRef.current : rightBoxRef.current;
    if (!el) return;

    // add class immediately
    el.classList.add('aqr-hit');

    // clear existing timer
    const timerRef = side === 'left' ? hitTimerLeftRef : hitTimerRightRef;
    if (timerRef.current) clearTimeout(timerRef.current);

    // remove class shortly after
    timerRef.current = setTimeout(() => {
      el.classList.remove('aqr-hit');
      timerRef.current = null;
    }, 180);
  }, []);

  const roiCanvasRef = useRef(null);  // Offscreen canvas reused
  const roiCtxRef = useRef(null);

  function ensureRoiCanvas() {
    if (!roiCanvasRef.current) {
      const c = document.createElement('canvas');
      roiCanvasRef.current = c;
      roiCtxRef.current = c.getContext('2d', { willReadFrequently: true });
    }
    return { canvas: roiCanvasRef.current, ctx: roiCtxRef.current };
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  // Convert an element’s bounding rect (in page pixels) into video pixel coords
  // Convert an element’s bounding rect (in page pixels) into video pixel coords,
  // correctly accounting for object-fit: cover.
  const elementRectToVideoRect = useCallback((videoEl, elementEl) => {
    if (!videoEl || !elementEl) return null;
    if (!videoEl.videoWidth || !videoEl.videoHeight) return null;

    const videoRect = videoEl.getBoundingClientRect();
    const elRect = elementEl.getBoundingClientRect();

    const left = clamp(elRect.left, videoRect.left, videoRect.right);
    const top = clamp(elRect.top, videoRect.top, videoRect.bottom);
    const right = clamp(elRect.right, videoRect.left, videoRect.right);
    const bottom = clamp(elRect.bottom, videoRect.top, videoRect.bottom);

    const cssW = right - left;
    const cssH = bottom - top;
    if (cssW < 10 || cssH < 10) return null;

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const dw = videoRect.width;
    const dh = videoRect.height;

    const scale = Math.max(dw / vw, dh / vh);
    const displayedW = vw * scale;
    const displayedH = vh * scale;

    const offsetX = (displayedW - dw) / 2;
    const offsetY = (displayedH - dh) / 2;

    const xInElement = (left - videoRect.left);
    const yInElement = (top - videoRect.top);

    const xOnScaledVideo = xInElement + offsetX;
    const yOnScaledVideo = yInElement + offsetY;

    const x = xOnScaledVideo / scale;
    const y = yOnScaledVideo / scale;
    const w = cssW / scale;
    const h = cssH / scale;

    const x2 = clamp(x, 0, vw - 1);
    const y2 = clamp(y, 0, vh - 1);
    const w2 = clamp(w, 1, vw - x2);
    const h2 = clamp(h, 1, vh - y2);

    return { x: x2, y: y2, w: w2, h: h2 };
  }, []);



  // Crop a rect from the video into the offscreen canvas and return a dataURL
  // Crop a rect from the video into the offscreen canvas and return the canvas.
  const cropVideoToCanvas = useCallback((videoEl, rect, targetSize = 480) => {
    const { canvas, ctx } = ensureRoiCanvas();

    const sx = Math.floor(rect.x);
    const sy = Math.floor(rect.y);
    const sw = Math.floor(rect.w);
    const sh = Math.floor(rect.h);

    canvas.width = targetSize;
    canvas.height = targetSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    return canvas;
  }, []);

  const stopScanner = useCallback(() => {
    // Stop ROI loop
    if (controlsRef.current) {
      try { controlsRef.current.stop(); } catch { }
      controlsRef.current = null;
    }

    // Clear hit timers
    if (hitTimerLeftRef.current) {
      clearTimeout(hitTimerLeftRef.current);
      hitTimerLeftRef.current = null;
    }

    if (hitTimerRightRef.current) {
      clearTimeout(hitTimerRightRef.current);
      hitTimerRightRef.current = null;
    }

    const videoEl = videoRef.current;

    // Pause video (important on Android)
    try { videoEl?.pause?.(); } catch { }

    const stream = videoEl?.srcObject;
    if (stream && typeof stream.getTracks === 'function') {
      stream.getTracks().forEach((t) => {
        try { t.stop(); } catch { }
      });
    }

    if (videoEl) {
      videoEl.srcObject = null;
      try { videoEl.load?.(); } catch { }
    }
  }, []);

  // function prettyIfJson(str) {
  //   try { return JSON.stringify(JSON.parse(str), null, 2); }
  //   catch { return str; }
  // }

  const completeMessage = useCallback(async (chunkMap, total) => {
    if (completedRef.current) return;
    completedRef.current = true;



    try {
      // Ensure we truly have all chunks
      for (let i = 0; i < total; i++) {
        if (chunkMap[i] == null) {
          completedRef.current = false;
          return;
        }
      }

      // 1) Raw reconstructed string (exactly what we captured)
      const reconstructed = Array.from({ length: total }, (_, i) => chunkMap[i]).join('');

      // Start building a detailed “decode report”
      const report = {
        rawReconstructed: reconstructed,
        envelope: null,
        base64ByteLength: null,
        gzip: {
          mimeIndicatesGzip: false,
          looksGzippedMagic: false,
          decompressed: false,
          error: null,
        },
        decodedUtf8: null,
        decodeError: null,
      };

      // 2) Try parse envelope JSON
      let envelope;
      try {
        envelope = JSON.parse(reconstructed);
        report.envelope = envelope;
      } catch (e) {
        report.decodeError = `Envelope JSON parse failed: ${e?.message || String(e)}`;
        setDecodedPayload(report);
        return;
      }

      if (!envelope || typeof envelope !== 'object') {
        report.decodeError = 'Envelope not JSON object';
        setDecodedPayload(report);
        return;
      }
      if (typeof envelope.data !== 'string') {
        report.decodeError = 'Envelope missing "data" string';
        setDecodedPayload(report);
        return;
      }
      if (typeof envelope.mimeType !== 'string') {
        report.decodeError = 'Envelope missing "mimeType" string';
        setDecodedPayload(report);
        return;
      }

      // 3) Base64 -> bytes
      let bytes;
      try {
        bytes = base64ToBytes(envelope.data);
        report.base64ByteLength = bytes.length;
      } catch (e) {
        report.decodeError = `Base64 decode failed: ${e?.message || String(e)}`;
        setDecodedPayload(report);
        return;
      }

      const mime = envelope.mimeType || '';
      const isEnc = mime.includes('aes256');
      const isGzipMime = mime.includes('gzip');

      // ---- CASE A: gzip + encrypt ----
      // envelope.data base64-decodes to UTF-8 JSON: {"encryptedData":...,"iv":...,"mac":...}
      // The gzip is INSIDE the decrypted plaintext. We do NOT ungzip here.
      if (isEnc) {
        try {
          const jsonStr = bytesToUtf8(bytes);

          // show what we got at this stage (the encrypted wrapper)
          report.decodedUtf8 = jsonStr;

          const encObj = JSON.parse(jsonStr);
          report.envelopeParsedInner = encObj;

          // Send to the same decoder endpoint your NFC page uses.
          // NFC sends octet-stream, but in QR we naturally have JSON; easiest is send JSON.
          const resp = await fetch('/test', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',

              // Tell middleware to decrypt request body
              'X-Encrypted': 'true',

              // Tell middleware the JSON fields are base64 and the underlying plaintext was gzipped before encryption
              'Content-Encoding': 'gzip, base64',
              'X-Force-Decode': 'true',
            },
            body: JSON.stringify(encObj),
          });

          const text = await resp.text();

          if (!resp.ok) {
            throw new Error(`Server decode failed: ${resp.status} ${resp.statusText}\n${text}`);
          }

          // If it's JSON, pretty-print; otherwise show raw
          try {
            report.serverDecodedPretty = JSON.stringify(JSON.parse(text), null, 2);
          } catch {
            report.serverDecodedPretty = text;
          }

          report.decodedUtf8 = report.serverDecodedPretty;

          // Keep gzip flags informative only (we didn't gunzip client-side for ENC)
          report.gzip = {
            mimeIndicatesGzip: true,
            looksGzippedMagic: false,
            decompressed: false,
            error: null,
          };

          setDecodedPayload(report);
          return;
        } catch (e) {
          report.decodeError = `Encrypted payload decode failed: ${e?.message || String(e)}`;
          setDecodedPayload(report);
          return;
        }
      }

      // ---- CASE B: gzip-only (what you already had) ----
      report.gzip.mimeIndicatesGzip = isGzipMime;
      report.gzip.looksGzippedMagic = looksGzipped(bytes);

      if (isGzipMime || report.gzip.looksGzippedMagic) {
        try {
          bytes = pako.ungzip(bytes);
          report.gzip.decompressed = true;
        } catch (e) {
          report.gzip.error = e?.message || String(e);
          report.decodeError = `Gzip decompress failed: ${report.gzip.error}`;
          setDecodedPayload(report);
          return;
        }
      }

      // 5) bytes -> utf8
      try {
        const utf8 = bytesToUtf8(bytes);
        try {
          report.decodedUtf8 = JSON.stringify(JSON.parse(utf8), null, 2);
        } catch {
          report.decodedUtf8 = utf8;
        }
      } catch (e) {
        report.decodeError = `UTF-8 decode failed: ${e?.message || String(e)}`;
        setDecodedPayload(report);
        return;
      }

      if (report.decodedUtf8 != null) {
        const usable = report.decodedUtf8;           // may be pretty already
        const raw = (() => {
          // For actions, prefer a non-prettified JSON string if it is JSON
          // (prettified is still valid JSON, so this is mostly cosmetic)
          try {
            const obj = JSON.parse(report.decodedUtf8);
            return JSON.stringify(obj);
          } catch {
            return report.decodedUtf8;
          }
        })();

        setRawPayload(raw);
        setOriginalData(usable);
        setReadData(usable);
      }

      // Success (still keep raw + metadata)
      setDecodedPayload(report);
    } catch (e) {
      console.error(e);
      setError(`Failed to decode message: ${e?.message || String(e)}`);
      completedRef.current = false;
    } finally {
      stopScanner();
    }
  }, [stopScanner]);


  const handlePacket = useCallback((packet) => {
    if (completedRef.current) return;
    if (!packet || packet.length < 4) return;

    // Dedupe identical QR contents (huge speed win near the end)
    const seen = seenPacketsRef.current;
    if (seen.has(packet)) return;
    seen.add(packet);
    // prevent unbounded growth (safety)
    if (seen.size > 5000) seen.clear();

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

    const updated = chunksRef.current;

    if (updated[firstIndex] == null) updated[firstIndex] = firstPayload;
    if (updated[secondIndex] == null) updated[secondIndex] = secondPayload;

    const received = Object.keys(updated).length;

    // If complete, decode immediately (don’t wait for throttled UI)
    if (received === total) {
      completeMessage(updated, total);
      return;
    }

    // Throttle UI updates (10 fps)
    const now = Date.now();
    if (now - uiThrottleRef.current.lastUiMs < 100) return;
    uiThrottleRef.current.lastUiMs = now;

    setLastSeenAt(now);
    setLastPacketInfo(
      `total=${total}, i1=${firstIndex}, i2=${secondIndex}, start2=${secondStart}, len=${packet.length}`
    );

    setReceivedCount(received);

    const missing = countMissing(updated, total);
    setMissingCount(missing);

    setProgress(Math.floor((received / total) * 100));
  }, [completeMessage]);


  useEffect(() => {
    if (!lastSeenAt) return;
    const t = setTimeout(() => setLastSeenAt(null), 1200);
    return () => clearTimeout(t);
  }, [lastSeenAt]);

  useEffect(() => {
    if (decodedPayload) return;

    let isMounted = true;
    let rafId = null;
    let running = true;

    // Capture once for the whole effect + cleanup (prevents .current lint warnings)
    const videoEl = videoRef.current;

    const reader = new BrowserMultiFormatReader();

    async function startCamera() {
      await new Promise(requestAnimationFrame);

      if (!videoEl) throw new Error('Video element not ready');

      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoEl.srcObject = stream;

      // Safari sometimes needs play()
      await videoEl.play().catch(() => { });

      // Wait for video metadata / dimensions
      await new Promise((resolve) => {
        const check = () => {
          if (!isMounted) return;
          if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) resolve();
          else requestAnimationFrame(check);
        };
        check();
      });

      return videoEl;
    }

    // IMPORTANT: ensure only one decode runs at a time
    let decoding = false;

    async function tryDecodeBox(boxEl, label) {
      if (!isMounted || completedRef.current) return;
      if (!videoEl) return;

      const rect = elementRectToVideoRect(videoEl, boxEl);
      if (!rect) return;

      const cropCanvas = cropVideoToCanvas(videoEl, rect, 480);

      try {
        const result = await reader.decodeFromCanvas(cropCanvas);
        if (result?.getText) {
          flashHit(label);
          handlePacket(result.getText());
        }
      } catch (e) {
        // ignore "not found"
      }
    }

    async function step() {
      if (!running || !isMounted) return;
      if (completedRef.current) return;

      if (decoding) {
        rafId = requestAnimationFrame(step);
        return;
      }

      decoding = true;
      const t0 = performance.now();

      await tryDecodeBox(leftBoxRef.current, 'left');
      if (!completedRef.current) {
        await tryDecodeBox(rightBoxRef.current, 'right');
      }

      decoding = false;

      const elapsed = performance.now() - t0;
      const delayMs = elapsed > 50 ? 20 : 0;

      if (delayMs > 0) {
        setTimeout(() => {
          rafId = requestAnimationFrame(step);
        }, delayMs);
      } else {
        rafId = requestAnimationFrame(step);
      }
    }

    (async () => {
      try {
        await startCamera();
        if (!isMounted) return;

        rafId = requestAnimationFrame(step);

        controlsRef.current = {
          stop: () => {
            running = false;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = null;
          },
        };
      } catch (e) {
        console.error('Camera/scanner start failed:', e);
        const name = e?.name || 'Error';
        const msg = e?.message || String(e);
        setError(`${name}: ${msg}`);
      }
    })();

    return () => {
      isMounted = false;
      running = false;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;

      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch { }
        controlsRef.current = null;
      }

      // Use captured videoEl (no videoRef.current here)
      const s = videoEl?.srcObject;

      if (s && typeof s.getTracks === 'function') {
        s.getTracks().forEach((t) => {
          try { t.stop(); } catch { }
        });
      }
      if (videoEl) {
        try { videoEl.pause?.(); } catch { }
        videoEl.srcObject = null;
        try { videoEl.load?.(); } catch { }
      }
    };
  }, [handlePacket, scanSession, decodedPayload, elementRectToVideoRect, cropVideoToCanvas, flashHit]);




  const reset = useCallback(() => {
    stopScanner();
    completedRef.current = false;
    totalRef.current = null;
    chunksRef.current = {};
    seenPacketsRef.current.clear();

    setTotalChunks(null);
    setProgress(0);
    setDecodedPayload(null);
    setError(null);

    setLastPacketInfo('');
    setReceivedCount(0);
    setMissingCount(null);
    setLastSeenAt(null);
    setScanSession((s) => s + 1);
    setReadData('');
    setOriginalData('');
    setRawPayload('');

  }, [stopScanner]);

  const showOriginal = () => setReadData(originalData);

  const handleImport = async () => {
    if (!rawPayload) return;
    setIsImporting(true);

    let endpoint;
    let payloadToSend;

    try {
      const trimmed = rawPayload.trim();

      if (trimmed.startsWith('{') && trimmed.includes('"resourceType"') && trimmed.includes('Bundle')) {
        endpoint = '/ipsbundle';
        payloadToSend = JSON.parse(trimmed);
      } else if (trimmed.startsWith('MSH')) {
        endpoint = '/ipsfromhl72x';
        payloadToSend = trimmed;
      } else if (trimmed.startsWith('H9')) {
        endpoint = '/ipsfrombeer';
        payloadToSend = trimmed;
      } else {
        throw new Error('Unrecognized IPS format');
      }

      const isJson = endpoint === '/ipsbundle';
      const contentType = isJson ? 'application/json' : 'text/plain';

      const resp = await axios.post(endpoint, payloadToSend, {
        headers: { 'Content-Type': contentType },
      });

      setToastMsg(`Import success: ${resp.status} ${resp.statusText}`);
      setToastVariant('success');
    } catch (err) {
      setToastMsg(`Import failed: ${err.message}`);
      setToastVariant('danger');
    } finally {
      setShowToast(true);
      setIsImporting(false);
    }
  };

  const handleConvertOnly = async () => {
    if (!rawPayload) return;
    setIsConverting(true);

    try {
      const obj = JSON.parse(rawPayload);
      const resp = await axios.post('/convertips2mongo', obj, {
        headers: { 'Content-Type': 'application/json' },
      });

      const converted = JSON.stringify(resp.data, null, 2);
      setReadData(converted);

      setToastMsg('Conversion successful');
      setToastVariant('success');
    } catch (err) {
      setToastMsg(`Conversion failed: ${err.message}`);
      setToastVariant('danger');
    } finally {
      setShowToast(true);
      setIsConverting(false);
    }
  };

  const handleValidate = async () => {
    if (!rawPayload) return;
    setIsValidating(true);

    try {
      const obj = JSON.parse(rawPayload);
      const resp = await axios.post('/ipsUniVal', obj, {
        headers: { 'Content-Type': 'application/json' },
      });

      let formatted;
      if (resp.data.valid) {
        formatted = '✅ Valid!';
      } else {
        formatted = resp.data.errors
          .map((err) => `${err.path || '/'}: ${err.message}`)
          .join('\n');
      }

      setReadData(formatted);
      setToastMsg(resp.data.valid ? 'Validation passed' : 'Validation errors');
      setToastVariant(resp.data.valid ? 'success' : 'warning');
    } catch (err) {
      setToastMsg(`Validation failed: ${err.message}`);
      setToastVariant('danger');
    } finally {
      setShowToast(true);
      setIsValidating(false);
    }
  };


  return (
    <div className="container">
      <h3>Animated QR Reader</h3>

      {/* SCANNING VIEW */}
      {!decodedPayload && (
        <>
          <div className="aqr-reader">
            <video
              key={scanSession}
              ref={videoRef}
              className="aqr-video"
              muted
              playsInline
            />
            <div className="aqr-overlay" ref={overlayRef}>
              <div className="aqr-window aqr-left" ref={leftBoxRef} />
              <div className="aqr-window aqr-right" ref={rightBoxRef} />
            </div>
          </div>

          <ProgressBar now={progress} label={`${progress}%`} />

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            <div>
              <strong>Status:</strong>{" "}
              {lastSeenAt ? "Scanning (seeing QRs)" : "Scanning (no QRs seen)"}
            </div>
            <div>
              <strong>Last packet:</strong> {lastPacketInfo || "(none yet)"}
            </div>
            <div>
              <strong>Received:</strong> {receivedCount}
              {totalChunks ? ` / ${totalChunks}` : ""}
              {missingCount != null ? (
                <span>
                  {" "}
                  &nbsp;|&nbsp; <strong>Missing:</strong> {missingCount}
                </span>
              ) : null}
            </div>
          </div>
        </>
      )}

      {/* COMPLETE VIEW */}
      {decodedPayload && (
        <>
          <Alert variant={decodedPayload.decodeError ? "warning" : "success"}>
            {decodedPayload.decodeError
              ? "Scan Complete (with decode issues)"
              : "Scan Complete"}
          </Alert>


          <div className="button-container mb-3" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={reset}>
              Scan Another
            </Button>

            <Button variant="success" onClick={handleImport} disabled={!rawPayload || isImporting}>
              {isImporting ? 'Importing...' : 'Import'}
            </Button>

            <Button variant="secondary" onClick={handleConvertOnly} disabled={!rawPayload || isConverting}>
              {isConverting ? 'Converting...' : 'NoSQL'}
            </Button>

            <Button variant="info" onClick={handleValidate} disabled={!rawPayload || isValidating}>
              {isValidating ? 'Validating...' : 'Validate'}
            </Button>

            <Button variant="outline-secondary" onClick={showOriginal} disabled={!originalData}>
              Original
            </Button>
          </div>

          <h5>Payload</h5>
          <Form.Control
            as="textarea"
            rows={15}
            value={readData || decodedPayload.decodedUtf8 || ''}
            readOnly
            className="resultTextArea"
          />

          {/* 1) Literally what we captured */}
          <h5 style={{ marginTop: 12 }}>Captured (raw reconstructed)</h5>
          <pre style={{ maxHeight: 220, overflow: "auto", whiteSpace: "pre-wrap" }}>
            {decodedPayload.rawReconstructed}
          </pre>

          {/* 2) Decoded interpretation */}
          <h5 style={{ marginTop: 12 }}>Decoded (best effort)</h5>

          {decodedPayload.envelope?.mimeType ? (
            <p style={{ marginBottom: 6 }}>
              <strong>MIME:</strong> {decodedPayload.envelope.mimeType}
            </p>
          ) : null}

          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>
            <div>
              <strong>Base64 bytes:</strong>{" "}
              {decodedPayload.base64ByteLength ?? "(unknown)"}
            </div>
            <div>
              <strong>Gzip:</strong>{" "}
              mime={String(decodedPayload.gzip?.mimeIndicatesGzip)}{" "}
              magic={String(decodedPayload.gzip?.looksGzippedMagic)}{" "}
              decompressed={String(decodedPayload.gzip?.decompressed)}
              {decodedPayload.gzip?.error ? (
                <span>
                  {" "}
                  &nbsp;|&nbsp; <strong>Error:</strong> {decodedPayload.gzip.error}
                </span>
              ) : null}
            </div>
          </div>

          {decodedPayload.decodeError ? (
            <Alert variant="danger" style={{ marginTop: 8 }}>
              <strong>Decode error:</strong> {decodedPayload.decodeError}
            </Alert>
          ) : null}

          {decodedPayload.decodedUtf8 != null ? (
            <>
              <h6 style={{ marginTop: 10 }}>Decoded UTF-8 payload</h6>
              <pre style={{ maxHeight: 320, overflow: "auto", whiteSpace: "pre-wrap" }}>
                {decodedPayload.decodedUtf8}
              </pre>
            </>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              No decoded UTF-8 payload available.
            </div>
          )}

          <details style={{ marginTop: 10 }}>
            <summary>Show parsed envelope JSON</summary>
            <pre style={{ maxHeight: 220, overflow: "auto", whiteSpace: "pre-wrap" }}>
              {JSON.stringify(decodedPayload.envelope, null, 2)}
            </pre>
          </details>

          <Button onClick={reset} style={{ marginTop: 12 }}>
            Scan Another
          </Button>
        </>
      )}

      {error && (
        <Alert variant="danger" style={{ marginTop: 10 }}>
          {error}
        </Alert>
      )}

      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        <Toast onClose={() => setShowToast(false)} show={showToast} bg={toastVariant} delay={4000} autohide>
          <Toast.Header>
            <strong className="me-auto">IPS MERN QR</strong>
          </Toast.Header>
          <Toast.Body className={toastVariant !== 'light' ? 'text-white' : ''}>
            {toastMsg}
          </Toast.Body>
        </Toast>
      </ToastContainer>

    </div>
  );
}

export default AnimatedQRReaderPage;
