import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileMedical, faHome, faQrcode, faUpload } from '@fortawesome/free-solid-svg-icons';
import { PatientContext } from '../PatientContext';

function NavigationBar() {
  const { selectedPatients } = useContext(PatientContext);

  return (
    <Navbar expand="lg" bg="dark" variant="dark" fixed="top">
      <Container>
        <Navbar.Brand as={Link} to="/">
          <img
            src="/ipsnavbar.ico"
            width="25"
            height="25"
            className="d-inline-block align-center"
            alt="IPS Logo"
            style={{ marginRight: '10px' }}
          />
          IPS MERN Prototype 0_18
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/"><FontAwesomeIcon icon={faHome} /> Home</Nav.Link>
            <Nav.Link as={Link} to="/api"><FontAwesomeIcon icon={faFileMedical} /> API</Nav.Link>
            <Nav.Link as={Link} to="/qr"><FontAwesomeIcon icon={faQrcode} /> QR Generators</Nav.Link>
            <Nav.Link as={Link} to="/bulkupload"><FontAwesomeIcon icon={faUpload} /> Bulk Upload</Nav.Link>
            <NavDropdown title="Info" id="basic-nav-dropdown">
              <NavDropdown.Item as={Link} to="/about">About IPS</NavDropdown.Item>
              <NavDropdown.Item as={Link} to="/aboutwebapp">About Web App</NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item as={Link} to="/changelog">Change Log</NavDropdown.Item>
            </NavDropdown>
          </Nav>
          {selectedPatients.length > 0 && (
            <Nav>
              <NavDropdown title="Selected Patients" id="selected-patients-dropdown">
                {selectedPatients.map((patient) => (
                  <NavDropdown.Item key={patient._id} as={Link} to={`/api/${patient._id}`}>
                    {patient.patient.name} {patient.patient.given}
                  </NavDropdown.Item>
                ))}
              </NavDropdown>
            </Nav>
          )}
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavigationBar;
