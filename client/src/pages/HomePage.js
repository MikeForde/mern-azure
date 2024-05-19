// src/HomePage.js
import React, { useState, useContext } from "react";
import "./Page.css";
import { Card, Form, Button } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
import { FormIPS } from "./Components/FormIPS";
import { IPS } from "./Components/IPS";
import { PatientContext } from "../PatientContext";

const server = process.env.REACT_APP_API_BASE_URL
  ? axios.create({ baseURL: process.env.REACT_APP_API_BASE_URL })
  : axios.create({});

function HomePage() {
  const { selectedPatients, setSelectedPatients } = useContext(PatientContext);
  const [searchTerm, setSearchTerm] = useState("");

  const add = (formData) => {
    const cleanedMedication = formData.medication.filter(item => {
      return item.name.trim() !== "" || item.date.trim() !== "" || item.dosage.trim() !== "";
    });

    const cleanedAllergies = formData.allergies.filter(item => {
      return item.name.trim() !== "" || item.severity.trim() !== "" || item.date.trim() !== "";
    });

    const cleanedFormData = {
      ...formData,
      medication: cleanedMedication,
      allergies: cleanedAllergies
    };

    console.log("Form Data", cleanedFormData);
    console.log(JSON.stringify(cleanedFormData, null, 2));

    server
      .post("/ips", cleanedFormData)
      .then((response) => response.data)
      .then((createdIPS) => {
        if (createdIPS) {
          const newIPS = [...selectedPatients, createdIPS];
          setSelectedPatients(newIPS);
        }
      })
      .catch((error) => {
        console.log("Error", error);
      });
  };

  const remove = (id) => {
    server
      .delete(`/ips/${id}`)
      .then((response) => response.data)
      .then((removedId) => {
        const newIPS = selectedPatients.filter((ips) => ips._id !== removedId);
        setSelectedPatients(newIPS);
      })
      .catch((error) => {
        console.log("Error", error);
      });
  };

  const searchPatients = () => {
    server
      .get(`/ips/search/${searchTerm}`)
      .then((response) => response.data)
      .then((ipss) => {
        if (ipss) {
          setSelectedPatients(ipss);
        }
      })
      .catch((error) => {
        console.log("Error", error);
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
    <div className="app">
      <div className="container">
        <FormIPS add={add} />
        <h3>Find Patient</h3>
        <Form onSubmit={handleSearchSubmit}>
          <Form.Group controlId="searchTerm">
            <Form.Label>Patient Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter patient name"
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </Form.Group>
          <Button variant="primary" type="submit" className="mb-3">
            Search
          </Button>
        </Form>
        <h3>Matching Patients</h3>
        <div>
          {selectedPatients.map((ips) => (
            <Card key={ips._id}>
              <Card.Body>
                <IPS ips={ips} remove={remove} />
              </Card.Body>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HomePage;
