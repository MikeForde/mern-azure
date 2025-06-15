import React, { useState } from "react";
import { Button, Form, Toast } from "react-bootstrap";
import { v4 as uuidv4 } from 'uuid';
import "./components.css";

const formatDate = (dateString) => {
  if (!dateString) return "";
  const [datePart, timePart] = dateString.split("T");
  const time = timePart.split(".")[0];
  return time === "00:00:00" ? datePart : `${datePart} ${time}`;
};

export function FormIPS({ add }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    packageUUID: uuidv4(),
    timeStamp: new Date(),
    patient: {
      name: "",
      given: "",
      dob: "",
      gender: "",
      nationality: "",
      practitioner: "",
      organization: "",
      identifier: "",
      identifier2: "",
    },
    medication: [{ name: "", code: "", system: "", date: "", dosage: "" }],
    allergies: [{ name: "", code: "", system: "", criticality: "", date: "" }],
    conditions: [{ name: "", code: "", system: "", date: "" }],
    observations: [{ name: "", code: "", system: "", date: "", value: "" }],
    immunizations: [{ name: "", code: "", system: "", date: "" }],
    procedures: [{ name: "", code: "", system: "", date: "" }]
  });

  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

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

  const handleConditionChange = (index, e) => {
    const { name, value } = e.target;
    const updatedConditions = [...formData.conditions];
    updatedConditions[index][name] = value;
    setFormData({
      ...formData,
      conditions: updatedConditions,
    });
  };

  const handleObservationChange = (index, e) => {
    const { name, value } = e.target;
    const updatedObservations = [...formData.observations];
    updatedObservations[index][name] = value;
    setFormData({
      ...formData,
      observations: updatedObservations,
    });
  };

  const handleImmunizationChange = (index, e) => {
    const { name, value } = e.target;
    const updatedImmunizations = [...formData.immunizations];
    updatedImmunizations[index][name] = value;
    setFormData({
      ...formData,
      immunizations: updatedImmunizations,
    });
  };

  const handleProcedureChange = (index, e) => {
    const { name, value } = e.target;
    const updatedProcedures = [...formData.procedures];
    updatedProcedures[index][name] = value;
    setFormData({
      ...formData,
      procedures: updatedProcedures,
    });
  };

  const handleAddMedication = () => {
    setFormData({
      ...formData,
      medication: [...formData.medication, { name: "", code: "", system: "", date: "", dosage: "" }],
    });
  };

  const handleAddAllergy = () => {
    setFormData({
      ...formData,
      allergies: [...formData.allergies, { name: "", code: "", system: "", criticality: "", date: "" }],
    });
  };

  const handleAddCondition = () => {
    setFormData({
      ...formData,
      conditions: [...formData.conditions, { name: "", code: "", system: "", date: "" }],
    });
  };

  const handleAddObservation = () => {
    setFormData({
      ...formData,
      observations: [...formData.observations, { name: "", code: "", system: "", date: "", value: "" }],
    });
  };

  const handleAddImmunization = () => {
    setFormData({
      ...formData,
      immunizations: [...formData.immunizations, { name: "", code: "", system: "", date: "" }],
    });
  };

  const handleAddProcedure = () => {
    setFormData({
      ...formData,
      procedures: [...formData.procedures, { name: "", code: "", system: "", date: "" }],
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // enforce “number + space + unit”
    const obsPattern = /^(?:\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)\s+[a-zA-Z%/]+$/;
    for (let { value } of formData.observations) {
      if (value && /^\d/.test(value) && !obsPattern.test(value)) {
        setAlertMessage(
          'Numerical Ob value must be “val(-val) + space + units”, e.g. "60 bpm or 120-80 mmHg or 37.5 C"'
        );
        setShowAlert(true);
        return;
      }
    }

    // Check if any of the required fields are missing
    if (!formData.patient.name || !formData.patient.given || !formData.patient.dob) {
      // If any required field is missing, show the alert
      setAlertMessage("Please fill in Name, Given Name and Date of Birth.");
      setShowAlert(true);
      return;
    }

    if (!formData.patient.gender) { formData.patient.gender = "unknown"; }
    if (!formData.patient.nation) { formData.patient.nation = "UK"; }
    if (!formData.patient.practitioner) { formData.patient.practitioner = "Dr No"; }
    if (!formData.patient.organization) { formData.patient.organization = "GBR"; }

    // Proceed with the submission if all required fields are filled
    if (!formData.packageUUID) return;
    add(formData);
    setFormData({
      packageUUID: uuidv4(),
      timeStamp: new Date(),
      patient: {
        name: "",
        given: "",
        dob: "",
        gender: "",
        nation: "",
        practitioner: "",
        organization: "",
        identifier: "",
        identifier2: "",
      },
      medication: [{ name: "", code: "", system: "", date: "", dosage: "" }],
      allergies: [{ name: "", code: "", system: "", criticality: "", date: "" }],
      conditions: [{ name: "", code: "", system: "", date: "" }],
      observations: [{ name: "", code: "", system: "", date: "", value: "" }],
      immunizations: [{ name: "", code: "", system: "", date: "" }],
      procedures: [{ name: "", code: "", system: "", date: "" }]
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
          <Form.Group className="row">
            <Form.Label className="col-sm-2">Time Stamp</Form.Label>
            <div className="col-sm-10">
              <Form.Control
                type="text"
                readOnly
                value={formData.timeStamp} />
            </div>
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
              <Form.Label className="col-sm-2">Gender</Form.Label>
              <div className="col-sm-10">
                <Form.Control
                  as="select"
                  name="gender"
                  value={formData.patient.gender}
                  onChange={handlePatientChange} >
                  <option value="">Select Gender</option>
                  <option value="male">male</option>
                  <option value="female">female</option>
                  <option value="other">other</option>
                  <option value="unknown">unknown</option>
                </Form.Control>
              </div>
            </Form.Group>
            <Form.Group className="row">
              <Form.Label className="col-sm-2">Country</Form.Label>
              <div className="col-sm-4">
                <Form.Control
                  type="text"
                  name="nation"
                  defaultValue="UK"
                  value={formData.patient.nation}
                  onChange={handlePatientChange}
                  placeholder="Country - default UK" />
              </div>
              <Form.Label className="col-sm-2">Practitioner</Form.Label>
              <div className="col-sm-4">
                <Form.Control
                  type="text"
                  name="practitioner"
                  value={formData.patient.practitioner}
                  onChange={handlePatientChange}
                  placeholder="Practitioner - default Dr No" />
              </div>
              <Form.Label className="col-sm-2">Organization</Form.Label>
              <div className="col-sm-4">
                <Form.Control
                  type="text"
                  name="organization"
                  value={formData.patient.organization}
                  onChange={handlePatientChange}
                  placeholder="Organization - default UK DMS" />
              </div>
              <Form.Label className="col-sm-2">Identifier</Form.Label>
              <div className="col-sm-4">
                <Form.Control
                  type="text"
                  name="identifier"
                  value={formData.patient.identifier}
                  onChange={handlePatientChange}
                  placeholder="Nato id" />
              </div>
              <Form.Label className="col-sm-2">Identifier2</Form.Label>
              <div className="col-sm-4">
                <Form.Control
                  type="text"
                  name="identifier2"
                  value={formData.patient.identifier2}
                  onChange={handlePatientChange}
                  placeholder="National id" />
              </div>
            </Form.Group>
          </Form.Group>
          <Button className="mb-3 minor-button" onClick={handleAddMedication}>Add Medication</Button>
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
                <Form.Label className="col-sm-2">Code</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="code"
                    value={med.code}
                    onChange={(e) => handleMedicationChange(index, e)}
                    placeholder="Medication Code" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">System</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="system"
                    value={med.system}
                    onChange={(e) => handleMedicationChange(index, e)}
                    placeholder="Medication Code System" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Date</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="datetime-local"
                    name="date"
                    value={formatDate(med.date)}
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
                    defaultValue="Stat"
                    value={med.dosage}
                    onChange={(e) => handleMedicationChange(index, e)}
                    placeholder="Dosage" />
                </div>
              </Form.Group>
            </div>
          ))}
          <Button className="mb-3 minor-button" onClick={handleAddAllergy}>Add Allergy</Button>
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
                <Form.Label className="col-sm-2">Code</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="code"
                    value={allergy.code}
                    onChange={(e) => handleAllergyChange(index, e)}
                    placeholder="Allergy Code" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">System</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="system"
                    value={allergy.system}
                    onChange={(e) => handleAllergyChange(index, e)}
                    placeholder="Allergy Code System" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Criticality</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    as="select"
                    name="criticality"
                    value={allergy.criticality}
                    onChange={(e) => handleAllergyChange(index, e)}
                    placeholder="Criticality" >
                    <option value="">Select Criticality</option>
                    <option value="high">high</option>
                    <option value="medium">medium</option>
                    <option value="low">low</option>
                  </Form.Control>
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
          <Button className="mb-3 minor-button" onClick={handleAddCondition}>Add Condition</Button>
          {formData.conditions.map((condition, index) => (
            <div key={index}>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Condition</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="name"
                    value={condition.name}
                    onChange={(e) => handleConditionChange(index, e)}
                    placeholder="Condition/Problem Name" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Code</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="code"
                    value={condition.code}
                    onChange={(e) => handleConditionChange(index, e)}
                    placeholder="Condition/Problem Code" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">System</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="system"
                    value={condition.system}
                    onChange={(e) => handleConditionChange(index, e)}
                    placeholder="Condition/Problem Code System" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Date</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="date"
                    name="date"
                    value={condition.date}
                    onChange={(e) => handleConditionChange(index, e)}
                    placeholder="Date" />
                </div>
              </Form.Group>
            </div>
          ))}
          <Button className="mb-3 minor-button" onClick={handleAddObservation}>Add Observation</Button>
          {formData.observations.map((observation, index) => (
            <div key={index}>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Observation</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    as="select"
                    name="name"
                    value={observation.name}
                    onChange={(e) => handleObservationChange(index, e)}
                  >
                    <option value="">Select an observation or enter custom</option>
                    <option value="Blood Pressure">Blood Pressure</option>
                    <option value="Pulse">Pulse</option>
                    <option value="Resp Rate">Resp Rate</option>
                    <option value="Temperature">Temperature</option>
                    <option value="Oxygen Sats">Oxygen Sats</option>
                    <option value="AVPU">AVPU</option>
                    <option value="Weight">Weight</option>
                    <option value="Blood Group">Blood Group</option>
                  </Form.Control>
                  <Form.Control
                    type="text"
                    name="name"
                    value={observation.name}
                    onChange={(e) => handleObservationChange(index, e)}
                    placeholder="Custom Observation"
                    className="mt-2"
                  />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Code</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="code"
                    value={observation.code}
                    onChange={(e) => handleObservationChange(index, e)}
                    placeholder="Observation Code" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">System</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="system"
                    value={observation.system}
                    onChange={(e) => handleObservationChange(index, e)}
                    placeholder="Observation Code System" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Date</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="datetime-local"
                    name="date"
                    value={formatDate(observation.date)}
                    onChange={(e) => handleObservationChange(index, e)}
                    placeholder="Date" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Value</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="value"
                    value={observation.value}
                    onChange={(e) => handleObservationChange(index, e)}
                    placeholder="Val Unit"
                  />
                  <Form.Text className="text-muted">
                    If numerical then must be val[-val], a space, then units (e.g. <code>78 kg</code> or <code>120-80 mmHg</code>)
                  </Form.Text>
                </div>
              </Form.Group>
            </div>
          ))}
          <Button className="mb-3 minor-button" onClick={handleAddImmunization}>Add Immunization</Button>
          {formData.immunizations.map((immunization, index) => (
            <div key={index}>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Immunization</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="name"
                    value={immunization.name}
                    onChange={(e) => handleImmunizationChange(index, e)}
                    placeholder="Immunization Name or Code" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">System</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="system"
                    value={immunization.system}
                    onChange={(e) => handleImmunizationChange(index, e)}
                    placeholder="Coding System (e.g., LOINC, SNOMED) or url" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Date</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="datetime-local"
                    name="date"
                    value={formatDate(immunization.date)}
                    onChange={(e) => handleImmunizationChange(index, e)}
                    placeholder="Date" />
                </div>
              </Form.Group>
            </div>
          ))}
          <Button className="mb-3 minor-button" onClick={handleAddProcedure}>Add Procedure</Button>
          {formData.procedures.map((procedure, index) => (
            <div key={index}>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Procedure</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="name"
                    value={procedure.name}
                    onChange={(e) => handleProcedureChange(index, e)}
                    placeholder="Procedure Name or Code" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Code</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="code"
                    value={procedure.code}
                    onChange={(e) => handleProcedureChange(index, e)}
                    placeholder="Procedure Code" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">System</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="system"
                    value={procedure.system}
                    onChange={(e) => handleProcedureChange(index, e)}
                    placeholder="Coding System (e.g., LOINC, SNOMED) or url" />
                </div>
              </Form.Group>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Date</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="datetime-local"
                    name="date"
                    value={formatDate(procedure.date)}
                    onChange={(e) => handleProcedureChange(index, e)}
                    placeholder="Date" />
                </div>
              </Form.Group>
            </div>
          ))}
          <br />

          <Button className="submit" variant="primary" type="submit">Submit IPS Data</Button>
          <Toast
            show={showAlert}
            onClose={() => setShowAlert(false)}
            bg="danger"
            className="fixed-bottom m-3"
            autohide
            delay={5000}
          >
            <Toast.Body>{alertMessage}</Toast.Body>
          </Toast>
        </Form>
      )}
      <br />
    </div>
  );
}
