import React, { useState } from 'react';
import axios from 'axios';
import { Button, Form, Toast, ToastContainer } from 'react-bootstrap';
import './Page.css';

export default function NFCReaderPage() {
  const [readData, setReadData] = useState('');
  const [cardInfo, setCardInfo] = useState('');
  const [isReading, setIsReading] = useState(false);

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVariant, setToastVariant] = useState('info');

  // Custom MIME type - we may add others in later versions
  const BINARY_MIME = 'application/x.ips.gzip.aes256.v1-0';

  const handleReadFromNfc = async () => {
    if (!('NDEFReader' in window)) {
      setToastMsg('Web NFC is not supported on this device/browser.');
      setToastVariant('warning');
      setShowToast(true);
      return;
    }

    setIsReading(true);
    setReadData('');
    setCardInfo('');
    try {
      const reader = new window.NDEFReader();
      await reader.scan();

      reader.onreadingerror = () => {
        throw new Error('Cannot read data from the NFC tag.');
      };

      reader.onreading = async ({ serialNumber, message }) => {
        // Show UID and record count
        setCardInfo(`UID: ${serialNumber}\nRecords: ${message.records.length}`);

        let payloadTxt = '';

        for (let i = 0; i < message.records.length; i++) {
          const record = message.records[i];

          // 1) Binary path: send to server for decrypt+gunzip
          if (record.recordType === 'mime' && record.mediaType === BINARY_MIME) {
            // Extract raw bytes
            const buffer = record.data instanceof ArrayBuffer
              ? record.data
              : record.data.buffer;

            try {
              const resp = await axios.post(
                '/test',
                buffer,
                {
                  headers: { 'Content-Type': 'application/octet-stream' },
                  responseType: 'text'
                }
              );
              // Try to parse JSON, otherwise show raw text
              let bodyStr;
              if (typeof resp.data === 'object') {
                // Axios parsed it as JSON for us
                bodyStr = JSON.stringify(resp.data, null, 2);
              } else {
                // It's a string—try to JSON.parse, else leave as‑is
                try {
                  const parsed = JSON.parse(resp.data);
                  bodyStr = JSON.stringify(parsed, null, 2);
                } catch {
                  bodyStr = resp.data;
                }
              }
              payloadTxt += `Record ${i} (binary decoded):\n${bodyStr}\n\n`;
            } catch (err) {
              payloadTxt += `Record ${i}: Error decoding binary: ${err.message}\n\n`;
            }
          }
          // 2) Text record
          else if (record.recordType === 'text') {
            const decoder = new TextDecoder(record.encoding || 'utf-8');
            payloadTxt += `Record ${i} (text): ${decoder.decode(record.data)}\n\n`;
          }
          // 3) URL record
          else if (record.recordType === 'url') {
            const decoder = new TextDecoder();
            payloadTxt += `Record ${i} (URL): ${decoder.decode(record.data)}\n\n`;
          }
          // 4) Fallback hex dump
          else {
            const hex = Array.from(new Uint8Array(record.data))
              .map(b => b.toString(16).padStart(2, '0'))
              .join(' ');
            payloadTxt += `Record ${i} (${record.recordType}): ${hex}\n\n`;
          }
        }

        setReadData(payloadTxt.trim());
        setToastMsg('NFC tag read successfully!');
        setToastVariant('success');
        setShowToast(true);
        setIsReading(false);
      };
    } catch (err) {
      console.error(err);
      setToastMsg(`Failed to read NFC: ${err.message}`);
      setToastVariant('danger');
      setShowToast(true);
      setIsReading(false);
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h3>NFC Reader</h3>

        <div className="button-container mb-3">
          <Button
            variant={isReading ? 'dark' : 'primary'}
            onClick={handleReadFromNfc}
            disabled={isReading}
          >
            {isReading ? 'Waiting…' : 'Read from NFC'}
          </Button>
        </div>

        <h5>Card Info</h5>
        <Form.Control
          as="textarea"
          rows={3}
          value={cardInfo}
          readOnly
          className="mb-3"
        />

        <h5>Payload</h5>
        <Form.Control
          as="textarea"
          rows={18}
          value={readData}
          readOnly
        />
      </div>

      <ToastContainer
        position="top-end"
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
            <strong className="me-auto">IPS MERN says</strong>
          </Toast.Header>
          <Toast.Body className={toastVariant === 'light' ? '' : 'text-white'}>
            {toastMsg}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </div>
  );
}
