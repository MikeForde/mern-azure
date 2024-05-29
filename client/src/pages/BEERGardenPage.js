import React, { useState, useEffect, useContext } from 'react';
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

  const handleRecordChange = (recordId) => {
    const record = selectedPatients.find(record => record._id === recordId);
    startLoading();
    setSelectedPatient(record);
  };

  useEffect(() => {
    if (selectedPatient) {
      const endpoint = `/ipsmongo/${selectedPatient._id}`;

      axios.get(endpoint)
        .then(response => {
          const responseData = JSON.stringify(response.data, null, 2);
          setMongoData(responseData);
          setShowNotification(false);
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
    startLoading();
    try {
      const response = await axios.post('/convertmongo2beer', { data: mongoData });
      setBeerData(response.data);
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
    try {
      const response = await axios.post('/convertbeer2mongo', { data: beerData });
      setMongoData(JSON.stringify(response.data, null, 2));
      setMessage('Successfully converted to MongoDB format');
      setShowNotification(false);
    } catch (error) {
      console.error('Error converting to MongoDB format:', error);
      setShowNotification(true);
    } finally {
      stopLoading();
    }
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
                <h5>MongoDB Format</h5>
                <Form.Control as="textarea" rows={10} value={mongoData} onChange={e => setMongoData(e.target.value)} />
                <Button className="mt-3" variant="primary" onClick={handleConvertToBEER}>Convert to BEER Format</Button>
              </div>
              <div className="text-area">
                <h5>BEER Format</h5>
                <Form.Control as="textarea" rows={10} value={beerData} onChange={e => setBeerData(e.target.value)} />
                <Button className="mt-3" variant="secondary" onClick={handleConvertToMongo}>Convert to MongoDB Format</Button>
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
