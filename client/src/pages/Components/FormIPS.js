import React, { useState } from "react";
import { Button, Form, Toast } from "react-bootstrap";
import { v4 as uuidv4 } from 'uuid';

export function FormIPS({ add }) {
  const [showForm, setShowForm] = useState(false);
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

  const [showAlert, setShowAlert] = useState(false);

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
    const updatedMedication = [...formData.medication];
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

    // Check if any of the required fields are missing
    if (!formData.patient.name || !formData.patient.given || !formData.patient.dob || !formData.patient.nationality || !formData.patient.practitioner) {
      // If any required field is missing, show the alert
      setShowAlert(true);

      // Hide the alert after 3 seconds
      setTimeout(() => {
        setShowAlert(false);
      }, 3000);

      return;
    }

    // Proceed with the submission if all required fields are filled
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
    <div>
      <Button className="mb-3" onClick={() => setShowForm(!showForm)}>
        {showForm ? "Hide Form" : "Manually Add New IPS Entry"}
      </Button>
      {showForm && (
        <Form onSubmit={handleSubmit}>
          <Form.Group>
            <Form.Label>
              <h3>Add IPS Entry</h3>
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
                <Form.Label className="col-sm-2">Criticality</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="severity"
                    value={allergy.severity}
                    onChange={(e) => handleAllergyChange(index, e)}
                    placeholder="Criticality" />
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
          <Toast show={showAlert} onClose={() => setShowAlert(false)} bg="danger" className="fixed-bottom m-3">
            <Toast.Body>Please fill in all required fields.</Toast.Body>
          </Toast>
        </Form>
      )}
    </div>
  );
}
