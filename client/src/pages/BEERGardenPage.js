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
  const [selectedFormat, setSelectedFormat] = useState('IPS JSON');
  const [displayFormat, setDisplayFormat] = useState('IPS JSON');

  const handleRecordChange = (recordId) => {
    const record = selectedPatients.find(record => record._id === recordId);
    isConvertingRef.current = false;
    startLoading();
    setSelectedPatient(record);
  };

  useEffect(() => {
    if (selectedPatient && !isConvertingRef.current) {
      const endpoint = `/ips/${selectedPatient._id}`;

      axios.get(endpoint)
        .then(response => {
          const mongoSize = new TextEncoder().encode(JSON.stringify(response.data)).length;
          const responseData = JSON.stringify(response.data, null, 2);
          setMongoData(responseData);
          setShowNotification(false);
          setMongoSize(mongoSize);
          setDisplayFormat('IPS JSON');
          setMessage('');
          setBeerData('');
          setBEERSize(0);
        })
        .catch(error => {
          console.error('Error fetching IPS record:', error);
          setMessage('Error fetching IPS record');
          setShowNotification(true);
        })
        .finally(() => {
          stopLoading();
        });
    }
  }, [selectedPatient, stopLoading]);

  const handleConvertToBEERFromMongo = async () => {
    if (mongoData === '' || mongoData === '{}') { return; }
    console.log('mongoData:', mongoData);
    isConvertingRef.current = true;
    startLoading();
    try {
      const response = await axios.post('/convertmongo2beer', { data: mongoData });
      setBeerData(response.data);
      const beerSize = new TextEncoder().encode(response.data.trim()).length;
      setBEERSize(beerSize);
      setMessage('Successfully converted to BEER format');
      setShowNotification(false);
    } catch (error) {
      console.error('Error converting to BEER format from MongoDB:', error);
      setMessage('Error converting to BEER format from MongoDB');
      setShowNotification(true);
    } finally {
      stopLoading();
    }
  };

  const handleConvertToBEERFromIPS = () => {
    if (mongoData === '' || mongoData === '{}') { return; }
    isConvertingRef.current = true;
    startLoading();
    const endpoint = '/convertips2beer';
    axios.post(endpoint, { data: mongoData })
      .then(response => {
        setBeerData(response.data); 
        const beerSize = new TextEncoder().encode(response.data.trim()).length;
        setBEERSize(beerSize);
        setMessage('Successfully converted to BEER format');
        setShowNotification(false);
      })
      .catch(error => {
        console.error('Error converting to BEER format from IPS JSON:', error);
        setMessage('Error converting to BEER format from IPS JSON');
        setShowNotification(true);
      })
      .finally(() => {
        stopLoading();
      });
  };

  const handleConvertToMongo = async () => {
    if (beerData === '' || beerData === '{}') { return; }
    startLoading();
    isConvertingRef.current = true; // Set the converting flag
    try {
      const response = await axios.post('/convertbeer2mongo', { data: beerData });
      setMongoData(JSON.stringify(response.data, null, 2));
      const mongoSize = new TextEncoder().encode(JSON.stringify(response.data)).length;
      setMongoSize(mongoSize);
      const beerSize = new TextEncoder().encode(beerData.trim()).length;
      setBEERSize(beerSize);
      setMessage('Successfully converted to MongoDB format');
      setDisplayFormat('MongoDB');
      setShowNotification(false);
    } catch (error) {
      console.error('Error converting to MongoDB format:', error);
      setMessage('Error converting to MongoDB format');
      setShowNotification(true);
    } finally {
      stopLoading();
    }
  };

  const handleConvertToIPS = async () => {
    if (beerData === '' || beerData === '{}') { return; }
    startLoading();
    isConvertingRef.current = true; // Set the converting flag
    try {
      const response = await axios.post('/convertbeer2ips', { data: beerData });
      setMongoData(JSON.stringify(response.data, null, 2));
      const mongoSize = new TextEncoder().encode(JSON.stringify(response.data)).length;
      setMongoSize(mongoSize);
      const beerSize = new TextEncoder().encode(beerData.trim()).length;
      setBEERSize(beerSize);
      setMessage('Successfully converted to IPS JSON format');
      setDisplayFormat('IPS JSON');
      setShowNotification(false);
    } catch (error) {
      console.error('Error converting to IPS JSON format:', error);
      setMessage('Error converting to IPS JSON format');
      setShowNotification(true);
    } finally {
      stopLoading();
    }
  };

  const handleFormatChange = (format) => {
    setSelectedFormat(format);
    setDisplayFormat(format);
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
        {showNotification && !message && (
          <Alert variant="danger">Error processing data. Please try again.</Alert>
        )}
        <div className="text-area-container">
          <div className="text-area">
            <h5>{`Format: ${displayFormat} - ${mongoSize} bytes`}</h5>
            <Form.Control as="textarea" rows={10} value={mongoData} onChange={e => setMongoData(e.target.value)} />
            <Button className="mt-3" variant="secondary" onClick={selectedFormat === 'MongoDB' ? handleConvertToBEERFromMongo : handleConvertToBEERFromIPS}>
              Convert to BEER Format
            </Button>
          </div>
          <div className="text-area">
            <h5>BEER Format - {beerSize} bytes</h5>
            <Form.Control as="textarea" rows={10} value={beerData} onChange={e => setBeerData(e.target.value)} />
            <DropdownButton
              id="dropdown-format"
              title={`Conversion Mode: ${selectedFormat}`}
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
          {message && <Alert variant={showNotification ? "danger" : "success"} className="message">{message}</Alert>}
        </div>
      </div>
    </div>
  );
}

export default BEERGardenPage;
