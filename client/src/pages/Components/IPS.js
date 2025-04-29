import React, { useContext, useState } from "react";
import { Button, Modal, Form, OverlayTrigger, Tooltip, Row, Col, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { faFileMedical, faQrcode, faTrash, faBeer, faEdit, faFileExport, faUpload, faPaperPlane, faCommentDots } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import axios from 'axios';
import { PatientContext } from '../../PatientContext';
import { useLoading } from '../../contexts/LoadingContext';
import "./components.css";
import { generatePDF } from './generatePDF';
import { Toast, ToastContainer } from 'react-bootstrap';


const formatDate = (dateString) => {
  console.log("formatDate", dateString);
  // cope with null dateString
  if (dateString === null) return "";
  if (!dateString) return "";
  const [datePart, timePart] = dateString.split("T");
  const time = timePart.split(".")[0];
  //return time === "00:00:00" ? datePart : `${datePart} ${time}`;
  return `${datePart} ${time}`;
};

const formatDateNoTime = (dateString) => {
  console.log("formatDate", dateString);
  if (dateString === null || dateString === undefined) return "";
  const [datePart,] = dateString.split("T");
  //return time === "00:00:00" ? datePart : `${datePart} ${time}`;
  return `${datePart}`;
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
  const [showEditAlert, setShowEditAlert] = useState(false);
  const [editAlertMessage, setEditAlertMessage] = useState("");

  // XMPP send state
  const [showXMPPModal, setShowXMPPModal] = useState(false);
  const [occupants, setOccupants] = useState([]);
  const [loadingOccupants, setLoadingOccupants] = useState(false);
  const [selectedOccupant, setSelectedOccupant] = useState('');
  const [sendMode, setSendMode] = useState('room'); // 'room' or 'private'
  const [xmppMessageStatus, setXmppMessageStatus] = useState('');
  const [xmppError, setXmppError] = useState('');

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
    // Validate the form data before sending it to the server
    // enforce “number + space + unit” for observations
    const obsPattern = /^(?:\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)\s+[a-zA-Z%/]+$/;
    for (let { value } of editIPS.observations) {
      if (value && !obsPattern.test(value)) {
        setEditAlertMessage(
          'Observation must be num[-num] + space + units, e.g. "60 bpm or 120-80 mmHg or 37.5 C"'
        );
        setShowEditAlert(true);
        return;
      }
    }

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

  // XMPP logic: open modal & load occupants
  const openXMPPModal = () => {
    setShowXMPPModal(true);
    setXmppMessageStatus('');
    setXmppError('');
    setLoadingOccupants(true);
    axios.get('/xmpp/xmpp-occupants')
      .then(res => setOccupants(res.data.occupants || []))
      .catch(err => setXmppError('Failed to load occupants - is XMPP reachable?'))
      .finally(() => setLoadingOccupants(false));
  };
  const closeXMPPModal = () => {
    setShowXMPPModal(false);
    setSelectedOccupant('');
    setSendMode('room');
  };
  const handleSendXMPP = () => {
    setXmppMessageStatus(''); setXmppError('');
    const payload = { id: ips.packageUUID };
    let url;
    if (sendMode === 'private') {
      payload.from = selectedOccupant;
      url = '/xmpp/xmpp-ips-private';
    } else {
      url = '/xmpp/xmpp-ips';
    }
    axios.post(url, payload)
      .then(() => setXmppMessageStatus('Message sent!'))
      .catch(() => setXmppError('Failed to send message'));
  };


  return (
    <div className="ips" onDoubleClick={() => setExpanded(expanded ? false : true)}>
      <div className="ips-buttons">
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

        <OverlayTrigger placement="top" overlay={renderTooltip('Send to XMPP')}>
          <Button variant="outline-secondary" className="qr-button custom-button" onClick={openXMPPModal}>
            <FontAwesomeIcon icon={faCommentDots} />
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
      <div className="ips-details">
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
            <p>DOB: {formatDateNoTime(ips.patient.dob)}</p>
            <p>Gender: {ips.patient.gender}</p>
            <p>Country: {ips.patient.nation}</p>
            <p>Practitioner: {ips.patient.practitioner}</p>
            <p>Organization: {ips.patient.organization}</p>

            {ips.medication && ips.medication.length > 0 && (
              <>
                <h4>Medications:</h4>
                <div className="table-responsive">
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
                </div>
              </>
            )}

            {ips.allergies && ips.allergies.length > 0 && (
              <>
                <h4>Allergies:</h4>
                <div className="table-responsive">
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
                          <td>{formatDateNoTime(allergy.date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {ips.conditions && ips.conditions.length > 0 && (
              <>
                <h4>Conditions:</h4>
                <div className="table-responsive">
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
                          <td>{formatDateNoTime(condition.date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {ips.observations && ips.observations.length > 0 && (
              <>
                <h4>Observations:</h4>
                <div className="table-responsive">
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
                </div>
              </>
            )}

            {ips.immunizations && ips.immunizations.length > 0 && (
              <>
                <h4>Immunizations:</h4>
                <div className="table-responsive">
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
                </div>
              </>
            )}

            <Button variant="link" onClick={() => setExpanded(false)}>
              Show Less
            </Button>
          </>
        )}
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
          <Modal.Title className="ipsedit">Edit Patient</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* validation error */}
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
          </ToastContainer>          <Form>
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
            <h4 className="ipsedit">Medications:</h4>
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <colgroup>
                  <col style={{ width: '50%' }} />  {/* Name */}
                  <col style={{ width: '7%' }} />  {/* Code */}
                  <col style={{ width: '7%' }} />  {/* System */}
                  <col style={{ width: '5%' }} />  {/* Date */}
                  <col style={{ width: '26%' }} />  {/* Dosage */}
                  <col style={{ width: '5%' }} />  {/* Actions */}
                </colgroup>
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
                        <Button variant="outline-danger" className="resp-button" onClick={() => handleRemoveItem("medication", index)}>
                          <FontAwesomeIcon icon={faTrash} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="primary" className="resp-add-button" onClick={() => handleAddItem("medication")}>
              Add Medication
            </Button>

            {/* Allergies Table */}
            <h4 className="ipsedit">Allergies:</h4>
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <colgroup>
                  <col style={{ width: '50%' }} />  {/* Name */}
                  <col style={{ width: '7%' }} />  {/* Code */}
                  <col style={{ width: '7%' }} />  {/* System */}
                  <col style={{ width: '5%' }} />  {/* Date */}
                  <col style={{ width: '26%' }} />  {/* Criticality */}
                  <col style={{ width: '5%' }} />  {/* Actions */}
                </colgroup>
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
                          value={formatDateNoTime(allergy.date)}
                          onChange={(e) => handleChangeItem("allergies", index, e)}
                        />
                      </td>
                      <td>
                        <Button variant="outline-danger" className="resp-button" onClick={() => handleRemoveItem("allergies", index)}>
                          <FontAwesomeIcon icon={faTrash} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="primary" className="resp-add-button" onClick={() => handleAddItem("allergies")}>
              Add Allergy
            </Button>

            {/* Conditions Table */}
            <h4 className="ipsedit">Conditions:</h4>
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <colgroup>
                  <col style={{ width: '40%' }} />  {/* Name */}
                  <col style={{ width: '4%' }} />  {/* Code */}
                  <col style={{ width: '4%' }} />  {/* System */}
                  <col style={{ width: '5%' }} />  {/* Date */}
                  <col style={{ width: '5%' }} />  {/* Actions */}
                </colgroup>
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
                          value={formatDateNoTime(condition.date)}
                          onChange={(e) => handleChangeItem("conditions", index, e)}
                        />
                      </td>
                      <td>
                        <Button variant="outline-danger" className="resp-button" onClick={() => handleRemoveItem("conditions", index)}>
                          <FontAwesomeIcon icon={faTrash} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="primary" className="resp-add-button" onClick={() => handleAddItem("conditions")}>
              Add Condition
            </Button>

            {/* Observations Table */}
            <h4 className="ipsedit">Observations: Enter Value as val-space-unit e.g. 60 bpm</h4>
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <colgroup>
                  <col style={{ width: '50%' }} />  {/* Name */}
                  <col style={{ width: '4%' }} />  {/* Code */}
                  <col style={{ width: '4%' }} />  {/* System */}
                  <col style={{ width: '5%' }} />  {/* Date */}
                  <col style={{ width: '10%' }} />  {/* Value */}
                  <col style={{ width: '5%' }} />  {/* Actions */}
                </colgroup>
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
                          // Add hover
                          placeholder="Val Unit"
                          value={observation.value}
                          onChange={(e) => handleChangeItem("observations", index, e)}
                        />
                      </td>
                      <td>
                        <Button variant="outline-danger" className="resp-button" onClick={() => handleRemoveItem("observations", index)}>
                          <FontAwesomeIcon icon={faTrash} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="primary" className="resp-add-button" onClick={() => handleAddItem("observations")}>
              Add Observation
            </Button>

            {/* Immunizations Table */}
            <h4 className="ipsedit">Immunizations:</h4>
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
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
                        <Button variant="outline-danger" className="resp-button" onClick={() => handleRemoveItem("immunizations", index)}>
                          <FontAwesomeIcon icon={faTrash} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="primary" className="resp-add-button" onClick={() => handleAddItem("immunizations")}>
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

      {/* XMPP Send Modal */}
      <Modal show={showXMPPModal} onHide={closeXMPPModal}>
        <Modal.Header closeButton>
          <Modal.Title>Send IPS to XMPP</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingOccupants && <Spinner animation="border" />}
          {xmppError && <div className="text-danger">{xmppError}</div>}
          {!loadingOccupants && !xmppError && (
            <Form>
              <Form.Group>
                <Form.Check
                  inline
                  type="radio"
                  label="Room"
                  name="sendMode"
                  id="mode-room"
                  checked={sendMode === 'room'}
                  onChange={() => setSendMode('room')}
                />
                <Form.Check
                  inline
                  type="radio"
                  label="Private"
                  name="sendMode"
                  id="mode-private"
                  checked={sendMode === 'private'}
                  onChange={() => setSendMode('private')}
                />
              </Form.Group>
              {sendMode === 'private' && (
                <Form.Group controlId="selectOccupant">
                  <Form.Label>Select User</Form.Label>
                  <Form.Control
                    as="select"
                    value={selectedOccupant}
                    onChange={e => setSelectedOccupant(e.target.value)}
                  >
                    <option value="">-- choose --</option>
                    {occupants.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </Form.Control>
                </Form.Group>
              )}
            </Form>
          )}
          {xmppMessageStatus && <div className="text-success mt-2">{xmppMessageStatus}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeXMPPModal}>Cancel</Button>
          <Button
            variant="primary"
            disabled={sendMode === 'private' && !selectedOccupant}
            onClick={handleSendXMPP}
          >Send</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}