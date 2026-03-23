import React from "react";
import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileMedical,
  faQrcode,
  faTrash,
  faBeer,
  faEdit,
  faFileExport,
  faUpload,
  faCommentDots,
  faEye,
  faAmbulance,
  faMapMarked,
} from "@fortawesome/free-solid-svg-icons";

const renderTooltip = (text) => (
  <Tooltip id={`tooltip-${text}`}>{text}</Tooltip>
);

export default function IPSActionButtons({
  onSelect,
  onGeneratePDF,
  onOpenPMR,
  onOpenXMPP,
  onSendTAK,
  onEdit,
  onRemove,
}) {
  return (
    <div className="ips-buttons">
      <OverlayTrigger placement="top" overlay={renderTooltip("View IPS API Page")}>
        <Link to="/api">
          <Button variant="outline-secondary" className="qr-button custom-button" onClick={onSelect}>
            <FontAwesomeIcon icon={faFileMedical} />
          </Button>
        </Link>
      </OverlayTrigger>

      <OverlayTrigger placement="top" overlay={renderTooltip("Visit Viewer Page")}>
        <Link to="/viewer">
          <Button variant="outline-secondary" className="qr-button custom-button" onClick={onSelect}>
            <FontAwesomeIcon icon={faEye} />
          </Button>
        </Link>
      </OverlayTrigger>

      <OverlayTrigger placement="top" overlay={renderTooltip("View Animated QR Code Page")}>
        <Link to="/animatedqr2">
          <Button variant="outline-secondary" className="qr-button custom-button" onClick={onSelect}>
            <FontAwesomeIcon icon={faQrcode} />
          </Button>
        </Link>
      </OverlayTrigger>

      <OverlayTrigger placement="top" overlay={renderTooltip("View BEER Garden Page")}>
        <Link to="/beergarden">
          <Button variant="outline-secondary" className="qr-button custom-button" onClick={onSelect}>
            <FontAwesomeIcon icon={faBeer} />
          </Button>
        </Link>
      </OverlayTrigger>

      <OverlayTrigger placement="top" overlay={renderTooltip("View External POST Page")}>
        <Link to="/puships">
          <Button variant="outline-secondary" className="qr-button custom-button" onClick={onSelect}>
            <FontAwesomeIcon icon={faUpload} />
          </Button>
        </Link>
      </OverlayTrigger>

      <OverlayTrigger placement="top" overlay={renderTooltip("Generate PDF")}>
        <Button variant="outline-secondary" className="qr-button custom-button" onClick={onGeneratePDF}>
          <FontAwesomeIcon icon={faFileExport} />
        </Button>
      </OverlayTrigger>

      <OverlayTrigger placement="top" overlay={renderTooltip("Send PMR to MMP")}>
        <Button variant="outline-secondary" className="qr-button custom-button" onClick={onOpenPMR}>
          <FontAwesomeIcon icon={faAmbulance} />
        </Button>
      </OverlayTrigger>

      <OverlayTrigger placement="top" overlay={renderTooltip("Send to JChat/XMPP")}>
        <Button variant="outline-secondary" className="qr-button custom-button" onClick={onOpenXMPP}>
          <FontAwesomeIcon icon={faCommentDots} />
        </Button>
      </OverlayTrigger>

      <OverlayTrigger placement="top" overlay={renderTooltip("Send to TAK")}>
        <Button variant="outline-secondary" className="qr-button custom-button" onClick={onSendTAK}>
          <FontAwesomeIcon icon={faMapMarked} />
        </Button>
      </OverlayTrigger>

      <OverlayTrigger placement="top" overlay={renderTooltip("Edit IPS Record")}>
        <Button variant="outline-secondary" className="custom-button" onClick={onEdit}>
          <FontAwesomeIcon icon={faEdit} />
        </Button>
      </OverlayTrigger>

      <OverlayTrigger placement="top" overlay={renderTooltip("Delete IPS Record")}>
        <Button variant="outline-danger" className="custom-button" onClick={onRemove}>
          <FontAwesomeIcon icon={faTrash} />
        </Button>
      </OverlayTrigger>
    </div>
  );
}