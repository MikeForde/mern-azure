import React, { useContext, useState } from "react";
import axios from "axios";
import { PatientContext } from "../../PatientContext";
import { useLoading } from "../../contexts/LoadingContext";
import "./components.css";
import { generatePDF } from "./generatePDF";
import { isValidObservationValue, getObservationValueError } from "../../utils/observationValidation";
import { applyObservationPreset } from "../../utils/observationCatalog";

import IPSActionButtons from "./ips/IPSActionButtons";
import IPSDetails from "./ips/IPSDetails";
import IPSDeleteModal from "./ips/IPSDeleteModal";
import IPSResponseToasts from "./ips/IPSResponseToasts";
import IPSXMPPModal from "./ips/IPSXMPPModal";
import IPSPMRModal from "./ips/IPSPMRModal";
import IPSEditModal from "./ips/IPSEditModal";

export function IPS({ ips, remove, update }) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editIPS, setEditIPS] = useState({ ...ips });

  const { setSelectedPatient } = useContext(PatientContext);
  const { startLoading, stopLoading } = useLoading();

  const [pmrMessage, setPmrMessage] = useState("");
  const [pmrAlertVariant, setPmrAlertVariant] = useState("success");
  const [showPmrAlert, setShowPmrAlert] = useState(false);

  const [takMessage, setTakMessage] = useState("");
  const [takAlertVariant, setTakAlertVariant] = useState("success");
  const [showTakAlert, setShowTakAlert] = useState(false);

  const [showEditAlert, setShowEditAlert] = useState(false);
  const [editAlertMessage, setEditAlertMessage] = useState("");

  const [showXMPPModal, setShowXMPPModal] = useState(false);
  const [occupants, setOccupants] = useState([]);
  const [loadingOccupants, setLoadingOccupants] = useState(false);
  const [selectedOccupant, setSelectedOccupant] = useState("");
  const [sendMode, setSendMode] = useState("room");
  const [xmppMessageStatus, setXmppMessageStatus] = useState("");
  const [xmppError, setXmppError] = useState("");

  const [showPMRModal, setShowPMRModal] = useState(false);
  const [mtfOptions, setMtfOptions] = useState([]);
  const [loadingMtfs, setLoadingMtfs] = useState(false);
  const [pmrFrom, setPmrFrom] = useState("");
  const [pmrTo, setPmrTo] = useState("");
  const [pmrUiError, setPmrUiError] = useState("");

  const handleRemove = () => setShowConfirmModal(true);

  const handleConfirmDelete = () => {
    remove(ips._id);
    setShowConfirmModal(false);
  };

  const handleSelection = () => {
    setSelectedPatient([ips]);
    startLoading();
  };

  const handleEdit = () => {
    setEditIPS({ ...ips });
    setShowEditModal(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditIPS((prev) => ({
      ...prev,
      patient: {
        ...prev.patient,
        [name]: value,
      },
    }));
  };

  const handleSaveEdit = () => {
    for (const { value } of editIPS.observations) {
      if (!isValidObservationValue(value)) {
        setEditAlertMessage(getObservationValueError(value));
        setShowEditAlert(true);
        return;
      }
    }

    startLoading();
    axios.put(`/ips/${ips._id}`, editIPS)
      .then((response) => {
        update(response.data);
        setShowEditModal(false);
      })
      .catch((error) => console.error("There was an error updating the IPS record!", error))
      .finally(() => stopLoading());
  };

  const handleAddItem = (type) => {
    setEditIPS((prev) => ({
      ...prev,
      [type]: [
        ...prev[type],
        { name: "", date: "", dosage: "", criticality: "", value: "", system: "", code: "" },
      ],
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
      [type]: prev[type].map((item, i) => {
        if (i !== index) return item;

        if (type === "observations" && name === "name") {
          return applyObservationPreset(item, value);
        }

        return { ...item, [name]: value };
      }),
    }));
  };

  const handleGeneratePDF = () => generatePDF(ips);

  const handleSendTAK = () => {
    startLoading();
    axios.post(`/tak/ips`, { id: ips.packageUUID })
      .then((response) => {
        setTakMessage("TAK Response: " + JSON.stringify(response.data, null, 2));
        setTakAlertVariant("success");
        setShowTakAlert(true);
      })
      .catch((error) => {
        const data = error.response?.data;
        const msg =
          typeof data === "string"
            ? data
            : data?.error
              ? data.error
              : data
                ? JSON.stringify(data, null, 2)
                : error.message;

        console.error("Error sending TAK:", msg);
        setTakMessage(msg);
        setTakAlertVariant("danger");
        setShowTakAlert(true);
      })
      .finally(() => stopLoading());
  };

  const openXMPPModal = () => {
    setShowXMPPModal(true);
    setXmppMessageStatus("");
    setXmppError("");
    setLoadingOccupants(true);

    axios.get("/xmpp/xmpp-occupants")
      .then((res) => setOccupants(res.data.occupants || []))
      .catch(() => setXmppError("Failed to load occupants - is XMPP reachable?"))
      .finally(() => setLoadingOccupants(false));
  };

  const closeXMPPModal = () => {
    setShowXMPPModal(false);
    setSelectedOccupant("");
    setSendMode("room");
  };

  const handleSendXMPP = () => {
    setXmppMessageStatus("");
    setXmppError("");

    const payload = { id: ips.packageUUID };
    let url;

    if (sendMode === "private") {
      payload.from = selectedOccupant;
      url = "/xmpp/xmpp-ips-private";
    } else {
      url = "/xmpp/xmpp-ips";
    }

    axios.post(url, payload)
      .then(() => setXmppMessageStatus("Message sent!"))
      .catch(() => setXmppError("Failed to send message"));
  };

  const openPMRModal = () => {
    setShowPMRModal(true);
    setPmrUiError("");
    setPmrFrom("");
    setPmrTo("");
    setLoadingMtfs(true);

    axios.get("/api/pmr/mtfs")
      .then((res) => setMtfOptions(res.data.mtfs || []))
      .catch(() => setPmrUiError("Failed to load MTFs - is MMP reachable?"))
      .finally(() => setLoadingMtfs(false));
  };

  const closePMRModal = () => setShowPMRModal(false);

  const sendPMR = (from, to) => {
    startLoading();
    const qs = from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : "";

    axios.post(`/api/pmr/${ips._id}${qs}`)
      .then((response) => {
        setPmrMessage("PMR Response: " + JSON.stringify(response.data, null, 2));
        setPmrAlertVariant("success");
        setShowPmrAlert(true);
      })
      .catch((error) => {
        const errorMsg = error.response?.data ? error.response.data : error.message;
        console.error("Error sending PMR:", errorMsg);
        setPmrMessage(errorMsg);
        setPmrAlertVariant("danger");
        setShowPmrAlert(true);
      })
      .finally(() => stopLoading());
  };

  return (
    <div className="ips" onDoubleClick={() => setExpanded((prev) => !prev)}>
      <IPSActionButtons
        onSelect={handleSelection}
        onGeneratePDF={handleGeneratePDF}
        onOpenPMR={openPMRModal}
        onOpenXMPP={openXMPPModal}
        onSendTAK={handleSendTAK}
        onEdit={handleEdit}
        onRemove={handleRemove}
      />

      <IPSDetails ips={ips} expanded={expanded} setExpanded={setExpanded} />

      <IPSDeleteModal
        show={showConfirmModal}
        onCancel={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmDelete}
      />

      <IPSResponseToasts
        showPmrAlert={showPmrAlert}
        setShowPmrAlert={setShowPmrAlert}
        pmrAlertVariant={pmrAlertVariant}
        pmrMessage={pmrMessage}
        showTakAlert={showTakAlert}
        setShowTakAlert={setShowTakAlert}
        takAlertVariant={takAlertVariant}
        takMessage={takMessage}
      />

      <IPSEditModal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        editIPS={editIPS}
        handleEditChange={handleEditChange}
        handleChangeItem={handleChangeItem}
        handleRemoveItem={handleRemoveItem}
        handleAddItem={handleAddItem}
        handleSaveEdit={handleSaveEdit}
        showEditAlert={showEditAlert}
        setShowEditAlert={setShowEditAlert}
        editAlertMessage={editAlertMessage}
      />

      <IPSXMPPModal
        show={showXMPPModal}
        onHide={closeXMPPModal}
        loadingOccupants={loadingOccupants}
        xmppError={xmppError}
        sendMode={sendMode}
        setSendMode={setSendMode}
        occupants={occupants}
        selectedOccupant={selectedOccupant}
        setSelectedOccupant={setSelectedOccupant}
        xmppMessageStatus={xmppMessageStatus}
        onSend={handleSendXMPP}
      />

      <IPSPMRModal
        show={showPMRModal}
        onHide={closePMRModal}
        loadingMtfs={loadingMtfs}
        pmrUiError={pmrUiError}
        mtfOptions={mtfOptions}
        pmrFrom={pmrFrom}
        setPmrFrom={setPmrFrom}
        pmrTo={pmrTo}
        setPmrTo={setPmrTo}
        onSendQuick={() => sendPMR()}
        onSendSelected={() => {
          closePMRModal();
          sendPMR(pmrFrom, pmrTo);
        }}
      />
    </div>
  );
}