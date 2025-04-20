import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Button, Alert, Form, DropdownButton, Dropdown, Toast, ToastContainer } from 'react-bootstrap';
import './Page.css';
import { PatientContext } from '../PatientContext';
import { useLoading } from '../contexts/LoadingContext';

function APIGETPage() {
  const { selectedPatients, selectedPatient, setSelectedPatient } = useContext(PatientContext);
  const { startLoading, stopLoading } = useLoading();
  const [data, setData] = useState('');
  const [mode, setMode] = useState('ipsunified');
  const [modeText, setModeText] = useState('IPS Unified JSON Bundle - /ipsunified/:id');
  const [showNotification, setShowNotification] = useState(false);
  const [responseSize, setResponseSize] = useState(0);
  const [useCompressionAndEncryption, setUseCompressionAndEncryption] = useState(false);
  const [useIncludeKey, setUseIncludeKey] = useState(false);
  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVariant, setToastVariant] = useState('info');
  const [isWriting, setIsWriting] = useState(false);



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
          } else if (mode === 'ipsbasic' || mode === 'ipsbeer' || mode === 'ipsbeerwithdelim' || mode === 'ipshl72x') {
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
  }, [selectedPatient, mode, useCompressionAndEncryption, stopLoading, startLoading, useIncludeKey]);

  const handleDownloadData = () => {
    const blob = new Blob([data], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'ips_data.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleModeChange = (selectedMode) => {
    startLoading();
    setMode(selectedMode);
    switch (selectedMode) {
      case 'ips':
        setModeText('IPS Prev JSON Bundle - /ips/:id or /ipsbyname/:name/:given');
        break;
      case 'ipsxml':
        setModeText('IPS Prev XML Bundle - /ipsxml/:id');
        break;
      case 'ipslegacy':
        setModeText('IPS Legacy JSON Bundle - /ipslegacy/:id');
        break;
      case 'ipsunified':
        setModeText('IPS Unified JSON Bundle - /ipsunified/:id');
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
      default:
        setModeText('IPS Unified JSON Bundle - /ipsunified/:id');
    }
  };

  const formatXML = (xml) => {
    const formatted = xml.replace(/></g, '>\n<');
    return formatted;
  };

  const handleWriteToNfc = async () => {
    if (!('NDEFReader' in window)) {
      setToastMsg('Web NFC is not supported on this device/browser.');
      setToastVariant('warning');
      setShowToast(true);
      return;
    }

    setIsWriting(true);
    try {
      const writer = new window.NDEFReader();
      await writer.write(data);
      console.log('Data written to NFC tag:', data);
      setToastMsg('Data written to NFC tag!');
      setToastVariant('success');
    } catch (error) {
      console.error('Error writing to NFC:', error);
      setToastMsg(`Error - possible tag capacity: ${error.message}`);
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
          <div className="noteFont">
            - /:id - packageUUID / internal MongoDB _id
          </div>
        </h3>
        {selectedPatients.length > 0 && selectedPatient && (
          <>
            <div className="dropdown-container">
              <DropdownButton
                id="dropdown-record"
                title={`Patient: ${selectedPatient.patient.given} ${selectedPatient.patient.name}`}
                onSelect={handleRecordChange}
                className="dropdown-button"
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
            <div className="dropdown-container">
              <DropdownButton
                id="dropdown-mode"
                title={`API: ${modeText}`}
                onSelect={handleModeChange}
                className="dropdown-button"
              >
                <Dropdown.Item eventKey="ipsunified">IPS Unified JSON Bundle - /ipsunified/:id</Dropdown.Item>
                <Dropdown.Item eventKey="ipshl72x">IPS HL7 2.3 - /ipshl72x/:id</Dropdown.Item>
                <Dropdown.Item eventKey="ipsmongo">IPS NoSQL - /ipsmongo/:id</Dropdown.Item>
                <Dropdown.Item eventKey="ipsbeer">IPS BEER - /ipsbeer/:id</Dropdown.Item>
                <Dropdown.Item eventKey="ipsbeerwithdelim">IPS BEER - /ipsbeer/:id/pipe</Dropdown.Item>
                <Dropdown.Item eventKey="ipsbasic">IPS Minimal - /ipsbasic/:id</Dropdown.Item>
                <Dropdown.Item eventKey="ips">IPS Prev JSON Bundle - /ips/:id or /ipsbyname/:name/:given</Dropdown.Item>
                <Dropdown.Item eventKey="ipsxml">IPS Prev XML Bundle - /ipsxml/:id</Dropdown.Item>
                <Dropdown.Item eventKey="ipslegacy">IPS Legacy JSON Bundle - /ipslegacy/:id</Dropdown.Item>
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
                Gzip + Encrypt (aes256 base64)
              </label>
            </div>
            <div className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="includeKey"
                checked={useIncludeKey}
                onChange={(e) => setUseIncludeKey(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="includeKey">
                Include key in response
              </label>
            </div>
          </>
        )}
        {showNotification ? (
          <Alert variant="danger">Data is too large to display. Please try a different mode.</Alert>
        ) : (
          <div className="text-area">
            <Form.Control as="textarea" rows={10} value={data} readOnly />
          </div>
        )}
        <br />
        <div className="button-container">
          <Button className="mb-3" onClick={handleDownloadData}
            disabled={!data}>
            Download Data
          </Button>
          {mode === 'ips' && (
            <Button
              variant="primary"
              className="mb-3 ml-2"
              onClick={() => window.open('https://ipsviewer.com', '_blank')}
              disabled={!data}
            >
              Open IPS Viewer
            </Button>
          )}
          <Button
            variant={isWriting ? 'dark' : 'primary'}
            className="mb-3 ml-2"
            onClick={handleWriteToNfc}
            disabled={!data || isWriting}
          >
            {isWriting ? 'Waiting...' : 'Write to NFC'}
          </Button>
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
