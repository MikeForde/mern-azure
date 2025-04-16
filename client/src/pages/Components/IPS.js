import React, { useContext, useState } from "react";
import { Button, Modal, Form, OverlayTrigger, Tooltip, Row, Col } from "react-bootstrap";
import { Link } from "react-router-dom";
import { faFileMedical, faQrcode, faTrash, faBeer, faEdit, faFileExport, faUpload, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import axios from 'axios';
import { PatientContext } from '../../PatientContext';
import { useLoading } from '../../contexts/LoadingContext';
import "./components.css";
import { generatePDF } from './generatePDF';
import { Toast, ToastContainer } from 'react-bootstrap';


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
  const [pmrMessage, setPmrMessage] = useState('');
  const [pmrAlertVariant, setPmrAlertVariant] = useState('success'); // "success" for success, "danger" for errors
  const [showPmrAlert, setShowPmrAlert] = useState(false);


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
      [type]: [...prev[type], { name: '', date: '', dosage: '', criticality: '', value: '', system: '', code: '' }],
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

  const handleGeneratePDF = () => {
    generatePDF(ips);
  };

  const renderTooltip = (text) => (
    <Tooltip id={`tooltip-${text}`}>
      {text}
    </Tooltip>
  );

  // Inside your IPS component, add the new function:
  const handleSendPMR = () => {
    startLoading();
    axios.post(`/api/pmr/${ips._id}`)
      .then(response => {
        setPmrMessage("PMR Response: " + JSON.stringify(response.data, null, 2));
        setPmrAlertVariant("success");
        setShowPmrAlert(true);
      })
      .catch(error => {
        const errorMsg = error.response && error.response.data
          ? error.response.data
          : error.message;
        console.error("Error sending PMR:", errorMsg);
        setPmrMessage(errorMsg);
        setPmrAlertVariant("danger");
        setShowPmrAlert(true);
      })
      .finally(() => stopLoading());
  };


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

            {ips.medication && ips.medication.length > 0 && (
              <>
                <h4>Medications:</h4>
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>System</th>
                      <th>Date</th>
                      <th>Dosage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ips.medication.map((med, index) => (
                      <tr key={index}>
                        <td>{med.name}</td>
                        <td>{med.code}</td>
                        <td>{med.system}</td>
                        <td>{formatDate(med.date)}</td>
                        <td>{med.dosage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {ips.allergies && ips.allergies.length > 0 && (
              <>
                <h4>Allergies:</h4>
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>System</th>
                      <th>Criticality</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ips.allergies.map((allergy, index) => (
                      <tr key={index}>
                        <td>{allergy.name}</td>
                        <td>{allergy.code}</td>
                        <td>{allergy.system}</td>
                        <td>{allergy.criticality}</td>
                        <td>{formatDate(allergy.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {ips.conditions && ips.conditions.length > 0 && (
              <>
                <h4>Conditions:</h4>
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>System</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ips.conditions.map((condition, index) => (
                      <tr key={index}>
                        <td>{condition.name}</td>
                        <td>{condition.code}</td>
                        <td>{condition.system}</td>
                        <td>{formatDate(condition.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {ips.observations && ips.observations.length > 0 && (
              <>
                <h4>Observations:</h4>
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>System</th>
                      <th>Date</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ips.observations.map((observation, index) => (
                      <tr key={index}>
                        <td>{observation.name}</td>
                        <td>{observation.code}</td>
                        <td>{observation.system}</td>
                        <td>{formatDate(observation.date)}</td>
                        <td>{observation.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {ips.immunizations && ips.immunizations.length > 0 && (
              <>
                <h4>Immunizations:</h4>
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Date</th>
                      <th>System</th>
                      <th>Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ips.immunizations.map((immunization, index) => (
                      <tr key={index}>
                        <td>{immunization.name}</td>
                        <td>{formatDate(immunization.date)}</td>
                        <td>{immunization.system}</td>
                        <td>{immunization.code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

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

        <OverlayTrigger placement="top" overlay={renderTooltip('View External POST Page')}>
          <Link to="/puships">
            <Button variant="outline-secondary" className="qr-button custom-button" onClick={handleSelection}>
              <FontAwesomeIcon icon={faUpload} />
            </Button>
          </Link>
        </OverlayTrigger>

        <OverlayTrigger placement="top" overlay={renderTooltip('Generate PDF')}>
          <Button variant="outline-secondary" className="qr-button custom-button" onClick={handleGeneratePDF}>
            <FontAwesomeIcon icon={faFileExport} />
          </Button>
        </OverlayTrigger>

        <OverlayTrigger placement="top" overlay={renderTooltip('Send PMR to MMP')}>
          <Button variant="outline-secondary" className="qr-button custom-button" onClick={handleSendPMR}>
            <FontAwesomeIcon icon={faPaperPlane} />
          </Button>
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

      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        <Toast
          show={showPmrAlert}
          onClose={() => setShowPmrAlert(false)}
          bg={pmrAlertVariant}
          delay={5000}
          autohide
        >
          <Toast.Header>
            <strong className="me-auto">PMR Response</strong>
          </Toast.Header>
          <Toast.Body>
            <pre className="mb-0 text-white" style={{ whiteSpace: "pre-wrap", maxHeight: "200px", overflowY: "auto" }}>
              {pmrMessage}
            </pre>
          </Toast.Body>
        </Toast>
      </ToastContainer>


      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} dialogClassName="edit-modal">
        <Modal.Header closeButton>
          <Modal.Title>Edit Patient</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {/* Patient Details */}
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
                    <option value="male">male</option>
                    <option value="female">female</option>
                    <option value="other">other</option>
                    <option value="unknown">unknown</option>
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

            {/* Medications Table */}
            <h4>Medications:</h4>
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Name</th>
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
                      />
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
                      <Button variant="outline-danger" onClick={() => handleRemoveItem("medication", index)}>
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button variant="primary" onClick={() => handleAddItem("medication")}>
              Add Medication
            </Button>

            {/* Allergies Table */}
            <h4>Allergies:</h4>
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Name</th>
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
                        value={allergy.date.split("T")[0]}
                        onChange={(e) => handleChangeItem("allergies", index, e)}
                      />
                    </td>
                    <td>
                      <Button variant="outline-danger" onClick={() => handleRemoveItem("allergies", index)}>
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button variant="primary" onClick={() => handleAddItem("allergies")}>
              Add Allergy
            </Button>

            {/* Conditions Table */}
            <h4>Conditions:</h4>
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Name</th>
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
                        value={condition.date.split("T")[0]}
                        onChange={(e) => handleChangeItem("conditions", index, e)}
                      />
                    </td>
                    <td>
                      <Button variant="outline-danger" onClick={() => handleRemoveItem("conditions", index)}>
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button variant="primary" onClick={() => handleAddItem("conditions")}>
              Add Condition
            </Button>

            {/* Observations Table */}
            <h4>Observations:</h4>
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Name</th>
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
                        type="text"
                        name="name"
                        value={observation.name}
                        onChange={(e) => handleChangeItem("observations", index, e)}
                      />
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
                        value={observation.value}
                        onChange={(e) => handleChangeItem("observations", index, e)}
                      />
                    </td>
                    <td>
                      <Button variant="outline-danger" onClick={() => handleRemoveItem("observations", index)}>
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button variant="primary" onClick={() => handleAddItem("observations")}>
              Add Observation
            </Button>

            {/* Immunizations Table */}
            <h4>Immunizations:</h4>
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>System</th>
                  <th>Code</th>
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
                        type="text"
                        name="code"
                        value={immunization.code}
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
                      <Button variant="outline-danger" onClick={() => handleRemoveItem("immunizations", index)}>
                        <FontAwesomeIcon icon={faTrash} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button variant="primary" onClick={() => handleAddItem("immunizations")}>
              Add Immunization
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
