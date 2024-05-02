import React, { useEffect, useState } from "react";
import "./App.css";
import { Button, Card, Form } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';

const server = process.env.REACT_APP_API_BASE_URL
  ? axios.create({ baseURL: process.env.REACT_APP_API_BASE_URL })
  : axios.create({});

function IPS({ ips, remove }) {
  return (
    <div className="ips">
      <div>
        <p>Package UUID: {ips.packageUUID}</p>
        <p>Patient Name: {ips.patient.name}</p>
        <p>Patient Given: {ips.patient.given}</p>
        <p>Patient DOB: {ips.patient.dob}</p>
        <p>Patient Nationality: {ips.patient.nationality}</p>
        <p>Patient Practitioner: {ips.patient.practitioner}</p>
        <h3>Medications:</h3>
        <ul>
          {ips.medication.map((med, index) => (
            <li key={index}>
              Med: {med.name} - Date: {med.date} - Dosage: {med.dosage}
            </li>
          ))}
        </ul>
        <h3>Allergies:</h3>
        <ul>
          {ips.allergies.map((allergy, index) => (
            <li key={index}>
              Allergy: {allergy.name} - Severity: {allergy.severity} - Date: {allergy.date}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <Button variant="outline-danger" onClick={() => remove(ips._id)}>
          🗑️
        </Button>
      </div>
    </div>
  );
}

function FormIPS({ add }) {
  const [formData, setFormData] = useState({
    packageUUID: uuidv4(),
    patient: {
      name: "",
      given: "",
      dob: "",
      nationality: "",
      practitioner: "",
    },
    medication: [{ name: "", date: "", dosage: "" }],
    allergies: [{ name: "", severity: "", date: "" }],
  });

  // const handleChange = (e) => {
  //   const { name, value } = e.target;
  //   setFormData({
  //     ...formData,
  //     [name]: value,
  //   });
  // };

  const handlePatientChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      patient: {
        ...formData.patient,
        [name]: value,
      },
    });
  };

  const handleMedicationChange = (index, e) => {
    const { name, value } = e.target;
    // console.log("name", name, "value", value, "index", index)
    const updatedMedication = [...formData.medication];
    // console.log("updatedMedication", updatedMedication)
    updatedMedication[index][name] = value;
    setFormData({
      ...formData,
      medication: updatedMedication,
    });
  };

  const handleAllergyChange = (index, e) => {
    const { name, value } = e.target;
    const updatedAllergies = [...formData.allergies];
    updatedAllergies[index][name] = value;
    setFormData({
      ...formData,
      allergies: updatedAllergies,
    });
  };


  const handleAddMedication = () => {
    setFormData({
      ...formData,
      medication: [...formData.medication, { name: "", date: "", dosage: "" }],
    });
  };

  const handleAddAllergy = () => {
    setFormData({
      ...formData,
      allergies: [...formData.allergies, { name: "", severity: "", date: "" }],
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.packageUUID) return;
    add(formData);
    setFormData({
      packageUUID: uuidv4(),
      patient: {
        name: "",
        given: "",
        dob: "",
        nationality: "",
        practitioner: "",
      },
      medication: [{ name: "", date: "", dosage: "" }],
      allergies: [{ name: "", severity: "", date: "" }],
    });
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group>
        <Form.Label>
          <b>Add IPS Entry</b>
        </Form.Label>
        <Form.Group className="row">
          <Form.Label className="col-sm-2"><b>Package UUID</b></Form.Label>
          <div className="col-sm-10">
            <Form.Control
              type="text"
              readOnly
              value={formData.packageUUID}
            />
          </div>
        </Form.Group>

      </Form.Group>
      <Form.Group>
        <Form.Label>
          <b>Patient Information</b>
        </Form.Label>
        <Form.Group className="row">
          <Form.Label className="col-sm-2">Name</Form.Label>
          <div className="col-sm-10">
            <Form.Control
              type="text"
              name="name"
              value={formData.patient.name}
              onChange={handlePatientChange}
              placeholder="Patient Name"
            />
          </div>
        </Form.Group>
        <Form.Group className="row">
          <Form.Label className="col-sm-2" >Given Name</Form.Label>
          <div className="col-sm-10">
            <Form.Control
              type="text"
              name="given"
              value={formData.patient.given}
              onChange={handlePatientChange}
              placeholder="Given Name"
            />
          </div>
        </Form.Group>
        <Form.Group className="row">
          <Form.Label className="col-sm-2">Date of Birth</Form.Label>
          <div className="col-sm-10">
            <Form.Control
              type="date"
              name="dob"
              value={formData.patient.dob}
              onChange={handlePatientChange}
            />
          </div>
        </Form.Group>
        <Form.Group className="row">
          <Form.Label className="col-sm-2">Nationality</Form.Label>
          <div className="col-sm-4">
            <Form.Control
              type="text"
              name="nationality"
              value={formData.patient.nationality}
              onChange={handlePatientChange}
              placeholder="Nationality"
            />
          </div>
          <Form.Label className="col-sm-2">Practitioner</Form.Label>
          <div className="col-sm-4">
            <Form.Control
              type="text"
              name="practitioner"
              value={formData.patient.practitioner}
              onChange={handlePatientChange}
              placeholder="Practitioner"
            />
          </div>
        </Form.Group>
      </Form.Group>
      <Button className="mb-3" onClick={handleAddMedication}>Add Medication</Button>
      {formData.medication.map((med, index) => (
        <div key={index}>
          <Form.Group className="row">
            <Form.Label className="col-sm-2">Medication</Form.Label>
            <div className="col-sm-10">
              <Form.Control
                type="text"
                name="name"
                value={med.name}
                onChange={(e) => handleMedicationChange(index, e)}
                placeholder="Medication Name"
              />
            </div>
          </Form.Group>
          <Form.Group className="row">
            <Form.Label className="col-sm-2">Date</Form.Label>
            <div className="col-sm-10">
              <Form.Control
                type="date"
                name="date"
                value={med.date}
                onChange={(e) => handleMedicationChange(index, e)}
                placeholder="Date"
              />
            </div>
          </Form.Group>
          <Form.Group className="row">
            <Form.Label className="col-sm-2">Dosage</Form.Label>
            <div className="col-sm-10">
              <Form.Control
                type="text"
                name="dosage"
                value={med.dosage}
                onChange={(e) => handleMedicationChange(index, e)}
                placeholder="Dosage"
              />
            </div>
          </Form.Group>
        </div>
      ))}
      <Button className="mb-3" onClick={handleAddAllergy}>Add Allergy</Button>
      {formData.allergies.map((allergy, index) => (
        <div key={index}>
          <Form.Group className="row">
            <Form.Label className="col-sm-2">Allergy</Form.Label>
            <div className="col-sm-10">
              <Form.Control
                type="text"
                name="name"
                value={allergy.name}
                onChange={(e) => handleAllergyChange(index, e)}
                placeholder="Allergy Name"
              />
            </div>
          </Form.Group>
          <Form.Group className="row">
            <Form.Label className="col-sm-2">Severity</Form.Label>
            <div className="col-sm-10">
              <Form.Control
                type="text"
                name="severity"
                value={allergy.severity}
                onChange={(e) => handleAllergyChange(index, e)}
                placeholder="Severity"
              />
            </div>
          </Form.Group>
          <Form.Group className="row">
            <Form.Label className="col-sm-2">Date</Form.Label>
            <div className="col-sm-10">
              <Form.Control
                type="date"
                name="date"
                value={allergy.date}
                onChange={(e) => handleAllergyChange(index, e)}
                placeholder="Date"
              />
            </div>
          </Form.Group>
        </div>
      ))}
      <Button className="submit" variant="primary" type="submit">Submit IPS Data</Button>

    </Form>
  );
}


function App() {
  const [ipss, setIPS] = useState([]);

  const add = (formData) => {
    console.log(JSON.stringify(formData, null, 2));
    server
      .post("/ips", formData)
      .then((response) => {
        return response.data;
      })
      .then((createdIPS) => {
        if (createdIPS) {
          const newIPS = [...ipss, createdIPS];
          setIPS(newIPS);
        }
      })
      .catch((error) => {
        console.log("Error", error);
      });
  };

  const remove = (id) => {
    server
      .delete(`/ips/${id}`)
      .then((response) => {
        return response.data;
      })
      .then((removedId) => {
        const newIPS = [...ipss];

        let index = ipss.findIndex((c) => c._id === removedId);
        if (index !== -1) {
          newIPS.splice(index, 1);
          setIPS(newIPS);
        }
      })
      .catch((error) => {
        console.log("Error", error);
      });
  };

  const getAll = () => {
    server
      .get("/ips/all")
      .then((response) => {
        return response.data;
      })
      .then((ipss) => {
        if (ipss) {
          setIPS(ipss);
        }
      })
      .catch((error) => {
        console.log("Error", error);
      });
  };

  useEffect(() => {
    getAll();
  }, []);

  return (
    <div className="app">
      <div className="container">
        <h1 className="text-center mb-4">IPS MERN Prototype</h1>
        <FormIPS add={add} />
        <div>
          {ipss.map((ips) => (
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

export default App;
