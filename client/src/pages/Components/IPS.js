import React, { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { Link } from "react-router-dom";
import { faQrcode } from '@fortawesome/free-solid-svg-icons';
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
        <Link to={`/qr/${ips._id}`}>
          <Button variant="outline-secondary" className="qr-button">
            <FontAwesomeIcon icon={faQrcode} />
          </Button>
        </Link>
        <Button variant="outline-danger" onClick={handleRemove}>
          🗑️
        </Button>
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
