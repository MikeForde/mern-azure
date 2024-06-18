import React, { useState, useEffect, useContext } from 'react';
import QRCode from 'qrcode.react';
import axios from 'axios';
import { Button, Alert, DropdownButton, Dropdown } from 'react-bootstrap';
import './Page.css';
import { PatientContext } from '../PatientContext';
import { useLoading } from '../contexts/LoadingContext';

function QRPage() {
  const { selectedPatients, selectedPatient, setSelectedPatient } = useContext(PatientContext);
  const [qrData, setQRData] = useState('');
  const [mode, setMode] = useState('ipsurl');
  const [showNotification, setShowNotification] = useState(false);
  const [responseSize, setResponseSize] = useState(0);
  const { startLoading, stopLoading } = useLoading();


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
        axios.get(endpoint)
          .then(response => {
            let responseData;
            if (mode === 'ipsminimal' || mode === 'ipsbeer' || mode === 'ipsbeerwithdelim' || mode === 'ipshl728') {
              responseData = response.data;
            } else {
              responseData = JSON.stringify(response.data);
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
  }, [selectedPatient, mode, stopLoading]);

  const handleDownloadQR = () => {
    const canvas = document.getElementById('qr-canvas');
    const pngUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = 'ips_qr_code.png';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
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
        <div className="header-container">
          <h3>Generate QR Code {mode !== 'ipsurl' && (
            <span className="response-size"> - {responseSize} bytes</span>
          )}</h3>
        </div>
        {selectedPatients.length > 0 && selectedPatient && <>
          <div className="dropdown-container">
            <DropdownButton id="dropdown-record" title={`Patient: ${selectedPatient.patient.given} ${selectedPatient.patient.name}`} onSelect={handleRecordChange} className="dropdown-button">
              {selectedPatients.map(record => (
                <Dropdown.Item key={record._id} eventKey={record._id} active={selectedPatient && selectedPatient._id === record._id}>
                  {record.patient.given} {record.patient.name}
                </Dropdown.Item>
              ))}
            </DropdownButton>
          </div>
          <div className="dropdown-container">
            <DropdownButton id="dropdown-mode" title={`Mode: ${mode}`} onSelect={handleModeChange} className="dropdown-button">
              <Dropdown.Item eventKey="ipsurl">IPS URL</Dropdown.Item>
              <Dropdown.Item eventKey="ips">IPS JSON Bundle</Dropdown.Item>
              <Dropdown.Item eventKey="ipsbasic">IPS Minimal</Dropdown.Item>
              <Dropdown.Item eventKey="ipsmongo">IPS MongoDB</Dropdown.Item>
              <Dropdown.Item eventKey="ipslegacy">IPS Legacy JSON Bundle</Dropdown.Item>
              <Dropdown.Item eventKey="ipsbeer">IPS BEER (newline)</Dropdown.Item>
              <Dropdown.Item eventKey="ipsbeerwithdelim">IPS BEER with Delimiter (pipe |)</Dropdown.Item>
              <Dropdown.Item eventKey="ipshl728">IPS HL7 v2.8</Dropdown.Item>
            </DropdownButton>
          </div>
        </>}
        {showNotification ? (
          <Alert variant="danger">Data is too large to display. Please try a different mode.</Alert>
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
