import React, { useContext, useState } from "react";
import { Button, Modal, Form, OverlayTrigger, Tooltip, Row, Col } from "react-bootstrap";
import { Link } from "react-router-dom";
import { faDownload, faFileMedical, faQrcode, faTrash, faBeer, faEdit, faCloud } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import axios from 'axios';
import { PatientContext } from '../../PatientContext';
import { useLoading } from '../../contexts/LoadingContext';
import "./components.css";

const formatDate = (dateString) => {
  if (!dateString) return "";
  const [datePart, timePart] = dateString.split("T");
  const time = timePart.split(".")[0];
  //return time === "00:00:00" ? datePart : `${datePart} ${time}`;
  return `${datePart} ${time}`;
};

export function IPS({ ips, remove, update }) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editIPS, setEditIPS] = useState({ ...ips });
  const { setSelectedPatient } = useContext(PatientContext);
  const { startLoading, stopLoading } = useLoading();

  const handleRemove = () => setShowConfirmModal(true);

  const handleConfirmDelete = () => {
    remove(ips._id);
    setShowConfirmModal(false);
  };

  const handleCancelDelete = () => setShowConfirmModal(false);

  const handleSelection = () => {
    setSelectedPatient([ips])
    startLoading();
  };

  const handleEdit = () => {
    setEditIPS({ ...ips });  // Reset the form with the current IPS data
    setShowEditModal(true);
  };


  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditIPS((prev) => ({
      ...prev,
      patient: {
        ...prev.patient,
        [name]: value,
      }
    }));
  };

  const handleSaveEdit = () => {
    startLoading();
    axios.put(`/ips/${ips._id}`, editIPS)
      .then(response => {
        update(response.data);
        setShowEditModal(false);
      })
      .catch(error => console.error("There was an error updating the IPS record!", error))
      .finally(() => stopLoading());
  };

  const handleAddItem = (type) => {
    setEditIPS((prev) => ({
      ...prev,
      [type]: [...prev[type], { name: '', date: '', dosage: '', criticality: '', value: '' }],
    }));
  };

  const handleRemoveItem = (type, index) => {
    setEditIPS((prev) => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index),
    }));
  };

  const handleChangeItem = (type, index, e) => {
    const { name, value } = e.target;
    setEditIPS((prev) => ({
      ...prev,
      [type]: prev[type].map((item, i) => i === index ? { ...item, [name]: value } : item),
    }));
  };

  const renderTooltip = (text) => (
    <Tooltip id={`tooltip-${text}`}>
      {text}
    </Tooltip>
  );

  return (
    <div className="ips">
      <div>
        <h5>IPS UUID: {ips.packageUUID}</h5>
        {!expanded && (
          <>
            <p>
              Patient: {ips.patient.given} {ips.patient.name}
            </p>
            <Button variant="link" onClick={() => setExpanded(true)}>
              Show More
            </Button>
          </>
        )}
        {expanded && (
          <>
            <h5>Timestamp: {formatDate(ips.timeStamp)}</h5>
            <h4>Patient Details:</h4>
            <p>Name: {ips.patient.name}</p>
            <p>Given Name: {ips.patient.given}</p>
            <p>DOB: {ips.patient.dob.split("T")[0]}</p>
            <p>Gender: {ips.patient.gender}</p>
            <p>Country: {ips.patient.nation}</p>
            <p>Practitioner: {ips.patient.practitioner}</p>
            <p>Organization: {ips.patient.organization}</p>
            <h4>Medications:</h4>
            <ul>
              {ips.medication.map((med, index) => (
                <li key={index}>
                  <small>M:</small> {med.name} - Date: {formatDate(med.date)} - Dosage: {med.dosage}
                </li>
              ))}
            </ul>
            <h4>Allergies:</h4>
            <ul>
              {ips.allergies.map((allergy, index) => (
                <li key={index}>
                  <small>A:</small> {allergy.name} - Criticality: {allergy.criticality} - Date: {formatDate(allergy.date)}
                </li>
              ))}
            </ul>
            <h4>Conditions:</h4>
            <ul>
              {ips.conditions.map((condition, index) => (
                <li key={index}>
                  <small>C:</small> {condition.name} - Date: {formatDate(condition.date)}
                </li>
              ))}
            </ul>
            <h4>Observations:</h4>
            <ul>
              {ips.observations.map((observation, index) => (
                <li key={index}>
                  <small>O:</small> {observation.name} - Date: {formatDate(observation.date)} - Value: {observation.value}
                </li>
              ))}
            </ul>
            <Button variant="link" onClick={() => setExpanded(false)}>
              Show Less
            </Button>
          </>
        )}
      </div>
      <div>
        <OverlayTrigger placement="top" overlay={renderTooltip('View IPS API Page')}>
          <Link to="/api">
            <Button variant="outline-secondary" className="qr-button custom-button" onClick={handleSelection}>
              <FontAwesomeIcon icon={faFileMedical} />
            </Button>
          </Link>
        </OverlayTrigger>

        <OverlayTrigger placement="top" overlay={renderTooltip('View QR Code Page')}>
          <Link to="/qr">
            <Button variant="outline-secondary" className="qr-button custom-button" onClick={handleSelection}>
              <FontAwesomeIcon icon={faQrcode} />
            </Button>
          </Link>
        </OverlayTrigger>

        <OverlayTrigger placement="top" overlay={renderTooltip('View BEER Garden Page')}>
          <Link to="/beergarden">
            <Button variant="outline-secondary" className="qr-button custom-button" onClick={handleSelection}>
              <FontAwesomeIcon icon={faBeer} />
            </Button>
          </Link>
        </OverlayTrigger>

        <OverlayTrigger placement="top" overlay={renderTooltip('View VitalsIQ POST Page')}>
          <Link to="/offroadpost">
            <Button variant="outline-secondary" className="qr-button custom-button" onClick={handleSelection}>
              <FontAwesomeIcon icon={faDownload} />
            </Button>
          </Link>
        </OverlayTrigger>

        <OverlayTrigger placement="top" overlay={renderTooltip('View NLD POST Page')}>
          <Link to="/pushipsnld">
            <Button variant="outline-secondary" className="qr-button custom-button" onClick={handleSelection}>
              <FontAwesomeIcon icon={faCloud} />
            </Button>
          </Link>
        </OverlayTrigger>

        <OverlayTrigger placement="top" overlay={renderTooltip('Edit IPS Record')}>
          <Button variant="outline-secondary" className="custom-button" onClick={handleEdit}>
            <FontAwesomeIcon icon={faEdit} />
          </Button>
        </OverlayTrigger>

        <OverlayTrigger placement="top" overlay={renderTooltip('Delete IPS Record')}>
          <Button variant="outline-danger" className="custom-button" onClick={handleRemove}>
            <FontAwesomeIcon icon={faTrash} />
          </Button>
        </OverlayTrigger>
      </div>

      <Modal show={showConfirmModal} onHide={handleCancelDelete}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Deletion</Modal.Title>
        </Modal.Header>
        <Modal.Body>Are you sure you want to delete this IPS record?</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCancelDelete}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} dialogClassName="edit-modal">
        <Modal.Header closeButton>
          <Modal.Title>Edit Patient</Modal.Title>
        </Modal.Header>
        <Modal.Body>
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
                    value={editIPS.patient.dob.split("T")[0]}
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
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Unknown">Unknown</option>
                  </Form.Control>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col>
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
            </Row>
            <Row>
              <Col>
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
            </Row>

            <h4>Medications:</h4>
            {editIPS.medication.map((med, index) => (
              <Row key={index} className="align-items-center">
                <Col>
                  <Form.Group controlId={`medicationName-${index}`}>
                    <Form.Control
                      type="text"
                      name="name"
                      placeholder="Medication"
                      value={med.name}
                      onChange={(e) => handleChangeItem('medication', index, e)}
                    />
                  </Form.Group>
                </Col>
                <Col xs={3}>
                  <Form.Group controlId={`medicationDate-${index}`}>
                    <Form.Control
                      type="datetime-local"
                      name="date"
                      value={formatDate(med.date)}
                      onChange={(e) => handleChangeItem('medication', index, e)}
                    />
                  </Form.Group>
                </Col>
                <Col>
                  <Form.Group controlId={`medicationDosage-${index}`}>
                    <Form.Control
                      type="text"
                      name="dosage"
                      placeholder="Dosage"
                      value={med.dosage}
                      onChange={(e) => handleChangeItem('medication', index, e)}
                    />
                  </Form.Group>
                </Col>
                <Col xs="auto">
                  <Button variant="outline-danger" className="custom-button" onClick={() => handleRemoveItem('medication', index)}>
                    <FontAwesomeIcon icon={faTrash} />
                  </Button>
                </Col>
              </Row>
            ))}
            <Button variant="primary" onClick={() => handleAddItem('medication')}>
              Add Medication
            </Button>

            <h4>Allergies:</h4>
            {editIPS.allergies.map((allergy, index) => (
              <Row key={index} className="align-items-center">
                <Col>
                  <Form.Group controlId={`allergyName-${index}`}>
                    <Form.Control
                      type="text"
                      name="name"
                      placeholder="Allergy"
                      value={allergy.name}
                      onChange={(e) => handleChangeItem('allergies', index, e)}
                    />
                  </Form.Group>
                </Col>
                <Col xs={2}>
                  <Form.Group controlId={`allergyCriticality-${index}`}>
                    <Form.Control
                      as="select"
                      name="criticality"
                      placeholder="Criticality:High/Moderate/Low"
                      value={allergy.criticality}
                      onChange={(e) => handleChangeItem('allergies', index, e)}
                    > 
                      <option value="">Select Criticality</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </Form.Control>
                  </Form.Group>
                </Col>
                <Col xs={2}>
                  <Form.Group controlId={`allergyDate-${index}`}>
                    <Form.Control
                      type="date"
                      name="date"
                      value={allergy.date.split("T")[0]}
                      onChange={(e) => handleChangeItem('allergies', index, e)}
                    />
                  </Form.Group>
                </Col>
                <Col xs="auto">
                  <Button variant="outline-danger" className="custom-button" onClick={() => handleRemoveItem('allergies', index)}>
                    <FontAwesomeIcon icon={faTrash} />
                  </Button>
                </Col>
              </Row>
            ))}
            <Button variant="primary" onClick={() => handleAddItem('allergies')}>
              Add Allergy
            </Button>

            <h4>Conditions:</h4>
            {editIPS.conditions.map((condition, index) => (
              <Row key={index} className="align-items-center">
                <Col>
                  <Form.Group controlId={`conditionName-${index}`}>
                    <Form.Control
                      type="text"
                      name="name"
                      value={condition.name}
                      onChange={(e) => handleChangeItem('conditions', index, e)}
                    />
                  </Form.Group>
                </Col>
                <Col xs={2}>
                  <Form.Group controlId={`conditionDate-${index}`}>
                    <Form.Control
                      type="date"
                      name="date"
                      value={condition.date.split("T")[0]}
                      onChange={(e) => handleChangeItem('conditions', index, e)}
                    />
                  </Form.Group>
                </Col>
                <Col xs="auto">
                  <Button variant="outline-danger" className="custom-button" onClick={() => handleRemoveItem('conditions', index)}>
                    <FontAwesomeIcon icon={faTrash} />
                  </Button>
                </Col>
              </Row>
            ))}
            <Button variant="primary" onClick={() => handleAddItem('conditions')}>
              Add Condition
            </Button>

            <h4>Observations:</h4>
            {editIPS.observations.map((observation, index) => (
              <Row key={index} className="align-items-center">
                <Col>
                  <Form.Group controlId={`observationName-${index}`}>
                    <Form.Control
                      as="select"
                      name="name"
                      value={observation.name}
                      onChange={(e) => handleChangeItem('observations', index, e)}
                    >
                      <option value="">Select an observation or enter custom</option>
                      <option value="Blood Pressure">Blood Pressure</option>
                      <option value="Pulse">Pulse</option>
                      <option value="Resp Rate">Resp Rate</option>
                      <option value="Temperature">Temperature</option>
                      <option value="Oxygen Sats">Oxygen Sats</option>
                      <option value="AVPU">AVPU</option>
                    </Form.Control>
                    <Form.Control
                      type="text"
                      name="name"
                      value={observation.name}
                      onChange={(e) => handleChangeItem('observations', index, e)}
                      placeholder="Custom Observation"
                      className="mt-2"
                    />
                  </Form.Group>
                </Col>
                <Col xs={3}>
                  <Form.Group controlId={`observationDate-${index}`}>
                    <Form.Control
                      type="datetime-local"
                      name="date"
                      value={formatDate(observation.date)}
                      onChange={(e) => handleChangeItem('observations', index, e)}
                    />
                  </Form.Group>
                </Col>
                <Col>
                  <h6>Numerical=Vitals, Text=Body site else blank</h6>
                  <Form.Group controlId={`observationValue-${index}`}>
                    <Form.Control
                      type="text"
                      name="value"
                      value={observation.value}
                      onChange={(e) => handleChangeItem('observations', index, e)}
                    />
                  </Form.Group>
                </Col>
                <Col xs="auto">
                  <Button variant="outline-danger" className="custom-button" onClick={() => handleRemoveItem('observations', index)}>
                    <FontAwesomeIcon icon={faTrash} />
                  </Button>
                </Col>
              </Row>
            ))}
            <Button variant="primary" onClick={() => handleAddItem('observations')}>
              Add Observation
            </Button>

          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveEdit}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
