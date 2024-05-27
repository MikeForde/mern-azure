import React, { useContext, useState } from "react";
import { Button, Modal, OverlayTrigger, Tooltip } from "react-bootstrap";
import { Link } from "react-router-dom";
import { faDownload, faFileMedical, faQrcode, faTrash, faBeer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { PatientContext } from '../../PatientContext'; // Import PatientContext
import "./components.css";

// Dates will be formatted as YYYY-MM-DD HH:MM:SS unless the time is 00:00:00
// In which case, only the date will be displayed as YYYY-MM-DD
const formatDate = (dateString) => {
  if (!dateString) return "";

  const [datePart, timePart] = dateString.split("T");
  const time = timePart.split(".")[0];

  return time === "00:00:00" ? datePart : `${datePart} ${time}`;
};

export function IPS({ ips, remove }) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { setSelectedPatient } = useContext(PatientContext); // Get setSelectedPatients from PatientContext

  const handleRemove = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = () => {
    remove(ips._id);
    setShowConfirmModal(false);
  };

  const handleCancelDelete = () => {
    setShowConfirmModal(false);
  };

  const handleSelection = () => {
    // Update selected patient in the context
    setSelectedPatient([ips]);
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
            <h4>Patient Details:</h4>
            <p>Name: {ips.patient.name}</p>
            <p>Given Name: {ips.patient.given}</p>
            <p>DOB: {ips.patient.dob.split("T")[0]}</p>
            <p>Gender: {ips.patient.gender}</p>
            <p>Country: {ips.patient.nation}</p>
            <p>Practitioner: {ips.patient.practitioner}</p>
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
            <Button variant="link" onClick={() => setExpanded(false)}>
              Show Less
            </Button>
          </>
        )}
      </div>
      <div>
        <OverlayTrigger
          placement="top"
          overlay={renderTooltip('View IPS API Page')}
        >
          <Link to="/api">
            <Button variant="outline-secondary" className="qr-button custom-button" onClick={handleSelection}>
              <FontAwesomeIcon icon={faFileMedical} />
            </Button>
          </Link>
        </OverlayTrigger>

        {/* Button to navigate to QR page */}
        <OverlayTrigger
          placement="top"
          overlay={renderTooltip('View QR Code Page')}
        >
          <Link to="/qr">
            <Button variant="outline-secondary" className="qr-button custom-button" onClick={handleSelection}>
              <FontAwesomeIcon icon={faQrcode} />
            </Button>
          </Link>
        </OverlayTrigger>

        {/* Button to navigate to BEER Garden Page */}
        <OverlayTrigger
          placement="top"
          overlay={renderTooltip('View BEER Garden Page')}
        >
          <Link to="/beergarden">
            <Button variant="outline-secondary" className="qr-button custom-button" onClick={handleSelection}>
              <FontAwesomeIcon icon={faBeer} />
            </Button>
          </Link>
        </OverlayTrigger>

        {/* Button to navigate to VitalsIQ POST Page */}
        <OverlayTrigger
          placement="top"
          overlay={renderTooltip('View VitalsIQ POST Page')}
        >
          <Link to="/offroadpost">
            <Button variant="outline-secondary" className="qr-button custom-button" onClick={handleSelection}>
              <FontAwesomeIcon icon={faDownload} />
            </Button>
          </Link>
        </OverlayTrigger>

        {/* Button to handle removal */}
        <OverlayTrigger
          placement="top"
          overlay={renderTooltip('Delete IPS Record')}
        >
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
    </div>
  );
}
