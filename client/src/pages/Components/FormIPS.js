import React, { useState } from "react";
import { Button, Form, Toast } from "react-bootstrap";
import { v4 as uuidv4 } from "uuid";
import "./components.css";
import {
  isValidObservationValue,
  getObservationValueError,
} from "../../utils/observationValidation";
import {
  OBSERVATION_OPTIONS,
  applyObservationPreset,
} from "../../utils/observationCatalog";
import { shortenMedicationTerm } from "../../utils/medicationTermShortener";
import { shortenImmunizationTerm } from "../../utils/immunizationTermShortener";
import { useSnomedLookup } from "../../hooks/useSnomedLookup";

const SNOMED_SYSTEM = "http://snomed.info/sct";

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
    procedures: [{ name: "", code: "", system: "", date: "" }],
  });

  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [focusedMedicationIndex, setFocusedMedicationIndex] = useState(null);
  const [focusedImmunizationIndex, setFocusedImmunizationIndex] = useState(null);

  const medicationSnomed = useSnomedLookup("medication");
  const conditionSnomed = useSnomedLookup("condition");
  const allergySnomed = useSnomedLookup("allergyintolerance");
  const procedureSnomed = useSnomedLookup("procedure");
  const immunizationSnomed = useSnomedLookup("immunization");
  const observationSnomed = useSnomedLookup("observation");

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

  const applyMedicationSelection = (index, selectedMatch) => {
    const updatedMedication = [...formData.medication];

    updatedMedication[index] = {
      ...updatedMedication[index],
      name: selectedMatch.term_clean,
      code: selectedMatch.code,
      system: SNOMED_SYSTEM,
    };

    setFormData({
      ...formData,
      medication: updatedMedication,
    });

    medicationSnomed.setLookup((prev) => ({
      ...prev,
      [index]: selectedMatch.term_clean,
    }));
  };

  const applyConditionSelection = (index, selectedMatch) => {
    const updatedConditions = [...formData.conditions];

    updatedConditions[index] = {
      ...updatedConditions[index],
      name: selectedMatch.term_clean,
      code: selectedMatch.code,
      system: SNOMED_SYSTEM,
    };

    setFormData({
      ...formData,
      conditions: updatedConditions,
    });

    conditionSnomed.setLookup((prev) => ({
      ...prev,
      [index]: selectedMatch.term_clean,
    }));
  };

  const applyAllergySelection = (index, selectedMatch) => {
    const updatedAllergies = [...formData.allergies];

    updatedAllergies[index] = {
      ...updatedAllergies[index],
      name: selectedMatch.term_clean,
      code: selectedMatch.code,
      system: SNOMED_SYSTEM,
    };

    setFormData({
      ...formData,
      allergies: updatedAllergies,
    });

    allergySnomed.setLookup((prev) => ({
      ...prev,
      [index]: selectedMatch.term_clean,
    }));
  };

  const applyProcedureSelection = (index, selectedMatch) => {
    const updatedProcedures = [...formData.procedures];

    updatedProcedures[index] = {
      ...updatedProcedures[index],
      name: selectedMatch.term_clean,
      code: selectedMatch.code,
      system: SNOMED_SYSTEM,
    };

    setFormData({
      ...formData,
      procedures: updatedProcedures,
    });

    procedureSnomed.setLookup((prev) => ({
      ...prev,
      [index]: selectedMatch.term_clean,
    }));
  };

  const applyImmunizationSelection = (index, selectedMatch) => {
    const updatedImmunizations = [...formData.immunizations];

    updatedImmunizations[index] = {
      ...updatedImmunizations[index],
      name: selectedMatch.term_clean,
      code: selectedMatch.code,
      system: SNOMED_SYSTEM,
    };

    setFormData({
      ...formData,
      immunizations: updatedImmunizations,
    });

    immunizationSnomed.setLookup((prev) => ({
      ...prev,
      [index]: selectedMatch.term_clean,
    }));
  };

  const applyObservationSelection = (index, selectedMatch) => {
    const updatedObservations = [...formData.observations];

    updatedObservations[index] = {
      ...updatedObservations[index],
      name: selectedMatch.term_clean,
      code: selectedMatch.code,
      system: SNOMED_SYSTEM,
    };

    setFormData({
      ...formData,
      observations: updatedObservations,
    });

    observationSnomed.setLookup((prev) => ({
      ...prev,
      [index]: selectedMatch.term_clean,
    }));
  };

  const handleMedicationLookupChange = (index, value) => {
    medicationSnomed.handleLookupChange(index, value, (selectedMatch) => {
      applyMedicationSelection(index, selectedMatch);
    });
  };

  const handleConditionLookupChange = (index, value) => {
    conditionSnomed.handleLookupChange(index, value, (selectedMatch) => {
      applyConditionSelection(index, selectedMatch);
    });
  };

  const handleAllergyLookupChange = (index, value) => {
    allergySnomed.handleLookupChange(index, value, (selectedMatch) => {
      applyAllergySelection(index, selectedMatch);
    });
  };

  const handleProcedureLookupChange = (index, value) => {
    procedureSnomed.handleLookupChange(index, value, (selectedMatch) => {
      applyProcedureSelection(index, selectedMatch);
    });
  };

  const handleImmunizationLookupChange = (index, value) => {
    immunizationSnomed.handleLookupChange(index, value, (selectedMatch) => {
      applyImmunizationSelection(index, selectedMatch);
    });
  };

  const handleObservationLookupChange = (index, value) => {
    observationSnomed.handleLookupChange(index, value, (selectedMatch) => {
      applyObservationSelection(index, selectedMatch);
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

    if (name === "name") {
      updatedObservations[index] = applyObservationPreset(
        updatedObservations[index],
        value
      );

      observationSnomed.setLookup((prev) => ({
        ...prev,
        [index]: updatedObservations[index].name || "",
      }));
    } else {
      updatedObservations[index][name] = value;
    }

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
    const newIndex = formData.medication.length;

    setFormData({
      ...formData,
      medication: [
        ...formData.medication,
        { name: "", code: "", system: "", date: "", dosage: "" },
      ],
    });

    medicationSnomed.initRow(newIndex);
  };

  const handleAddAllergy = () => {
    const newIndex = formData.allergies.length;

    setFormData({
      ...formData,
      allergies: [
        ...formData.allergies,
        { name: "", code: "", system: "", criticality: "", date: "" },
      ],
    });

    allergySnomed.initRow(newIndex);
  };

  const handleAddCondition = () => {
    const newIndex = formData.conditions.length;

    setFormData({
      ...formData,
      conditions: [
        ...formData.conditions,
        { name: "", code: "", system: "", date: "" },
      ],
    });

    conditionSnomed.initRow(newIndex);
  };

  const handleAddObservation = () => {
    const newIndex = formData.observations.length;

    setFormData({
      ...formData,
      observations: [
        ...formData.observations,
        { name: "", code: "", system: "", date: "", value: "" },
      ],
    });

    observationSnomed.initRow(newIndex);
  };

  const handleAddImmunization = () => {
    const newIndex = formData.immunizations.length;

    setFormData({
      ...formData,
      immunizations: [
        ...formData.immunizations,
        { name: "", code: "", system: "", date: "" },
      ],
    });

    immunizationSnomed.initRow(newIndex);
  };

  const handleAddProcedure = () => {
    const newIndex = formData.procedures.length;

    setFormData({
      ...formData,
      procedures: [
        ...formData.procedures,
        { name: "", code: "", system: "", date: "" },
      ],
    });

    procedureSnomed.initRow(newIndex);
  };

  const getSuggestedShortMedicationName = (med) => {
    if (!med?.name) return null;
    return shortenMedicationTerm(med.name);
  };

  const applySuggestedMedicationName = (index) => {
    const updatedMedication = [...formData.medication];
    const current = updatedMedication[index];
    const shortName = getSuggestedShortMedicationName(current);

    if (!shortName || shortName === current.name) return;

    updatedMedication[index] = {
      ...current,
      name: shortName,
    };

    setFormData({
      ...formData,
      medication: updatedMedication,
    });
  };

  const getSuggestedShortImmunizationName = (imm) => {
    if (!imm?.name) return null;
    return shortenImmunizationTerm(imm.name);
  };

  const applySuggestedImmunizationName = (index) => {
    const updatedImmunizations = [...formData.immunizations];
    const current = updatedImmunizations[index];
    const shortName = getSuggestedShortImmunizationName(current);

    if (!shortName || shortName === current.name) return;

    updatedImmunizations[index] = {
      ...current,
      name: shortName,
    };

    setFormData({
      ...formData,
      immunizations: updatedImmunizations,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    for (let { value } of formData.observations) {
      if (!isValidObservationValue(value)) {
        setAlertMessage(getObservationValueError(value));
        setShowAlert(true);
        return;
      }
    }

    if (
      !formData.patient.name ||
      !formData.patient.given ||
      !formData.patient.dob
    ) {
      setAlertMessage("Please fill in Name, Given Name and Date of Birth.");
      setShowAlert(true);
      return;
    }

    if (!formData.patient.gender) {
      formData.patient.gender = "unknown";
    }
    if (!formData.patient.nation) {
      formData.patient.nation = "UK";
    }
    if (!formData.patient.practitioner) {
      formData.patient.practitioner = "Dr No";
    }
    if (!formData.patient.organization) {
      formData.patient.organization = "GBR";
    }

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
      procedures: [{ name: "", code: "", system: "", date: "" }],
    });

    medicationSnomed.resetAll();
    conditionSnomed.resetAll();
    allergySnomed.resetAll();
    procedureSnomed.resetAll();
    immunizationSnomed.resetAll();
    observationSnomed.resetAll();

    setFocusedMedicationIndex(null);
    setFocusedImmunizationIndex(null);
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
              <Form.Label className="col-sm-2">
                <b>Package UUID</b>
              </Form.Label>
              <div className="col-sm-10">
                <Form.Control type="text" readOnly value={formData.packageUUID} />
              </div>
            </Form.Group>
          </Form.Group>

          <Form.Group className="row">
            <Form.Label className="col-sm-2">Time Stamp</Form.Label>
            <div className="col-sm-10">
              <Form.Control type="text" readOnly value={formData.timeStamp} />
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
                  placeholder="Patient Name"
                />
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
              <Form.Label className="col-sm-2">Gender</Form.Label>
              <div className="col-sm-10">
                <Form.Control
                  as="select"
                  name="gender"
                  value={formData.patient.gender}
                  onChange={handlePatientChange}
                >
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
                  placeholder="Country - default UK"
                />
              </div>

              <Form.Label className="col-sm-2">Practitioner</Form.Label>
              <div className="col-sm-4">
                <Form.Control
                  type="text"
                  name="practitioner"
                  value={formData.patient.practitioner}
                  onChange={handlePatientChange}
                  placeholder="Practitioner - default Dr No"
                />
              </div>

              <Form.Label className="col-sm-2">Organization</Form.Label>
              <div className="col-sm-4">
                <Form.Control
                  type="text"
                  name="organization"
                  value={formData.patient.organization}
                  onChange={handlePatientChange}
                  placeholder="Organization - default UK DMS"
                />
              </div>

              <Form.Label className="col-sm-2">Identifier</Form.Label>
              <div className="col-sm-4">
                <Form.Control
                  type="text"
                  name="identifier"
                  value={formData.patient.identifier}
                  onChange={handlePatientChange}
                  placeholder="Nato id"
                />
              </div>

              <Form.Label className="col-sm-2">Identifier2</Form.Label>
              <div className="col-sm-4">
                <Form.Control
                  type="text"
                  name="identifier2"
                  value={formData.patient.identifier2}
                  onChange={handlePatientChange}
                  placeholder="National id"
                />
              </div>
            </Form.Group>
          </Form.Group>

          <Button
            type="button"
            className="mb-3 minor-button"
            onClick={handleAddMedication}
          >
            Add Medication
          </Button>

          {formData.medication.map((med, index) => (
            <div key={index}>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Medication Lookup</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    value={medicationSnomed.lookup[index] || ""}
                    onChange={(e) =>
                      handleMedicationLookupChange(index, e.target.value)
                    }
                    placeholder="Search SNOMED GPS medication"
                    list={`medication-options-${index}`}
                    autoComplete="off"
                  />
                  <datalist id={`medication-options-${index}`}>
                    {(medicationSnomed.options[index] || []).map((item) => (
                      <option key={item.code} value={item.term_clean}>
                        {item.term_clean} ({item.semantic_tag})
                      </option>
                    ))}
                  </datalist>
                </div>
              </Form.Group>

              <Form.Group className="row">
                <Form.Label className="col-sm-2">Medication</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="name"
                    value={med.name}
                    onChange={(e) => handleMedicationChange(index, e)}
                    onFocus={() => setFocusedMedicationIndex(index)}
                    onBlur={() =>
                      setTimeout(() => setFocusedMedicationIndex(null), 150)
                    }
                    placeholder="Medication Name"
                  />

                  {focusedMedicationIndex === index &&
                    getSuggestedShortMedicationName(med) &&
                    getSuggestedShortMedicationName(med) !== med.name && (
                      <div className="mt-1">
                        <Form.Text className="text-muted d-block">
                          Suggested shorter name:{" "}
                          <b>{getSuggestedShortMedicationName(med)}</b>
                        </Form.Text>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline-secondary"
                          className="mt-1"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applySuggestedMedicationName(index)}
                        >
                          Use shorter name
                        </Button>
                      </div>
                    )}
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
                    placeholder="Medication Code"
                  />
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
                    placeholder="Medication Code System"
                  />
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
                    defaultValue="Stat"
                    value={med.dosage}
                    onChange={(e) => handleMedicationChange(index, e)}
                    placeholder="Dosage"
                  />
                </div>
              </Form.Group>
            </div>
          ))}

          <Button
            type="button"
            className="mb-3 minor-button"
            onClick={handleAddAllergy}
          >
            Add Allergy
          </Button>

          {formData.allergies.map((allergy, index) => (
            <div key={index}>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Allergy Lookup</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    value={allergySnomed.lookup[index] || ""}
                    onChange={(e) =>
                      handleAllergyLookupChange(index, e.target.value)
                    }
                    placeholder="Search SNOMED GPS allergy/substance"
                    list={`allergy-options-${index}`}
                    autoComplete="off"
                  />
                  <datalist id={`allergy-options-${index}`}>
                    {(allergySnomed.options[index] || []).map((item) => (
                      <option key={item.code} value={item.term_clean}>
                        {item.term_clean} ({item.semantic_tag})
                      </option>
                    ))}
                  </datalist>
                </div>
              </Form.Group>

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
                <Form.Label className="col-sm-2">Code</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="code"
                    value={allergy.code}
                    onChange={(e) => handleAllergyChange(index, e)}
                    placeholder="Allergy Code"
                  />
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
                    placeholder="Allergy Code System"
                  />
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
                    placeholder="Criticality"
                  >
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
                    placeholder="Date"
                  />
                </div>
              </Form.Group>
            </div>
          ))}

          <Button
            type="button"
            className="mb-3 minor-button"
            onClick={handleAddCondition}
          >
            Add Condition
          </Button>

          {formData.conditions.map((condition, index) => (
            <div key={index}>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Condition Lookup</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    value={conditionSnomed.lookup[index] || ""}
                    onChange={(e) =>
                      handleConditionLookupChange(index, e.target.value)
                    }
                    placeholder="Search SNOMED GPS condition"
                    list={`condition-options-${index}`}
                    autoComplete="off"
                  />
                  <datalist id={`condition-options-${index}`}>
                    {(conditionSnomed.options[index] || []).map((item) => (
                      <option key={item.code} value={item.term_clean}>
                        {item.term_clean} ({item.semantic_tag})
                      </option>
                    ))}
                  </datalist>
                </div>
              </Form.Group>

              <Form.Group className="row">
                <Form.Label className="col-sm-2">Condition</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="name"
                    value={condition.name}
                    onChange={(e) => handleConditionChange(index, e)}
                    placeholder="Condition/Problem Name"
                  />
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
                    placeholder="Condition/Problem Code"
                  />
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
                    placeholder="Condition/Problem Code System"
                  />
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
                    placeholder="Date"
                  />
                </div>
              </Form.Group>
            </div>
          ))}

          <Button
            type="button"
            className="mb-3 minor-button"
            onClick={handleAddObservation}
          >
            Add Observation
          </Button>

          {formData.observations.map((observation, index) => (
            <div key={index}>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Observation Lookup</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    value={observationSnomed.lookup[index] || ""}
                    onChange={(e) =>
                      handleObservationLookupChange(index, e.target.value)
                    }
                    placeholder="Search SNOMED GPS observation"
                    list={`observation-options-${index}`}
                    autoComplete="off"
                  />
                  <datalist id={`observation-options-${index}`}>
                    {(observationSnomed.options[index] || []).map((item) => (
                      <option key={item.code} value={item.term_clean}>
                        {item.term_clean} ({item.semantic_tag})
                      </option>
                    ))}
                  </datalist>
                </div>
              </Form.Group>

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
                    {OBSERVATION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
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
                    placeholder="Observation Code"
                  />
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
                    placeholder="Observation Code System"
                  />
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
                    placeholder="Date"
                  />
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
                    If numeric, value may be a plain number, a range, or include
                    units (e.g. <code>0.44</code>, <code>78 kg</code>,{" "}
                    <code>120-80 mmHg</code>, <code>4.8 10*12/L</code>)
                  </Form.Text>
                </div>
              </Form.Group>
            </div>
          ))}

          <Button
            type="button"
            className="mb-3 minor-button"
            onClick={handleAddImmunization}
          >
            Add Immunization
          </Button>

          {formData.immunizations.map((immunization, index) => (
            <div key={index}>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Immunization Lookup</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    value={immunizationSnomed.lookup[index] || ""}
                    onChange={(e) =>
                      handleImmunizationLookupChange(index, e.target.value)
                    }
                    placeholder="Search SNOMED GPS vaccine"
                    list={`immunization-options-${index}`}
                    autoComplete="off"
                  />
                  <datalist id={`immunization-options-${index}`}>
                    {(immunizationSnomed.options[index] || []).map((item) => (
                      <option key={item.code} value={item.term_clean}>
                        {item.term_clean} ({item.semantic_tag})
                      </option>
                    ))}
                  </datalist>
                </div>
              </Form.Group>

              <Form.Group className="row">
                <Form.Label className="col-sm-2">Immunization</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="name"
                    value={immunization.name}
                    onChange={(e) => handleImmunizationChange(index, e)}
                    onFocus={() => setFocusedImmunizationIndex(index)}
                    onBlur={() =>
                      setTimeout(() => setFocusedImmunizationIndex(null), 150)
                    }
                    placeholder="Immunization Name"
                  />

                  {focusedImmunizationIndex === index &&
                    getSuggestedShortImmunizationName(immunization) &&
                    getSuggestedShortImmunizationName(immunization) !== immunization.name && (
                      <div className="mt-1">
                        <Form.Text className="text-muted d-block">
                          Suggested shorter name:{" "}
                          <b>{getSuggestedShortImmunizationName(immunization)}</b>
                        </Form.Text>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline-secondary"
                          className="mt-1"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applySuggestedImmunizationName(index)}
                        >
                          Use shorter name
                        </Button>
                      </div>
                    )}
                </div>
              </Form.Group>

              <Form.Group className="row">
                <Form.Label className="col-sm-2">Code</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="code"
                    value={immunization.code || ""}
                    onChange={(e) => handleImmunizationChange(index, e)}
                    placeholder="Immunization Code"
                  />
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
                    placeholder="Coding System (e.g., SNOMED)"
                  />
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
                    placeholder="Date"
                  />
                </div>
              </Form.Group>
            </div>
          ))}

          <Button
            type="button"
            className="mb-3 minor-button"
            onClick={handleAddProcedure}
          >
            Add Procedure
          </Button>

          {formData.procedures.map((procedure, index) => (
            <div key={index}>
              <Form.Group className="row">
                <Form.Label className="col-sm-2">Procedure Lookup</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    value={procedureSnomed.lookup[index] || ""}
                    onChange={(e) =>
                      handleProcedureLookupChange(index, e.target.value)
                    }
                    placeholder="Search SNOMED GPS procedure"
                    list={`procedure-options-${index}`}
                    autoComplete="off"
                  />
                  <datalist id={`procedure-options-${index}`}>
                    {(procedureSnomed.options[index] || []).map((item) => (
                      <option key={item.code} value={item.term_clean}>
                        {item.term_clean} ({item.semantic_tag})
                      </option>
                    ))}
                  </datalist>
                </div>
              </Form.Group>

              <Form.Group className="row">
                <Form.Label className="col-sm-2">Procedure</Form.Label>
                <div className="col-sm-10">
                  <Form.Control
                    type="text"
                    name="name"
                    value={procedure.name}
                    onChange={(e) => handleProcedureChange(index, e)}
                    placeholder="Procedure Name or Code"
                  />
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
                    placeholder="Procedure Code"
                  />
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
                    placeholder="Coding System (e.g., LOINC, SNOMED) or url"
                  />
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
                    placeholder="Date"
                  />
                </div>
              </Form.Group>
            </div>
          ))}

          <br />

          <Button className="submit" variant="primary" type="submit">
            Submit IPS Data
          </Button>

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