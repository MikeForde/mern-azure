import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode.react';
import axios from 'axios';
import { Button, Alert, DropdownButton, Dropdown } from 'react-bootstrap';
import './Page.css';
import { PatientContext } from '../PatientContext';

function QRPage() {
  const { id } = useParams();
  const { selectedPatients, selectedPatient, setSelectedPatient } = useContext(PatientContext);
  const [qrData, setQRData] = useState('');
  const [mode, setMode] = useState('ipsurl');
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (selectedPatients.length > 0) {
      let record;
      if (id) {
        record = selectedPatients.find(record => record._id === id);
      } else {
        record = selectedPatient || selectedPatients[0]; // Use selected patient or the first one
      }
      setSelectedPatient(record);
    }
  }, [id, selectedPatients, selectedPatient, setSelectedPatient]);

  const handleRecordChange = (recordId) => {
    const record = selectedPatients.find(record => record._id === recordId);
    setSelectedPatient(record);
  };

  const THRESHOLD = 3000;

  useEffect(() => {
    if (selectedPatient) {
      let endpoint;
      if (mode === 'ips') {
        endpoint = `/ips/${selectedPatient._id}`;
      } else if (mode === 'ipsraw') {
        endpoint = `/ipsraw/${selectedPatient._id}`;
      } else if (mode === 'ipsminimal') {
        endpoint = `/ipsbasic/${selectedPatient._id}`;
      }

      if (mode === 'ipsurl') {
        const baseUrl = window.location.origin; // Get the base URL of the application
        const url = `${baseUrl}/ips/${selectedPatient._id}`;
        setQRData(url);
        setShowNotification(false);
      } else {
        axios.get(endpoint)
          .then(response => {
            let responseData;
            if (mode === 'ipsminimal') {
              responseData = response.data;
            } else {
              responseData = JSON.stringify(response.data);
            }

            console.log('Response data length:', responseData.length);

            if (responseData.length > THRESHOLD) {
              setShowNotification(true);
            } else {
              setQRData(responseData);
              console.log('QR Data:', responseData);
              setShowNotification(false);
            }
          })
          .catch(error => {
            console.error('Error fetching IPS record:', error);
          });
      }
    }
  }, [selectedPatient, mode]);

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
    setMode(selectedMode);
  };

  const maxQRSize = 600; // QR code canvas Max Size

  const qrSize = Math.min(window.innerWidth * 0.8, window.innerHeight * 0.8, maxQRSize);

  return (
    <div className="app">
      <div className="container">
        <h3>Generate QR Code</h3>
        <div className="dropdown-container">
          <DropdownButton id="dropdown-record" title="Select Record" onSelect={handleRecordChange} className="dropdown-button">
            {selectedPatients.map(record => (
              <Dropdown.Item key={record._id} eventKey={record._id} active={selectedPatient && selectedPatient._id === record._id}>
                {record.patient.name} {record.patient.given}
              </Dropdown.Item>
            ))}
          </DropdownButton>
        </div>
        <div className="dropdown-container">
          <DropdownButton id="dropdown-mode" title={`Select Mode: ${mode}`} onSelect={handleModeChange} className="dropdown-button">
            <Dropdown.Item eventKey="ipsurl">IPS URL</Dropdown.Item>
            <Dropdown.Item eventKey="ips">IPS JSON Bundle</Dropdown.Item>
            <Dropdown.Item eventKey="ipsminimal">IPS Minimal</Dropdown.Item>
            <Dropdown.Item eventKey="ipsraw">IPS MongoDB Record</Dropdown.Item>
          </DropdownButton>
        </div>
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
