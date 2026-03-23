import React from "react";
import { Button, Modal, Form, Spinner } from "react-bootstrap";

export default function IPSXMPPModal({
  show,
  onHide,
  loadingOccupants,
  xmppError,
  sendMode,
  setSendMode,
  occupants,
  selectedOccupant,
  setSelectedOccupant,
  xmppMessageStatus,
  onSend,
}) {
  return (
    <Modal show={show} onHide={onHide}>
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
                checked={sendMode === "room"}
                onChange={() => setSendMode("room")}
              />
              <Form.Check
                inline
                type="radio"
                label="Private"
                name="sendMode"
                id="mode-private"
                checked={sendMode === "private"}
                onChange={() => setSendMode("private")}
              />
            </Form.Group>

            {sendMode === "private" && (
              <Form.Group controlId="selectOccupant">
                <Form.Label>Select User</Form.Label>
                <Form.Control
                  as="select"
                  value={selectedOccupant}
                  onChange={(e) => setSelectedOccupant(e.target.value)}
                >
                  <option value="">-- choose --</option>
                  {occupants.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Form.Control>
              </Form.Group>
            )}
          </Form>
        )}

        {xmppMessageStatus && <div className="text-success mt-2">{xmppMessageStatus}</div>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Cancel</Button>
        <Button
          variant="primary"
          disabled={sendMode === "private" && !selectedOccupant}
          onClick={onSend}
        >
          Send
        </Button>
      </Modal.Footer>
    </Modal>
  );
}