// PatientSearch.js

import React, { useState, useContext } from 'react';
import { Form, Button } from 'react-bootstrap';
import axios from 'axios';
import { PatientContext } from '../PatientContext';
import { useLoading } from '../contexts/LoadingContext';
import './AppComp.css'; // Import the CSS file

const server = process.env.REACT_APP_API_BASE_URL
  ? axios.create({ baseURL: process.env.REACT_APP_API_BASE_URL })
  : axios.create({});

function PatientSearch({ collapseNavbar }) { // Accept collapseNavbar prop
  const [searchTerm, setSearchTerm] = useState('');
  const { setSelectedPatients, setSelectedPatient } = useContext(PatientContext);
  const { startLoading, stopLoading } = useLoading();

  const searchPatients = () => {
    startLoading();
    server
      .get(`/ips/search/${searchTerm}`)
      .then((response) => response.data)
      .then((ipss) => {
        if (ipss) {
          setSelectedPatients(ipss);
          if (ipss.length > 0) {
            setSelectedPatient(ipss[0]);
            collapseNavbar(); // Call the collapseNavbar function
          }
        }
      })
      .catch((error) => {
        console.log('Error', error);
      })
      .finally(() => {
        stopLoading();
      });
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    searchPatients();
  };

  return (
    <Form inline onSubmit={handleSearchSubmit} className="search-form">
      <Form.Control
        type="text"
        placeholder="Find Patient"
        value={searchTerm}
        onChange={handleSearchChange}
        className="mr-sm-2 form-control"
      />
      <Button variant="outline-light" type="submit">
        Search
      </Button>
    </Form>
  );
}

export default PatientSearch;
