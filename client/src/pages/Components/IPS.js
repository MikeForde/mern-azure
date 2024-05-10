import React, { useState } from "react";
import { Button, Modal, OverlayTrigger, Tooltip } from "react-bootstrap";
import { Link } from "react-router-dom";
import { faFileMedical, faQrcode } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import "./components.css";

export function IPS({ ips, remove }) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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
            <p>Patient Name: {ips.patient.name}</p>
            <p>Patient Given: {ips.patient.given}</p>
            <p>Patient DOB: {ips.patient.dob}</p>
            <p>Patient Nationality: {ips.patient.nationality}</p>
            <p>Patient Practitioner: {ips.patient.practitioner}</p>
            <h4>Medications:</h4>
            <ul>
              {ips.medication.map((med, index) => (
                <li key={index}>
                  Med: {med.name} - Date: {med.date} - Dosage: {med.dosage}
                </li>
              ))}
            </ul>
            <h4>Allergies:</h4>
            <ul>
              {ips.allergies.map((allergy, index) => (
                <li key={index}>
                  Allergy: {allergy.name} - Severity: {allergy.severity} - Date: {allergy.date}
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
                overlay={renderTooltip('View IPS API')}
            >
                <Link to={`/api/${ips._id}`}>
                    <Button variant="outline-secondary" className="qr-button custom-button">
                        <FontAwesomeIcon icon={faFileMedical} />
                    </Button>
                </Link>
            </OverlayTrigger>

            {/* Button to navigate to QR page */}
            <OverlayTrigger
                placement="top"
                overlay={renderTooltip('View QR Code')}
            >
                <Link to={`/qr/${ips._id}`}>
                    <Button variant="outline-secondary" className="qr-button custom-button">
                        <FontAwesomeIcon icon={faQrcode} />
                    </Button>
                </Link>
            </OverlayTrigger>

            {/* Button to handle removal */}
            <OverlayTrigger
                placement="top"
                overlay={renderTooltip('Remove')}
            >
                <Button variant="outline-danger" className="custom-button" onClick={handleRemove}>
                    🗑️
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
