import React, { useContext, useState, useEffect } from 'react';
import { Link, useLocation} from 'react-router-dom';
import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBeer, faBrain, faCloud, faDownload, faFileMedical, faQrcode, faUpload } from '@fortawesome/free-solid-svg-icons';
import { PatientContext } from '../PatientContext';
import { useLoading } from '../contexts/LoadingContext';
import PatientSearch from './PatientSearch'; // Import the new component


function NavigationBar() {
  const { selectedPatients, setSelectedPatient, selectedPatient } = useContext(PatientContext);
  const [expanded, setExpanded] = useState(false);
  const { startLoading } = useLoading();
  const location = useLocation();

  useEffect(() => {
    // Update selectedPatient when selectedPatients change
    if (selectedPatients.length > 0) {
      setSelectedPatient(selectedPatients[0]);
    }
  }, [selectedPatients, setSelectedPatient]);

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setExpanded(false); // Collapse Navbar on patient select

    // Check if the current path matches one of the specified routes
    const currentPath = location.pathname;
    const shouldStartLoading = ['/api', '/qr', '/beergarden', '/offroadpost'].includes(currentPath);
    
    if (shouldStartLoading) {
      startLoading();
    }
  };

  const handleNavItemSelect = (startLoad) => {
    setExpanded(false); // Collapse Navbar on any item select
    if (startLoad && selectedPatient) {
      startLoading();
    }
  };

  // Function to collapse the Navbar
  const collapseNavbar = () => {
    setExpanded(false);
  };

  return (
    <Navbar expanded={expanded} expand="lg" bg="dark" variant="dark" fixed="top">
      <Container>
        <Navbar.Brand as={Link} to="/" onClick={() => handleNavItemSelect(false)}>
          <img
            src="/ipsnavbar.ico"
            width="25"
            height="25"
            className="d-inline-block align-center"
            alt="IPS Logo"
            style={{ marginRight: '10px' }}
          />
          IPS MERN Prototype 0_40
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" onClick={() => setExpanded(!expanded)} />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/api" onClick={() => handleNavItemSelect(true)}>
              <FontAwesomeIcon icon={faFileMedical} /> API
            </Nav.Link>
            <Nav.Link as={Link} to="/qr" onClick={() => handleNavItemSelect(true)}>
              <FontAwesomeIcon icon={faQrcode} /> QR
            </Nav.Link>
            <Nav.Link as={Link} to="/bulkupload" onClick={() => handleNavItemSelect(false)}>
              <FontAwesomeIcon icon={faUpload} /> DMICP
            </Nav.Link>
            <Nav.Link as={Link} to="/beergarden" onClick={() => handleNavItemSelect(true)}>
              <FontAwesomeIcon icon={faBeer} /> BEER
            </Nav.Link>
            <NavDropdown
              title={<span><FontAwesomeIcon icon={faBrain} /> VitalsIQ API</span>}
              id="basic-nav-dropdown"
            >
              <NavDropdown.Item as={Link} to="/ipsoffroad" onClick={() => handleNavItemSelect(false)}>
                <FontAwesomeIcon icon={faUpload} /> VitalsIQ GET
              </NavDropdown.Item>
              <NavDropdown.Item as={Link} to="/offroadpost" onClick={() => handleNavItemSelect(true)}>
                <FontAwesomeIcon icon={faDownload} /> VitalsIQ POST
              </NavDropdown.Item>
            </NavDropdown>
            <NavDropdown
              title={<span><FontAwesomeIcon icon={faCloud} /> NLD API</span>}
              id="basic-nav-dropdown"
            >
              <NavDropdown.Item as={Link} to="/pushipsnld" onClick={() => handleNavItemSelect(true)}>
                <FontAwesomeIcon icon={faDownload} /> NLD POST
              </NavDropdown.Item>
            </NavDropdown>
            <NavDropdown title="Info" id="basic-nav-dropdown">
              <NavDropdown.Item as={Link} to="/about" onClick={() => handleNavItemSelect(false)}>
                About IPS
              </NavDropdown.Item>
              <NavDropdown.Item as={Link} to="/aboutwebapp" onClick={() => handleNavItemSelect(false)}>
                About Web App
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item as={Link} to="/changelog" onClick={() => handleNavItemSelect(false)}>
                Change Log
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item as={Link} to="/apidocumentation" onClick={() => handleNavItemSelect(false)}>
                API Documentation
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
          {selectedPatients.length > 0 && (
            <Nav>
              <NavDropdown
                title={selectedPatient ? `${selectedPatient.patient.given} ${selectedPatient.patient.name}` : "Selected Patients"}
                id="selected-patients-dropdown"
              >
                {selectedPatients.map((patient) => (
                  <NavDropdown.Item
                    key={patient._id}
                    onClick={() => handlePatientSelect(patient)}
                  >
                    {patient.patient.given} {patient.patient.name}
                  </NavDropdown.Item>
                ))}
              </NavDropdown>
            </Nav>
          )}
          <PatientSearch collapseNavbar={collapseNavbar}/>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavigationBar;
