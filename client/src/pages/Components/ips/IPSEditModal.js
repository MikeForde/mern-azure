import React, { useState } from "react";
import "../components.css";
import {
  Button,
  Modal,
  Form,
  Row,
  Col,
  Toast,
  ToastContainer,
} from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { formatDate } from "./ipsFormatters";
import {
  OBSERVATION_OPTIONS,
  applyObservationPreset,
} from "../../../utils/observationCatalog";
import { shortenMedicationTerm } from "../../../utils/medicationTermShortener";
import { shortenImmunizationTerm } from "../../../utils/immunizationTermShortener";
import SnomedSearchModal from "./SnomedSearchModal";

export default function IPSEditModal({
  show,
  onHide,
  editIPS,
  handleEditChange,
  handleChangeItem,
  handleRemoveItem,
  handleAddItem,
  handleSaveEdit,
  showEditAlert,
  setShowEditAlert,
  editAlertMessage,
}) {
  const [focusedMedicationIndex, setFocusedMedicationIndex] = useState(null);
  const [focusedImmunizationIndex, setFocusedImmunizationIndex] = useState(null);

  const [snomedModalConfig, setSnomedModalConfig] = useState({
    show: false,
    title: "Search SNOMED GPS",
    tag: "",
    section: "",
    index: null,
  });

  const updateItemField = (section, index, name, value) => {
    handleChangeItem(section, index, {
      target: { name, value },
    });
  };

  const openSnomedModal = (section, index, tag, title) => {
    setSnomedModalConfig({
      show: true,
      title,
      tag,
      section,
      index,
    });
  };

  const closeSnomedModal = () => {
    setSnomedModalConfig((prev) => ({
      ...prev,
      show: false,
    }));
  };

  const handleSnomedSelect = ({ name, code, system }) => {
    const { section, index } = snomedModalConfig;
    if (section == null || index == null) return;

    updateItemField(section, index, "name", name);
    updateItemField(section, index, "code", code);
    updateItemField(section, index, "system", system);
  };

  const handleObservationNameChange = (index, value) => {
    const current = editIPS.observations[index] || {};
    const updated = applyObservationPreset({ ...current }, value);

    updateItemField("observations", index, "name", updated.name || "");
    updateItemField("observations", index, "code", updated.code || "");
    updateItemField("observations", index, "system", updated.system || "");
  };

  const getSuggestedShortMedicationName = (med) => {
    if (!med?.name) return null;
    return shortenMedicationTerm(med.name);
  };

  const applySuggestedMedicationName = (index) => {
    const current = editIPS.medication[index];
    const shortName = getSuggestedShortMedicationName(current);

    if (!shortName || shortName === current.name) return;

    updateItemField("medication", index, "name", shortName);
  };

  const getSuggestedShortImmunizationName = (imm) => {
    if (!imm?.name) return null;
    return shortenImmunizationTerm(imm.name);
  };

  const applySuggestedImmunizationName = (index) => {
    const current = editIPS.immunizations[index];
    const shortName = getSuggestedShortImmunizationName(current);

    if (!shortName || shortName === current.name) return;

    updateItemField("immunizations", index, "name", shortName);
  };

  return (
    <>
      <Modal show={show} onHide={onHide} dialogClassName="edit-modal">
        <Modal.Header closeButton>
          <Modal.Title className="ipsedit">Edit Patient</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <ToastContainer className="fixed-bottom m-3">
            <Toast
              show={showEditAlert}
              onClose={() => setShowEditAlert(false)}
              bg="danger"
              autohide
              delay={5000}
            >
              <Toast.Body>{editAlertMessage}</Toast.Body>
            </Toast>
          </ToastContainer>

          <Form>
            <Row>
              <Col>
                <Form.Group controlId="formPatientName">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={editIPS.patient.name}
                    onChange={handleEditChange}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="formPatientGiven">
                  <Form.Label>Given Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="given"
                    value={editIPS.patient.given}
                    onChange={handleEditChange}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col>
                <Form.Group controlId="formPatientDOB">
                  <Form.Label>DOB</Form.Label>
                  <Form.Control
                    type="date"
                    name="dob"
                    value={editIPS.patient.dob?.split("T")[0] || ""}
                    onChange={handleEditChange}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="formPatientGender">
                  <Form.Label>Gender</Form.Label>
                  <Form.Control
                    as="select"
                    name="gender"
                    value={editIPS.patient.gender}
                    onChange={handleEditChange}
                  >
                    <option value="">Select Gender</option>
                    <option value="male">male</option>
                    <option value="female">female</option>
                    <option value="other">other</option>
                    <option value="unknown">unknown</option>
                  </Form.Control>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col xs={2}>
                <Form.Group controlId="formPatientNation">
                  <Form.Label>Country</Form.Label>
                  <Form.Control
                    type="text"
                    name="nation"
                    value={editIPS.patient.nation}
                    onChange={handleEditChange}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="formPatientPractitioner">
                  <Form.Label>Practitioner</Form.Label>
                  <Form.Control
                    type="text"
                    name="practitioner"
                    value={editIPS.patient.practitioner}
                    onChange={handleEditChange}
                  />
                </Form.Group>
              </Col>
              <Col xs={2}>
                <Form.Group controlId="formPatientOrganization">
                  <Form.Label>Organization</Form.Label>
                  <Form.Control
                    type="text"
                    name="organization"
                    value={editIPS.patient.organization}
                    onChange={handleEditChange}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="formPatientIdentifier">
                  <Form.Label>Identifier</Form.Label>
                  <Form.Control
                    type="text"
                    name="identifier"
                    value={editIPS.patient.identifier}
                    onChange={handleEditChange}
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group controlId="formPatientIdentifier2">
                  <Form.Label>Identifier2</Form.Label>
                  <Form.Control
                    type="text"
                    name="identifier2"
                    value={editIPS.patient.identifier2}
                    onChange={handleEditChange}
                  />
                </Form.Group>
              </Col>
            </Row>

            <h4 className="ipsedit">Medications:</h4>
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="sct-col"></th>
                    <th>Code</th>
                    <th>System</th>
                    <th>Date</th>
                    <th>Dosage</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editIPS.medication.map((med, index) => (
                    <tr key={index}>
                      <td>
                        <Form.Control
                          type="text"
                          name="name"
                          value={med.name}
                          onChange={(e) => handleChangeItem("medication", index, e)}
                          onFocus={() => setFocusedMedicationIndex(index)}
                          onBlur={() =>
                            setTimeout(() => setFocusedMedicationIndex(null), 150)
                          }
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
                      </td>
                      <td className="sct-col">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline-secondary"
                          className="sct-button-vertical"
                          onClick={() =>
                            openSnomedModal(
                              "medication",
                              index,
                              "medication",
                              "Search SNOMED GPS Medication"
                            )
                          }
                        >
                          SCT
                        </Button>
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="code"
                          value={med.code}
                          onChange={(e) => handleChangeItem("medication", index, e)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="system"
                          value={med.system}
                          onChange={(e) => handleChangeItem("medication", index, e)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="datetime-local"
                          name="date"
                          value={formatDate(med.date)}
                          onChange={(e) => handleChangeItem("medication", index, e)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="dosage"
                          value={med.dosage}
                          onChange={(e) => handleChangeItem("medication", index, e)}
                        />
                      </td>
                      <td>
                        <Button
                          variant="outline-danger"
                          className="resp-button"
                          onClick={() => handleRemoveItem("medication", index)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="primary"
              className="resp-add-button"
              onClick={() => handleAddItem("medication")}
            >
              Add Medication
            </Button>

            <h4 className="ipsedit">Allergies:</h4>
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="sct-col"></th>
                    <th>Code</th>
                    <th>System</th>
                    <th>Criticality</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editIPS.allergies.map((allergy, index) => (
                    <tr key={index}>
                      <td>
                        <Form.Control
                          type="text"
                          name="name"
                          value={allergy.name}
                          onChange={(e) => handleChangeItem("allergies", index, e)}
                        />
                      </td>
                      <td className="sct-col">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline-secondary"
                          className="sct-button-vertical"
                          onClick={() =>
                            openSnomedModal(
                              "allergies",
                              index,
                              "allergyintolerance",
                              "Search SNOMED GPS Allergy"
                            )
                          }
                        >
                          SCT
                        </Button>
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="code"
                          value={allergy.code}
                          onChange={(e) => handleChangeItem("allergies", index, e)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="system"
                          value={allergy.system}
                          onChange={(e) => handleChangeItem("allergies", index, e)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          as="select"
                          name="criticality"
                          value={allergy.criticality}
                          onChange={(e) => handleChangeItem("allergies", index, e)}
                        >
                          <option value="">Select Criticality</option>
                          <option value="high">high</option>
                          <option value="medium">medium</option>
                          <option value="low">low</option>
                        </Form.Control>
                      </td>
                      <td>
                        <Form.Control
                          type="date"
                          name="date"
                          value={allergy.date?.split("T")[0] || ""}
                          onChange={(e) => handleChangeItem("allergies", index, e)}
                        />
                      </td>
                      <td>
                        <Button
                          variant="outline-danger"
                          className="resp-button"
                          onClick={() => handleRemoveItem("allergies", index)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="primary"
              className="resp-add-button"
              onClick={() => handleAddItem("allergies")}
            >
              Add Allergy
            </Button>

            <h4 className="ipsedit">Conditions:</h4>
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="sct-col"></th>
                    <th>Code</th>
                    <th>System</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editIPS.conditions.map((condition, index) => (
                    <tr key={index}>
                      <td>
                        <Form.Control
                          type="text"
                          name="name"
                          value={condition.name}
                          onChange={(e) => handleChangeItem("conditions", index, e)}
                        />
                      </td>
                      <td className="sct-col">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline-secondary"
                          className="sct-button-vertical"
                          onClick={() =>
                            openSnomedModal(
                              "conditions",
                              index,
                              "condition",
                              "Search SNOMED GPS Condition"
                            )
                          }
                        >
                          SCT
                        </Button>
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="code"
                          value={condition.code}
                          onChange={(e) => handleChangeItem("conditions", index, e)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="system"
                          value={condition.system}
                          onChange={(e) => handleChangeItem("conditions", index, e)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="date"
                          name="date"
                          value={condition.date?.split("T")[0] || ""}
                          onChange={(e) => handleChangeItem("conditions", index, e)}
                        />
                      </td>
                      <td>
                        <Button
                          variant="outline-danger"
                          className="resp-button"
                          onClick={() => handleRemoveItem("conditions", index)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="primary"
              className="resp-add-button"
              onClick={() => handleAddItem("conditions")}
            >
              Add Condition
            </Button>

            <h4 className="ipsedit">
              Observations:{" "}
              <span style={{ fontSize: "0.7em", color: "#666" }}>
                Numeric values may be plain numbers, ranges, or include units
                (e.g. <code>0.44</code>, <code>60 bpm</code>, <code>120-80 mmHg</code>,{" "}
                <code>4.8 10*12/L</code>)
              </span>
            </h4>

            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="sct-col"></th>
                    <th>Code</th>
                    <th>System</th>
                    <th>Date</th>
                    <th>Value</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editIPS.observations.map((observation, index) => (
                    <tr key={index}>
                      <td>
                        <Form.Control
                          as="select"
                          name="name"
                          value={
                            OBSERVATION_OPTIONS.includes(observation.name)
                              ? observation.name
                              : ""
                          }
                          onChange={(e) =>
                            handleObservationNameChange(index, e.target.value)
                          }
                          className="mb-2"
                        >
                          <option value="">Select preset</option>
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
                          placeholder="Custom Observation"
                          onChange={(e) => handleChangeItem("observations", index, e)}
                        />
                      </td>
                      <td className="sct-col">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline-secondary"
                          className="sct-button-vertical"
                          onClick={() =>
                            openSnomedModal(
                              "observations",
                              index,
                              "observation",
                              "Search SNOMED GPS Observation"
                            )
                          }
                        >
                          SCT
                        </Button>
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="code"
                          value={observation.code}
                          onChange={(e) => handleChangeItem("observations", index, e)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="system"
                          value={observation.system}
                          onChange={(e) => handleChangeItem("observations", index, e)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="datetime-local"
                          name="date"
                          value={formatDate(observation.date)}
                          onChange={(e) => handleChangeItem("observations", index, e)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="value"
                          placeholder="Val Unit"
                          value={observation.value}
                          onChange={(e) => handleChangeItem("observations", index, e)}
                        />
                      </td>
                      <td>
                        <Button
                          variant="outline-danger"
                          className="resp-button"
                          onClick={() => handleRemoveItem("observations", index)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="primary"
              className="resp-add-button"
              onClick={() => handleAddItem("observations")}
            >
              Add Observation
            </Button>

            <h4 className="ipsedit">Immunizations:</h4>
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="sct-col"></th>
                    <th>Code</th>
                    <th>System</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editIPS.immunizations.map((immunization, index) => (
                    <tr key={index}>
                      <td>
                        <Form.Control
                          type="text"
                          name="name"
                          value={immunization.name}
                          onChange={(e) => handleChangeItem("immunizations", index, e)}
                          onFocus={() => setFocusedImmunizationIndex(index)}
                          onBlur={() =>
                            setTimeout(() => setFocusedImmunizationIndex(null), 150)
                          }
                        />

                        {focusedImmunizationIndex === index &&
                          getSuggestedShortImmunizationName(immunization) &&
                          getSuggestedShortImmunizationName(immunization) !==
                            immunization.name && (
                            <div className="mt-1">
                              <Form.Text className="text-muted d-block">
                                Suggested shorter name:{" "}
                                <b>
                                  {getSuggestedShortImmunizationName(immunization)}
                                </b>
                              </Form.Text>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline-secondary"
                                className="mt-1"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() =>
                                  applySuggestedImmunizationName(index)
                                }
                              >
                                Use shorter name
                              </Button>
                            </div>
                          )}
                      </td>
                      <td className="sct-col">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline-secondary"
                          className="sct-button-vertical"
                          onClick={() =>
                            openSnomedModal(
                              "immunizations",
                              index,
                              "immunization",
                              "Search SNOMED GPS Immunization"
                            )
                          }
                        >
                          SCT
                        </Button>
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="code"
                          value={immunization.code || ""}
                          onChange={(e) => handleChangeItem("immunizations", index, e)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="system"
                          value={immunization.system}
                          onChange={(e) => handleChangeItem("immunizations", index, e)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="datetime-local"
                          name="date"
                          value={formatDate(immunization.date)}
                          onChange={(e) => handleChangeItem("immunizations", index, e)}
                        />
                      </td>
                      <td>
                        <Button
                          variant="outline-danger"
                          className="resp-button"
                          onClick={() => handleRemoveItem("immunizations", index)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="primary"
              className="resp-add-button"
              onClick={() => handleAddItem("immunizations")}
            >
              Add Immunization
            </Button>

            <h4 className="ipsedit">Procedures:</h4>
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="sct-col"></th>
                    <th>Code</th>
                    <th>System</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editIPS.procedures.map((procedure, index) => (
                    <tr key={index}>
                      <td>
                        <Form.Control
                          type="text"
                          name="name"
                          value={procedure.name}
                          onChange={(e) => handleChangeItem("procedures", index, e)}
                        />
                      </td>
                      <td className="sct-col">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline-secondary"
                          className="sct-button-vertical"
                          onClick={() =>
                            openSnomedModal(
                              "procedures",
                              index,
                              "procedure",
                              "Search SNOMED GPS Procedure"
                            )
                          }
                        >
                          SCT
                        </Button>
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="code"
                          value={procedure.code}
                          onChange={(e) => handleChangeItem("procedures", index, e)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          name="system"
                          value={procedure.system}
                          onChange={(e) => handleChangeItem("procedures", index, e)}
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="datetime-local"
                          name="date"
                          value={formatDate(procedure.date)}
                          onChange={(e) => handleChangeItem("procedures", index, e)}
                        />
                      </td>
                      <td>
                        <Button
                          variant="outline-danger"
                          className="resp-button"
                          onClick={() => handleRemoveItem("procedures", index)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="primary"
              className="resp-add-button"
              onClick={() => handleAddItem("procedures")}
            >
              Add Procedure
            </Button>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveEdit}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>

      <SnomedSearchModal
        show={snomedModalConfig.show}
        onHide={closeSnomedModal}
        title={snomedModalConfig.title}
        tag={snomedModalConfig.tag}
        onSelect={handleSnomedSelect}
      />
    </>
  );
}