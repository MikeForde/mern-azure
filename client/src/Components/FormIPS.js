import React, { useState } from "react";
import { Button, Form } from "react-bootstrap";
import { v4 as uuidv4 } from 'uuid';

export function FormIPS({ add }) {
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
              value={formData.packageUUID} />
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
              placeholder="Patient Name" />
          </div>
        </Form.Group>
        <Form.Group className="row">
          <Form.Label className="col-sm-2">Given Name</Form.Label>
          <div className="col-sm-10">
            <Form.Control
              type="text"
              name="given"
              value={formData.patient.given}
              onChange={handlePatientChange}
              placeholder="Given Name" />
          </div>
        </Form.Group>
        <Form.Group className="row">
          <Form.Label className="col-sm-2">Date of Birth</Form.Label>
          <div className="col-sm-10">
            <Form.Control
              type="date"
              name="dob"
              value={formData.patient.dob}
              onChange={handlePatientChange} />
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
              placeholder="Nationality" />
          </div>
          <Form.Label className="col-sm-2">Practitioner</Form.Label>
          <div className="col-sm-4">
            <Form.Control
              type="text"
              name="practitioner"
              value={formData.patient.practitioner}
              onChange={handlePatientChange}
              placeholder="Practitioner" />
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
                placeholder="Medication Name" />
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
                placeholder="Date" />
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
                placeholder="Dosage" />
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
                placeholder="Allergy Name" />
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
                placeholder="Severity" />
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
                placeholder="Date" />
            </div>
          </Form.Group>
        </div>
      ))}
      <Button className="submit" variant="primary" type="submit">Submit IPS Data</Button>

    </Form>
  );
}
