import React, { useState } from 'react';
import axios from 'axios';
import { Form, Button, DropdownButton, Dropdown } from 'react-bootstrap';
import { useLoading } from '../contexts/LoadingContext';

const UnifiedIPSGetPage = () => {
  const [name, setName] = useState('');
  const [givenName, setGivenName] = useState('');
  const [ipsData, setIpsData] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const { startLoading, stopLoading } = useLoading();

  // New state variables for target selection and endpoint
  const [target, setTarget] = useState('IPS SERN'); // Default target
  const [endpoint, setEndpoint] = useState('https://ips-d2s-uksc-medsnomed-medsno.apps.ocp1.azure.dso.digital.mod.uk/ipsbyname');

  const handleTargetChange = (selectedTarget) => {
    setTarget(selectedTarget);
    if (selectedTarget === 'VitalsIQ') {
      setEndpoint('https://4202xiwc.offroadapps.dev:62444/Fhir/ips/json');
    } else if (selectedTarget === 'IPS SERN') {
      setEndpoint('https://ips-d2s-uksc-medsnomed-medsno.apps.ocp1.azure.dso.digital.mod.uk/ipsbyname');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    startLoading();
    try {
      // Call our generic backend GET endpoint passing the current endpoint, name, and givenName as query parameters.
      const response = await axios.get('/fetchips', {
        params: { endpoint, name, givenName }
      });
      setIpsData(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch IPS data');
      setIpsData(null);
    } finally {
      stopLoading();
    }
  };

  const handleTransform = async () => {
    try {
      await axios.post('/ipsbundle', ipsData);
      setMessage('IPS record successfully transformed and saved to MongoDB');
      setError(null);
    } catch (err) {
      setMessage(err.message);
      setError('Failed to transform IPS record');
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h3>External IPS API - GET (Pull)</h3>
        <Form onSubmit={handleSubmit}>
          <Form.Group controlId="name">
            <Form.Control
              type="text"
              placeholder="Family/Surname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group controlId="givenName">
            <Form.Control
              type="text"
              placeholder="First/Given Name"
              value={givenName}
              onChange={(e) => setGivenName(e.target.value)}
              required
            />
          </Form.Group>

          {/* Target Endpoint Dropdown */}
          <div className="dropdown-container mb-2">
            <DropdownButton
              id="dropdown-target-get"
              title={`Target Endpoint: ${target}`}
              onSelect={handleTargetChange}
              className="dropdown-button"
            >
              <Dropdown.Item eventKey="IPS SERN" active={target === 'IPS SERN'}>
                IPS SERN
              </Dropdown.Item>
              <Dropdown.Item eventKey="VitalsIQ" active={target === 'VitalsIQ'}>
                VitalsIQ
              </Dropdown.Item>
            </DropdownButton>
          </div>

          {/* Editable Endpoint Field */}
          <Form.Group controlId="endpointInput" className="mb-2">
            <Form.Label>Endpoint</Form.Label>
            <Form.Control
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
            />
          </Form.Group>

          <Button variant="primary" type="submit">
            Submit GET Request
          </Button>
        </Form>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {ipsData && (
          <div>
            <h4>IPS Data</h4>
            <div className="text-area">
              <Form.Control as="textarea" rows={10} value={JSON.stringify(ipsData, null, 2)} readOnly />
            </div>
            <Button variant="success" onClick={handleTransform}>
              Transform to IPS MERN Record
            </Button>
          </div>
        )}
        {message && <p style={{ color: 'green' }}>{message}</p>}
      </div>
    </div>
  );
};

export default UnifiedIPSGetPage;
