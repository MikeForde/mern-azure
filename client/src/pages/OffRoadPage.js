// src/IPSFormPage.js
import React, { useState } from 'react';
import axios from 'axios';
import { Form, Button, Container, Row, Col } from 'react-bootstrap';

const IPSOffRoadPage = () => {
  const [name, setName] = useState('');
  const [givenName, setGivenName] = useState('');
  const [responseData, setResponseData] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.get(
        `https://4202xiwc.offroadapps.dev:62444/Fhir/ips/json/${name}/${givenName}`
      );
      setResponseData(JSON.stringify(response.data, null, 2));
    } catch (error) {
      setResponseData(`Error: ${error.message}`);
    }
  };

  return (
    <Container className="mt-5">
      <Row className="justify-content-md-center">
        <Col md={6}>
          <h3>Fetch IPS Data</h3>
          <Form onSubmit={handleSubmit}>
            <Form.Group controlId="formName">
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group controlId="formGivenName">
              <Form.Label>Given Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter given name"
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                required
              />
            </Form.Group>

            <Button variant="primary" type="submit" className="mt-3">
              Submit
            </Button>
          </Form>

          <Form.Group controlId="formResponse" className="mt-4">
            <Form.Label>Response Data</Form.Label>
            <Form.Control
              as="textarea"
              rows={10}
              value={responseData}
              readOnly
              style={{ whiteSpace: 'pre-wrap' }}
            />
          </Form.Group>
        </Col>
      </Row>
    </Container>
  );
};

export default IPSOffRoadPage;
