import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Button, Alert, Form, DropdownButton, Dropdown } from 'react-bootstrap';
import './Page.css';
import { PatientContext } from '../PatientContext';

function OffRoadPOSTPage() {
  const { selectedPatients, selectedPatient, setSelectedPatient } = useContext(PatientContext);
  const [data, setData] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [message, setMessage] = useState('');

  const handleRecordChange = (recordId) => {
    const record = selectedPatients.find(record => record._id === recordId);
    setSelectedPatient(record);
  };

  useEffect(() => {
    if (selectedPatient) {
      const endpoint = `/ips/${selectedPatient._id}`;

      axios.get(endpoint)
        .then(response => {
          const responseData = JSON.stringify(response.data, null, 2);
          setData(responseData);
          console.log('Data:', responseData);
          setShowNotification(false);
        })
        .catch(error => {
          console.error('Error fetching IPS record:', error);
        });
    }
  }, [selectedPatient]);

  const handlePushIPS = async () => {
    try {
      const ipsData = JSON.parse(data);
      await axios.post('/pushipsora', ipsData);
      setMessage('IPS data successfully pushed to the external server');
      setShowNotification(false);
    } catch (error) {
      console.error('Error pushing IPS data:', error);
      setShowNotification(true);
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h3>VitalsIQ API Page - POST (Push)</h3>
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
          <Alert variant="danger">Error pushing IPS data. Please try again.</Alert>
        ) : (
          <div className="text-area">
            <Form.Control as="textarea" rows={10} value={data} readOnly />
          </div>
        )}
        <br />
        {message && <Alert variant="success">{message}</Alert>}
        <div className="button-container">
          {selectedPatient && data && (
            <Button className="mb-3" variant="danger" onClick={handlePushIPS}>Push IPS JSON Data to VitalsIQ WebApp</Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OffRoadPOSTPage;
