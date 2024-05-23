import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBeer, faDownload, faFileMedical, faHome, faQrcode, faUpload } from '@fortawesome/free-solid-svg-icons';
import { PatientContext } from '../PatientContext';

function NavigationBar() {
  const { selectedPatients, setSelectedPatient, selectedPatient } = useContext(PatientContext);
  const [expanded, setExpanded] = useState(false);

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setExpanded(false); // Collapse Navbar on patient select
  };

  const handleNavItemSelect = () => {
    setExpanded(false); // Collapse Navbar on any item select
  };

  return (
    <Navbar expanded={expanded} expand="lg" bg="dark" variant="dark" fixed="top">
      <Container>
        <Navbar.Brand as={Link} to="/" onClick={handleNavItemSelect}>
          <img
            src="/ipsnavbar.ico"
            width="25"
            height="25"
            className="d-inline-block align-center"
            alt="IPS Logo"
            style={{ marginRight: '10px' }}
          />
          IPS MERN Prototype 0_23
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" onClick={() => setExpanded(!expanded)} />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/" onClick={handleNavItemSelect}>
              <FontAwesomeIcon icon={faHome} /> Home
            </Nav.Link>
            <Nav.Link as={Link} to="/api" onClick={handleNavItemSelect}>
              <FontAwesomeIcon icon={faFileMedical} /> API
            </Nav.Link>
            <Nav.Link as={Link} to="/qr" onClick={handleNavItemSelect}>
              <FontAwesomeIcon icon={faQrcode} /> QR Generators
            </Nav.Link>
            <Nav.Link as={Link} to="/bulkupload" onClick={handleNavItemSelect}>
              <FontAwesomeIcon icon={faUpload} /> Bulk Upload
            </Nav.Link>
            <NavDropdown
              title={<span><FontAwesomeIcon icon={faBeer} /> Off Road Apps</span>}
              id="basic-nav-dropdown"
            >
              <NavDropdown.Item as={Link} to="/ipsoffroad" onClick={handleNavItemSelect}>
                <FontAwesomeIcon icon={faUpload} /> Off Road GET
              </NavDropdown.Item>
              <NavDropdown.Item as={Link} to="/offroadpost" onClick={handleNavItemSelect}>
                <FontAwesomeIcon icon={faDownload} /> Off Road POST
              </NavDropdown.Item>
            </NavDropdown>
            <NavDropdown title="Info" id="basic-nav-dropdown">
              <NavDropdown.Item as={Link} to="/about" onClick={handleNavItemSelect}>
                About IPS
              </NavDropdown.Item>
              <NavDropdown.Item as={Link} to="/aboutwebapp" onClick={handleNavItemSelect}>
                About Web App
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item as={Link} to="/changelog" onClick={handleNavItemSelect}>
                Change Log
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
          {selectedPatients.length > 0 && (
            <Nav>
              <NavDropdown
                title={selectedPatient ? `Patient: ${selectedPatient.patient.given} ${selectedPatient.patient.name}` : "Selected Patients"}
                id="selected-patients-dropdown"
              >
                {selectedPatients.map((patient) => (
                  <NavDropdown.Item
                    key={patient._id}
                    onClick={() => handlePatientSelect(patient)} // Set selectedPatient
                    as={Link}
                    to="/api" // Navigate to /api without specifying ID
                  >
                    {patient.patient.given} {patient.patient.name}
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
