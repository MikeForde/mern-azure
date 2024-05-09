import React from 'react';
import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faQrcode, faUpload } from '@fortawesome/free-solid-svg-icons';

function NavigationBar() {
  return (
      <Navbar expand="lg" bg="dark" variant="dark" fixed="top">
      <Container>
        <Navbar.Brand href="#home">
        <img
            src="/ipsnavbar.ico" // Assuming ips.ico is in the public directory
            width="25"
            height="25"
            className="d-inline-block align-center"
            alt="IPS Logo"
            style={{ marginRight: '10px' }}
          />
          IPS MERN Prototype 0_11</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link href="/"><FontAwesomeIcon icon={faHome} /> Home</Nav.Link>
            <Nav.Link href="/qr"><FontAwesomeIcon icon={faQrcode} /> QR Generators</Nav.Link>
            <Nav.Link href="/bulkupload"><FontAwesomeIcon icon={faUpload} /> Bulk Upload</Nav.Link>
            <NavDropdown title="Info" id="basic-nav-dropdown">
              <NavDropdown.Item href="/about">About IPS</NavDropdown.Item>
              <NavDropdown.Item href="/aboutwebapp">About Web App</NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item href="/changelog">Change Log</NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavigationBar;

