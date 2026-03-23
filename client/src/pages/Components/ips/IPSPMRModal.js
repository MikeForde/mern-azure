import React from "react";
import { Button, Modal, Form, Spinner } from "react-bootstrap";

export default function IPSPMRModal({
  show,
  onHide,
  loadingMtfs,
  pmrUiError,
  mtfOptions,
  pmrFrom,
  setPmrFrom,
  pmrTo,
  setPmrTo,
  onSendQuick,
  onSendSelected,
}) {
  const invalidSelection = !pmrFrom || !pmrTo || pmrFrom === pmrTo;

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>Send PMR to MMP</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loadingMtfs && <Spinner animation="border" />}
        {pmrUiError && <div className="text-danger">{pmrUiError}</div>}

        {!loadingMtfs && !pmrUiError && (
          <Form>
            <Form.Group className="mb-3" controlId="pmrFrom">
              <Form.Label>From MTF</Form.Label>
              <Form.Control as="select" value={pmrFrom} onChange={(e) => setPmrFrom(e.target.value)}>
                <option value="">-- choose --</option>
                {mtfOptions.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </Form.Control>
            </Form.Group>

            <Form.Group className="mb-3" controlId="pmrTo">
              <Form.Label>To MTF</Form.Label>
              <Form.Control as="select" value={pmrTo} onChange={(e) => setPmrTo(e.target.value)}>
                <option value="">-- choose --</option>
                {mtfOptions.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </Form.Control>
            </Form.Group>

            {pmrFrom && pmrTo && pmrFrom === pmrTo && (
              <div className="text-danger">From and To must be different.</div>
            )}
          </Form>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cancel</Button>
        <Button variant="outline-secondary" onClick={onSendQuick}>Random</Button>
        <Button
          variant="primary"
          disabled={invalidSelection}
          onClick={onSendSelected}
        >
          Send
        </Button>
      </Modal.Footer>
    </Modal>
  );
}