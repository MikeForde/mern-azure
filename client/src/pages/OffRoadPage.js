// src/IPSFormPage.js
import React, { useState } from 'react';
import axios from 'axios';
import { Form, Button, Container } from 'react-bootstrap';

const IPSOffRoadPage = () => {
  const [name, setName] = useState('');
  const [givenName, setGivenName] = useState('');
  const [ipsData, setIpsData] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.get(`/fetchipsora/${name}/${givenName}`);
      setIpsData(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch IPS data');
      setIpsData(null);
    }
  };

  const handleTransform = async () => {
    try {
      await axios.post('/ipsbundle', ipsData);
      setMessage('IPS record successfully transformed and saved to MongoDB');
      setError(null);
    } catch (err) {
      setMessage('');
      setError('Failed to transform IPS record');
    }
  };

  return (
    <div className="app">
      <div className="container">
      <h3>Off Road Apps API - GET (Pull)</h3>
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
        <Button variant="primary" type="submit">
          Submit
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
}

export default IPSOffRoadPage;
