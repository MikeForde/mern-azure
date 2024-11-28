import React from 'react';
import { Table, Container } from 'react-bootstrap';

function APIDocumentationPage() {
  // Define the API endpoints information
  const apiEndpoints = [
    { method: 'POST', endpoint: '/ips', description: 'Create a new IPS record.', request: 'MongoDb JSON object representing the new IPS record.', response: 'MongoDb JSON object of the created IPS record.' },
    { method: 'POST', endpoint: '/ipsmany', description: 'Create multiple IPS records.', request: 'Array of MongoDb JSON objects representing the new IPS records', response: 'Array of MongoDb JSON objects of the created IPS records.' },
    { method: 'POST', endpoint: '/ipsbundle', description: 'Create IPS records from an IPS Bundle.', request: 'IPS Bundle - JSON', response: 'MongoDb - JSON as confirmation of record creation.' },
    { method: 'POST', endpoint: '/pushipsora', description: 'Push IPS data to an external ORA system.', request: 'IPS Bundle - JSON', response: 'Response from the ORA system.' },
    { method: 'POST', endpoint: '/pushipsnld', description: 'Push IPS data to an external NLD system.', request: 'IPS Bundle - JSON', response: 'Response from the NLD system.' },
    { method: 'POST', endpoint: '/ipsfrombeer', description: 'Create MongoDb IPS records from BEER format.', request: 'BEER - Plain Text', response: 'MongoDb - JSON as confirmation of record creation.' },
    { method: 'POST', endpoint: '/ipsfromcda', description: 'Create MongoDb IPS records from CDA XML format.', request: 'CDA - XML', response: 'MongoDb - JSON as confirmation of record creation.' },
    { method: 'POST', endpoint: '/convertmongo2beer', description: 'Convert MongoDB format to BEER format.', request: 'MongoDB - JSON', response: 'BEER - Plain Text' },
    { method: 'POST', endpoint: '/convertmongo2hl7', description: 'Convert MongoDB format to HL7 2.8 format.', request: 'MongoDB - JSON', response: 'HL7 2.8 - Plain Text' },
    { method: 'POST', endpoint: '/convertbeer2mongo', description: 'Convert BEER format to MongoDB format.', request: 'BEER - Plain Text', response: 'MongoDB - JSON' },
    { method: 'POST', endpoint: '/convertbeer2ips', description: 'Convert BEER format to IPS JSON format.', request: 'BEER - Plain Text', response: 'IPS Bundle - JSON' },
    { method: 'POST', endpoint: '/convertips2beer', description: 'Convert IPS JSON format to BEER format.', request: 'IPS Bundle - JSON', response: 'BEER - Plain Text' },
    { method: 'POST', endpoint: '/convertcdatoips', description: 'Convert CDA XML format to IPS JSON format.', request: 'CDA - XML', response: 'IPS Bundle - JSON' },
    { method: 'POST', endpoint: '/convertcdatobeer', description: 'Convert CDA XML format to BEER format.', request: 'CDA - XML', response: 'BEER - Plain Text' },
    { method: 'POST', endpoint: '/converthl728tomongo', description: 'Convert HL7 2.8 format to MongoDB format.', request: 'HL7 2.8 - Plain Text', response: 'MongoDB - JSON' },
    { method: 'POST', endpoint: '/converthl728toips', description: 'Convert HL7 2.8 format to IPS JSON format.', request: 'HL7 2.8 - Plain Text', response: 'IPS Bundle - JSON' },
    { method: 'GET', endpoint: '/ips/all', description: 'Retrieve all IPS records.', request: 'None.', response: 'Array of JSON objects representing IPS records.' },
    { method: 'GET', endpoint: '/ipsraw/:id', description: 'Retrieve raw IPS record by ID.', request: 'IPS record ID as URL parameter.', response: 'JSON object of the raw IPS record.' },
    { method: 'GET', endpoint: '/ipsmongo/:id', description: 'Retrieve IPS record in MongoDB format by ID.', request: 'IPS record ID as URL parameter.', response: 'MongoDB - JSON' },
    { method: 'GET', endpoint: '/ips/:id', description: 'Retrieve IPS record in default format by ID.', request: 'IPS record ID as URL parameter.', response: 'IPS record - JSON' },
    { method: 'GET', endpoint: '/ipsbasic/:id', description: 'Retrieve IPS record in basic format by ID.', request: 'IPS record ID as URL parameter.', response: 'Basic format - Plain Text' },
    { method: 'GET', endpoint: '/ipsbeer/:id/:delim?', description: 'Retrieve IPS record in BEER format by ID with optional delimiter.', request: 'IPS record ID and optional delimiter as URL parameters.', response: 'BEER - Plain Text' },
    { method: 'GET', endpoint: '/ipshl728/:id', description: 'Retrieve IPS record in HL7 2.8 format by ID.', request: 'IPS record ID as URL parameter.', response: 'HL7 2.8 - Plain Text' },
    { method: 'GET', endpoint: '/ipsxml/:id', description: 'Retrieve IPS record in XML format by ID.', request: 'IPS record ID as URL parameter.', response: 'IPS Bundle - XML' },
    { method: 'GET', endpoint: '/ipslegacy/:id', description: 'Retrieve IPS record in legacy format by ID.', request: 'IPS record ID as URL parameter.', response: 'Legacy format of the IPS record - JSON' },
    { method: 'GET', endpoint: '/ipsbyname/:name/:given', description: 'Retrieve IPS record by patient name and given name. Case insensitive.', request: 'Patient name and given name as URL parameters.', response: 'IPS Bundle - JSON' },
    { method: 'GET', endpoint: '/ips/search/:name', description: 'Search IPS records by patient name.', request: 'Patient name as URL parameter.', response: 'Array of JSON objects representing IPS records.' },
    { method: 'GET', endpoint: '/fetchipsora/:name/:givenName', description: 'Fetch IPS data from ORA by patient name and given name.', request: 'Patient name and given name as URL parameters.', response: 'JSON object from ORA system.' },
    { method: 'PUT', endpoint: '/ips/:id', description: 'Update an IPS record by ID.', request: 'Partial JSON object representing the updated IPS record.', response: 'MongoDB object of the updated IPS record - JSON' },
    { method: 'PUT', endpoint: '/ipsuuid/:uuid', description: 'Update an IPS record by UUID.', request: 'Partial JSON object representing the updated IPS record.', response: 'MongoDB object of the updated IPS record - JSON' },
    { method: 'DELETE', endpoint: '/ips/:id', description: 'Delete an IPS record by ID.', request: 'IPS record ID as URL parameter.', response: 'Confirmation of deletion.' },
  ];

  const encodingEncryptionInstructions = [
    {
      feature: 'Gzip Compression',
      incoming: (
        <>
          - Include the header <code>Content-Encoding: gzip</code> for incoming requests.
          <br />- Compress your payload using gzip before sending.
        </>
      ),
      outgoing: (
        <>
          - Include the header <code>Accept-Encoding: gzip</code> for responses.
          <br />- The response will be returned in gzip format if supported.
        </>
      ),
    },
    {
      feature: 'AES-256 Encryption',
      incoming: (
        <>
          - Include the header <code>X-Encrypted: true</code> for incoming requests.
          <br />- Encrypt your payload using AES-256 before sending.
        </>
      ),
      outgoing: (
        <>
          - Include the header <code>Accept-Encryption: aes256</code> for responses.
          <br />- The response will be encrypted using AES-256 if supported.
        </>
      ),
    },
    {
      feature: 'Combined',
      incoming: (
        <>
          - Use both <code>Content-Encoding: gzip</code> and <code>X-Encrypted: true</code>.
          <br />- Compress your payload with gzip first, then encrypt with AES-256.
        </>
      ),
      outgoing: (
        <>
          - Use both <code>Accept-Encoding: gzip</code> and <code>Accept-Encryption: aes256</code>.
          <br />- The response will first be compressed with gzip, then encrypted with AES-256.
        </>
      ),
    },
  ];

  return (
    <Container className="mt-5">
      <h2>API Documentation</h2>
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
            <th>Request</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          {apiEndpoints.map((endpoint, index) => (
            <tr key={index}>
              <td>{endpoint.method}</td>
              <td>{endpoint.endpoint}</td>
              <td>{endpoint.description}</td>
              <td>{endpoint.request}</td>
              <td>{endpoint.response}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <h3 className="mt-5">Encoding and Encryption Usage</h3>
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Instructions for Incoming Requests</th>
            <th>Instructions for Outgoing Responses</th>
          </tr>
        </thead>
        <tbody>
          {encodingEncryptionInstructions.map((row, index) => (
            <tr key={index}>
              <td>{row.feature}</td>
              <td>{row.incoming}</td>
              <td>{row.outgoing}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Container>
  );
}

export default APIDocumentationPage;
