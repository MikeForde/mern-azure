import React from 'react';
import { Table, Container } from 'react-bootstrap';

function APIDocumentationPage() {
  // Define the API endpoints information
  const apiEndpoints = [
    {
      method: 'POST',
      endpoint: '/ips',
      description: 'Create a new IPS record.',
      request: 'MongoDb JSON object representing the new IPS record.',
      response: 'MongoDb JSON object of the created IPS record.'
    },
    {
      method: 'POST',
      endpoint: '/ipsmany',
      description: 'Create multiple IPS records.',
      request: 'Array of MongoDb JSON objects representing the new IPS records.',
      response: 'Array of MongoDb JSON objects of the created IPS records.'
    },
    {
      method: 'POST',
      endpoint: '/ipsbundle',
      description: 'Create IPS records from an IPS Bundle.',
      request: 'IPS Bundle in JSON format.',
      response: 'Confirmation of the creation of IPS records.'
    },
    {
      method: 'POST',
      endpoint: '/pushipsora',
      description: 'Push IPS data to an external ORA system.',
      request: 'IPS Bundle in JSON format.',
      response: 'Response from the ORA system.'
    },
    {
      method: 'POST',
      endpoint: '/pushipsnld',
      description: 'Push IPS data to an external NLD system.',
      request: 'IPS Bundle in JSON format.',
      response: 'Response from the NLD system.'
    },
    {
      method: 'POST',
      endpoint: '/ipsfrombeer',
      description: 'Create MongoDb IPS records from BEER format.',
      request: 'BEER format string.',
      response: 'Confirmation of the creation of MongoDb IPS records.'
    },
    {
      method: 'POST',
      endpoint: '/ipsfromcda',
      description: 'Create MongoDb IPS records from CDA XML format.',
      request: 'CDA XML string.',
      response: 'Confirmation of the creation of MongoDb IPS records.'
    },
    {
      method: 'POST',
      endpoint: '/convertmongo2beer',
      description: 'Convert MongoDB format to BEER format.',
      request: 'MongoDB format JSON string.',
      response: 'BEER format string.'
    },
    {
      method: 'POST',
      endpoint: '/convertbeer2mongo',
      description: 'Convert BEER format to MongoDB format.',
      request: 'BEER format string.',
      response: 'MongoDB format JSON string.'
    },
    {
      method: 'POST',
      endpoint: '/convertbeer2ips',
      description: 'Convert BEER format to IPS JSON format.',
      request: 'BEER format string.',
      response: 'IPS JSON format string.'
    },
    {
      method: 'POST',
      endpoint: '/convertips2beer',
      description: 'Convert IPS JSON format to BEER format.',
      request: 'IPS JSON format string.',
      response: 'BEER format string.'
    },
    {
      method: 'POST',
      endpoint: '/convertcdatoips',
      description: 'Convert CDA XML format to IPS JSON format.',
      request: 'CDA XML string.',
      response: 'IPS JSON format string.'
    },
    {
      method: 'POST',
      endpoint: '/convertcdatobeer',
      description: 'Convert CDA XML format to BEER format.',
      request: 'CDA XML string.',
      response: 'BEER format string.'
    },
    {
      method: 'POST',
      endpoint: '/convertmongo2hl7',
      description: 'Convert MongoDB format to HL7 2.8 format.',
      request: 'MongoDB format JSON string.',
      response: 'HL7 2.8 format string.'
    },
    {
      method: 'GET',
      endpoint: '/ips/all',
      description: 'Retrieve all IPS records.',
      request: 'None.',
      response: 'Array of JSON objects representing IPS records.'
    },
    {
      method: 'GET',
      endpoint: '/ipsraw/:id',
      description: 'Retrieve raw IPS record by ID.',
      request: 'IPS record ID as URL parameter.',
      response: 'JSON object of the raw IPS record.'
    },
    {
      method: 'GET',
      endpoint: '/ipsmongo/:id',
      description: 'Retrieve IPS record in MongoDB format by ID.',
      request: 'IPS record ID as URL parameter.',
      response: 'MongoDB format JSON object of the IPS record.'
    },
    {
      method: 'GET',
      endpoint: '/ips/:id',
      description: 'Retrieve IPS record in default format by ID.',
      request: 'IPS record ID as URL parameter.',
      response: 'JSON object of the IPS record in default format.'
    },
    {
      method: 'GET',
      endpoint: '/ipsbasic/:id',
      description: 'Retrieve IPS record in basic format by ID.',
      request: 'IPS record ID as URL parameter.',
      response: 'JSON object of the IPS record in basic format.'
    },
    {
      method: 'GET',
      endpoint: '/ipsbeer/:id/:delim?',
      description: 'Retrieve IPS record in BEER format by ID.',
      request: 'IPS record ID and optional delimiter as URL parameters. If delimiter not stated, all delimiters will be tried before giving up',
      response: 'BEER format string of the IPS record.'
    },
    {
      method: 'GET',
      endpoint: '/ipshl728/:id',
      description: 'Retrieve IPS record in HL7 2.8 format by ID.',
      request: 'IPS record ID as URL parameter.',
      response: 'HL7 2.8 format string of the IPS record.'
    },
    {
      method: 'GET',
      endpoint: '/ipsurl/:id',
      description: 'Retrieve IPS record in URL format by ID.',
      request: 'IPS record ID as URL parameter.',
      response: 'URL string of the IPS record.'
    },
    {
      method: 'GET',
      endpoint: '/ipsora/:id',
      description: 'Retrieve IPS record in ORA format by ID.',
      request: 'IPS record ID as URL parameter.',
      response: 'JSON object of the IPS record.'
    },
    {
      method: 'GET',
      endpoint: '/ipsxml/:id',
      description: 'Retrieve IPS record in XML format by ID.',
      request: 'IPS record ID as URL parameter.',
      response: 'XML string of the IPS record.'
    },
    {
      method: 'GET',
      endpoint: '/ipslegacy/:id',
      description: 'Retrieve IPS record in legacy format by ID.',
      request: 'IPS record ID as URL parameter.',
      response: 'Legacy format JSON object of the IPS record.'
    },
    {
      method: 'GET',
      endpoint: '/ipsbyname/:name/:given',
      description: 'Retrieve IPS record by patient name and given name. Case insensitive.',
      request: 'Patient name and given name as URL parameters.',
      response: 'JSON object of the IPS record.'
    },
    {
      method: 'GET',
      endpoint: '/ips/search/:name',
      description: 'Search IPS records by patient name.',
      request: 'Patient name as URL parameter.',
      response: 'Array of JSON objects representing IPS records.'
    },
    {
      method: 'GET',
      endpoint: '/fetchipsora/:name/:givenName',
      description: 'Fetch IPS data from ORA by patient name and given name.',
      request: 'Patient name and given name as URL parameters.',
      response: 'JSON object from ORA system.'
    },
    {
      method: 'PUT',
      endpoint: '/ips/:id',
      description: 'Update an IPS record by ID.',
      request: 'Partial JSON object representing the updated IPS record.',
      response: 'JSON object of the updated IPS record.'
    },
    {
      method: 'PUT',
      endpoint: '/ipsuuid/:uuid',
      description: 'Update an IPS record by UUID.',
      request: 'Partial JSON object representing the updated IPS record.',
      response: 'JSON object of the updated IPS record.'
    },
    {
      method: 'DELETE',
      endpoint: '/ips/:id',
      description: 'Delete an IPS record by ID.',
      request: 'IPS record ID as URL parameter.',
      response: 'Confirmation of deletion.'
    }
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
    </Container>
  );
}

export default APIDocumentationPage;
