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
    <Container>
      <h1>Off Road Apps API - GET (Pull)</h1>
      <Form onSubmit={handleSubmit}>
        <Form.Group controlId="name">
          <Form.Label>Name</Form.Label>
          <Form.Control
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Form.Group>
        <Form.Group controlId="givenName">
          <Form.Label>Given Name</Form.Label>
          <Form.Control
            type="text"
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
          <h3>IPS Data</h3>
          <textarea
            readOnly
            value={JSON.stringify(ipsData, null, 2)}
            style={{ width: '100%', height: '300px' }}
          />
          <Button variant="success" onClick={handleTransform}>
            Transform to MongoDB Record
          </Button>
        </div>
      )}
      {message && <p style={{ color: 'green' }}>{message}</p>}
    </Container>
  );
}

export default IPSOffRoadPage;
