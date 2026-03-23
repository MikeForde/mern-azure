import React from "react";
import { Toast, ToastContainer } from "react-bootstrap";

export default function IPSResponseToasts({
  showPmrAlert,
  setShowPmrAlert,
  pmrAlertVariant,
  pmrMessage,
  showTakAlert,
  setShowTakAlert,
  takAlertVariant,
  takMessage,
}) {
  return (
    <>
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

      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        <Toast
          show={showTakAlert}
          onClose={() => setShowTakAlert(false)}
          bg={takAlertVariant}
          delay={5000}
          autohide
        >
          <Toast.Header>
            <strong className="me-auto">TAK Response</strong>
          </Toast.Header>
          <Toast.Body>
            <pre className="mb-0 text-white" style={{ whiteSpace: "pre-wrap", maxHeight: "200px", overflowY: "auto" }}>
              {takMessage}
            </pre>
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </>
  );
}