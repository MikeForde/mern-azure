import React from "react";
import { Button, Modal } from "react-bootstrap";

export default function IPSDeleteModal({
  show,
  onCancel,
  onConfirm,
  title = "Confirm Deletion",
  body = "Are you sure you want to delete this IPS record?",
  confirmText = "Delete",
  confirmVariant = "danger",
}) {
  return (
    <Modal show={show} onHide={onCancel}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body>{body}</Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>

        <Button variant={confirmVariant} onClick={onConfirm}>
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}