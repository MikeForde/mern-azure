import React from 'react';
import { Container, Nav, Navbar } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faQrcode, faUpload } from '@fortawesome/free-solid-svg-icons';

function NavigationBar() {
  return (
      <Navbar expand="lg" bg="dark" variant="dark">
      <Container>
        <Navbar.Brand href="#home">IPS MERN Prototype 0_5</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link href="/"><FontAwesomeIcon icon={faHome} /> Home</Nav.Link>
            <Nav.Link href="/qr"><FontAwesomeIcon icon={faQrcode} /> QR Generators</Nav.Link>
            <Nav.Link href="/bulkupload"><FontAwesomeIcon icon={faUpload} /> Bulk Upload</Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavigationBar;

