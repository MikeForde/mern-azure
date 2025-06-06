import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import pako from 'pako';

export default function PayloadPage() {
  const [searchParams] = useSearchParams();
  const [decodedData, setDecodedData] = useState('');
  const [error, setError] = useState(null);

  const toStandardBase64 = (b64) =>
    b64
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(b64.length + (4 - b64.length % 4) % 4, '=');
  

  useEffect(() => {
    const base64data = searchParams.get('d');
    if (!base64data) {
      setError('No data found in URL.');
      return;
    }

    try {
        const standardBase64 = toStandardBase64(base64data);

        // Decode base64
        const byteArray = Uint8Array.from(atob(standardBase64), c => c.charCodeAt(0));
      // Gunzip
      const unzipped = pako.ungzip(byteArray, { to: 'string' });
      setDecodedData(unzipped);
    } catch (err) {
      console.error('Failed to decompress:', err);
      setError('Failed to decode or decompress payload.' + base64data );
    }
  }, [searchParams]);

  return (
    <div className="container mt-4">
      <h4>CIWX Payload Viewer</h4>
      {error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {decodedData}
        </pre>
      )}
    </div>
  );
}
