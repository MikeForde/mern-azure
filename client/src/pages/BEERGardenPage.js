import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { Button, Alert, Form, DropdownButton, Dropdown } from 'react-bootstrap';
import './Page.css';
import { PatientContext } from '../PatientContext';
import { useLoading } from '../contexts/LoadingContext';

function BEERGardenPage() {
  const { selectedPatients, selectedPatient, setSelectedPatient } = useContext(PatientContext);
  const [mongoData, setMongoData] = useState('');
  const [beerData, setBeerData] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [message, setMessage] = useState('');
  const { startLoading, stopLoading } = useLoading();
  const isConvertingRef = useRef(false);
  const [mongoSize, setMongoSize] = useState(0);
  const [beerSize, setBEERSize] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState('MongoDB');
  const [displayFormat, setDisplayFormat] = useState('MongoDB');

  const handleRecordChange = (recordId) => {
    const record = selectedPatients.find(record => record._id === recordId);
    isConvertingRef.current = false;
    startLoading();
    setSelectedPatient(record);
  };

  useEffect(() => {
    if (selectedPatient && !isConvertingRef.current) {
      const endpoint = `/ipsmongo/${selectedPatient._id}`;

      axios.get(endpoint)
        .then(response => {
          const mongoSize = new TextEncoder().encode(JSON.stringify(response.data)).length;
          const responseData = JSON.stringify(response.data, null, 2);
          setMongoData(responseData);
          setShowNotification(false);
          setMongoSize(mongoSize);
          setDisplayFormat('MongoDB');
          setBeerData('');
          setBEERSize(0);
        })
        .catch(error => {
          console.error('Error fetching IPS record:', error);
        })
        .finally(() => {
          stopLoading();
        });
    }
  }, [selectedPatient, stopLoading]);

  const handleConvertToBEER = async () => {
    isConvertingRef.current = true;
    startLoading();
    try {
      const response = await axios.post('/convertmongo2beer', { data: mongoData });
      setBeerData(response.data);
      const beerSize = new TextEncoder().encode(response.data).length;
      setBEERSize(beerSize);
      setMessage('Successfully converted to BEER format');
      setShowNotification(false);
    } catch (error) {
      console.error('Error converting to BEER format:', error);
      setShowNotification(true);
    } finally {
      stopLoading();
    }
  };

  const handleConvertToMongo = async () => {
    startLoading();
    isConvertingRef.current = true; // Set the converting flag
    try {
      const response = await axios.post('/convertbeer2mongo', { data: beerData });
      setMongoData(JSON.stringify(response.data, null, 2));
      const mongoSize = new TextEncoder().encode(JSON.stringify(response.data)).length;
      setMongoSize(mongoSize);
      const beerSize = new TextEncoder().encode(beerData).length;
      setBEERSize(beerSize);
      setMessage('Successfully converted to MongoDB format');
      setDisplayFormat('MongoDB');
      setShowNotification(false);
    } catch (error) {
      console.error('Error converting to MongoDB format:', error);
      setShowNotification(true);
    } finally {
      stopLoading();
    }
  };

  const handleConvertToIPS = async () => {
    startLoading();
    isConvertingRef.current = true; // Set the converting flag
    try {
      const response = await axios.post('/convertbeer2ips', { data: beerData });
      setMongoData(JSON.stringify(response.data, null, 2));
      const mongoSize = new TextEncoder().encode(JSON.stringify(response.data)).length;
      setMongoSize(mongoSize);
      const beerSize = new TextEncoder().encode(beerData).length;
      setBEERSize(beerSize);
      setMessage('Successfully converted to IPS JSON format');
      setDisplayFormat('IPS JSON');
      setShowNotification(false);
    } catch (error) {
      console.error('Error converting to IPS JSON format:', error);
      setShowNotification(true);
    } finally {
      stopLoading();
    }
  };

  const handleFormatChange = (format) => {
    setSelectedFormat(format);
  };

  return (
    <div className="app">
      <div className="container">
        <h3>BEER <div className="noteFont">(Basic Emergency Exchange Record)</div></h3>
        {selectedPatients.length > 0 && selectedPatient && (
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
        )}
        {showNotification ? (
          <Alert variant="danger">Error processing data. Please try again.</Alert>
        ) : (
          <>
            <div className="text-area-container">
              <div className="text-area">
                <h5>{displayFormat} Format - {mongoSize} bytes</h5>
                <Form.Control as="textarea" rows={10} value={mongoData} onChange={e => setMongoData(e.target.value)} />
                {displayFormat === 'MongoDB' && (
                  <Button className="mt-3" variant="primary" onClick={handleConvertToBEER}>Convert to BEER Format</Button>
                )}
              </div>
              <div className="text-area">
                <h5>BEER Format - {beerSize} bytes</h5>
                <Form.Control as="textarea" rows={10} value={beerData} onChange={e => setBeerData(e.target.value)} />
                <DropdownButton
                  id="dropdown-format"
                  title={`Convert to ${selectedFormat}`}
                  onSelect={handleFormatChange}
                  className="mt-3"
                >
                  <Dropdown.Item eventKey="MongoDB">MongoDB</Dropdown.Item>
                  <Dropdown.Item eventKey="IPS JSON">IPS JSON</Dropdown.Item>
                </DropdownButton>
                <Button className="mt-3" variant="secondary" onClick={selectedFormat === 'MongoDB' ? handleConvertToMongo : handleConvertToIPS}>
                  Convert to {selectedFormat} Format
                </Button>
              </div>
            </div>
            <div>
              {message && <Alert variant="success" className="message">{message}</Alert>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default BEERGardenPage;
