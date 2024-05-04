import React from 'react';
import { Container, Nav, Navbar } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faQrcode, faUpload } from '@fortawesome/free-solid-svg-icons';

function NavigationBar() {
  return (
    <Navbar expand="lg" bg="dark" variant="dark">
      <Container>
        <Navbar.Brand as={Link} to="/">
          <FontAwesomeIcon icon={faHome} /> Home
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/qr">
              <FontAwesomeIcon icon={faQrcode} /> QR Page
            </Nav.Link>
            <Nav.Link as={Link} to="/bulkupload">
              <FontAwesomeIcon icon={faUpload} /> Bulk Upload
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavigationBar;
