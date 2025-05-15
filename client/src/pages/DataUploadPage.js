import React, { useState } from 'react';
import { Button, Modal, Form } from 'react-bootstrap';
import axios from 'axios';
import './Page.css';
import { useLoading } from '../contexts/LoadingContext';

function DataUploadPage() {
  const [data, setData] = useState('');
  const [validatedRecords, setValidatedRecords] = useState([]);
  const [validatedVariationRecords, setValidatedVariationRecords] = useState([]);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showConfirmationModalVar, setShowConfirmationModalVar] = useState(false);
  const [showNoRecordsPassed, setShowNoRecordsPassed] = useState(false);
  const [showNoRecordsPassedVar, setShowNoRecordsPassedVar] = useState(false);
  const { startLoading, stopLoading } = useLoading();

  // UUID validator
  const isValidUUID = (uuid) => {
    const UUIDPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return UUIDPattern.test(uuid);
  };

  // Generic parser for repeating groups
  const parseGroup = (field, chunkSize, validator) => {
    const arr = [];
    if (!field) return arr;
    const parts = field.split(';').map(x => x.trim());
    if (parts.length % chunkSize !== 0) {
      console.error('Invalid group data:', field);
      return null;
    }
    for (let i = 0; i < parts.length; i += chunkSize) {
      const chunk = parts.slice(i, i + chunkSize);
      if (validator && !validator(chunk)) {
        console.error('Validation failed for chunk:', chunk);
        return null;
      }
      arr.push(chunk);
    }
    return arr;
  };

  // Standard import (10 fields)
  const handleUpload = () => {
    if (!data.trim()) return;
    const lines = data.split(/\r?\n/).filter(l => l.trim());
    const delimiter = lines.some(l => l.includes('\t')) ? '\t' : ',';

    const records = lines.map(line => {
      const fields = line.split(delimiter).map(f => f.trim());
      if (fields.length !== 10) {
        console.error('Invalid number of fields:', fields);
        return null;
      }
      const [packageUUID, name, given, dob, gender, nation, practitioner, medsField, allergiesField, conditionsField] = fields;

      if (!packageUUID || !name || !given || !dob || !gender || !nation || !practitioner) {
        console.error('Missing required fields:', fields);
        return null;
      }

      if (!isValidUUID(packageUUID)) {
        console.error('Invalid UUID format for packageUUID:', packageUUID);
        return null;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        console.error('Invalid date format for dob:', dob);
        return null;
      }

      const genderMap = { f: 'female', m: 'male', u: 'unknown', o: 'other' };
      const genderFinal = genderMap[gender.toLowerCase()] || gender;
      const timeStamp = new Date().toISOString();

      const medChunks = parseGroup(medsField, 3, ([, date]) => /^\d{4}-\d{2}-\d{2}$/.test(date));
      if (medChunks === null) return null;
      const medication = medChunks.map(([nm, dt, dose]) => ({ name: nm, date: dt, dosage: dose }));

      const allergyChunks = parseGroup(allergiesField, 3, ([, , date]) => /^\d{4}-\d{2}-\d{2}$/.test(date));
      if (allergyChunks === null) return null;
      const allergies = [];
      allergyChunks.forEach(([nm, crit, dt]) => {
        const nameTrim = nm.trim();
        if (!allergies.some(a => a.name === nameTrim)) {
          allergies.push({ name: nameTrim, criticality: crit, date: dt });
        }
      });

      const conditionChunks = parseGroup(conditionsField, 2, ([, date]) => /^\d{4}-\d{2}-\d{2}$/.test(date));
      if (conditionChunks === null) return null;
      const conditions = [];
      conditionChunks.forEach(([nm, dt]) => {
        const nameTrim = nm.trim();
        if (!conditions.some(c => c.name === nameTrim)) {
          conditions.push({ name: nameTrim, date: dt });
        }
      });

      return { packageUUID, timeStamp, patient: { name, given, dob, gender: genderFinal, nation, practitioner }, medication, allergies, conditions };
    }).filter(r => r);

    console.log('Simple variant IPS Records:', records);
    console.log(JSON.stringify(records, null, 2));

    if (!records.length) {
      setShowNoRecordsPassed(true);
    } else {
      setValidatedRecords(records);
      setShowConfirmationModal(true);
    }
  };

  // Variation import (14 fields)
  const handleUploadVariation = () => {
    if (!data.trim()) return;
    const lines = data.split(/\r?\n/).filter(l => l.trim());
    const delimiter = lines.some(l => l.includes('\t')) ? '\t' : ',';

    const records = lines.map(line => {
      const fields = line.split(delimiter).map(f => f.trim());
      if (fields.length !== 14) {
        console.error('Invalid number of fields for variation:', fields);
        return null;
      }
      const [packageUUID, name, given, dob, gender, nation, practitioner, organization, identifier, identifier2,
             medsField, allergiesField, conditionsField, observationsField] = fields;

      if (!packageUUID || !name || !given || !dob || !gender || !nation || !practitioner || !organization || !identifier || !identifier2) {
        console.error('Missing required variation fields:', fields);
        return null;
      }

      if (!isValidUUID(packageUUID)) {
        console.error('Invalid UUID format for variation packageUUID:', packageUUID);
        return null;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        console.error('Invalid date format for variation dob:', dob);
        return null;
      }

      const genderMap = { f: 'female', m: 'male', u: 'unknown', o: 'other' };
      const genderFinal = genderMap[gender.toLowerCase()] || gender;
      const timeStamp = new Date().toISOString();

      const medChunks = parseGroup(medsField, 5, ([, date]) => /^\d{4}-\d{2}-\d{2}$/.test(date));
      if (medChunks === null) return null;
      const medication = medChunks.map(([nm, dt, dose, system, code]) => ({ name: nm, date: dt, dosage: dose, system, code }));

      const allergyChunks = parseGroup(allergiesField, 5, ([, ,  date]) => /^\d{4}-\d{2}-\d{2}$/.test(date));
      if (allergyChunks === null) return null;
      const allergies = [];
      allergyChunks.forEach(([nm, crit, dt, system, code]) => {
        const nameTrim = nm.trim();
        if (!allergies.some(a => a.name === nameTrim)) {
          allergies.push({ name: nameTrim, criticality: crit, date: dt, system, code });
        }
      });

      const condChunks = parseGroup(conditionsField, 4, ([, date]) => /^\d{4}-\d{2}-\d{2}$/.test(date));
      if (condChunks === null) return null;
      const conditions = [];
      condChunks.forEach(([nm, dt, system, code]) => {
        const nameTrim = nm.trim();
        if (!conditions.some(c => c.name === nameTrim)) {
          conditions.push({ name: nameTrim, date: dt, system, code });
        }
      });

      const obsChunks = parseGroup(observationsField, 5, ([, date]) => /^\d{4}-\d{2}-\d{2}$/.test(date));
      if (obsChunks === null) return null;
      const observations = obsChunks.map(([nm, dt, val, system, code]) => ({ name: nm, date: dt, value: val, system, code }));

      return { packageUUID, timeStamp, patient: { name, given, dob, gender: genderFinal, nation, practitioner, organization, identifier, identifier2 }, medication, allergies, conditions, observations };
    }).filter(r => r);

    console.log('Expanded variant IPS Records:', records);
    console.log(JSON.stringify(records, null, 2));

    if (!records.length) {
      setShowNoRecordsPassedVar(true);
    } else {
      setValidatedVariationRecords(records);
      setShowConfirmationModalVar(true);
    }
  };

  // Submit helper
  const submitRecords = (records, endpoint) => {
    startLoading();
    console.log('Submitting to', endpoint, records);
    axios.post(endpoint, records)
      .then(res => console.log('Success:', res.data))
      .catch(err => console.error('Upload error:', err))
      .finally(() => stopLoading());
  };

  return (
    <div className="app">
      <div className="container">
        <h3>Bulk Upload of Data for IPS <div className="noteFont">(DMICP[SmartDoc] or PatientGen[Excel/LO Calc])</div></h3>
        <div className="text-area">
          <Form.Control as="textarea"
            rows={10}
            value={data}
            onChange={e => setData(e.target.value)}
            placeholder="Paste your data here... (CSV or TSV)" />
        </div>
        <br />
        <Button className="mb-3" onClick={handleUpload}>Convert Data (simple variant)</Button>
        <Button className="mb-3" onClick={handleUploadVariation}>Convert Data (expanded variant)</Button>
        <div className="download-section mt-4">
  <h5>Download Patient Generator Tools: <div className="noteFont">Easy to customise with some basic VBA knowledge</div></h5>
  <Button
    as="a"
    href="/IPS_Patient_Generator-IPS_MERN_Compatible_Windows.xlsm"
    download
    className="mb-3"
  >
    Windows Excel (.xlsm)
  </Button>
  <Button
    as="a"
    href="/IPS_Patient_Generator-IPS_MERN_Compatible_Mac.xlsm"
    download
    className="mb-3"
  >
    Mac Excel (.xlsm)
  </Button>
  <Button
    as="a"
    href="/IPS_Patient_Generator-IPS_MERN_Compatible.ods"
    download
    className="mb-3"
  >
    LibreOffice Calc (.ods)
  </Button>
</div>

      </div>
      

      {/* Standard Modals */}
      <Modal show={showNoRecordsPassed} onHide={() => setShowNoRecordsPassed(false)}>
        <Modal.Header closeButton><Modal.Title>Import Error</Modal.Title></Modal.Header>
        <Modal.Body><p>No simple variant records passed validation. Please check your data.</p></Modal.Body>
        <Modal.Footer><Button onClick={() => setShowNoRecordsPassed(false)}>Close</Button></Modal.Footer>
      </Modal>
      <Modal show={showConfirmationModal} onHide={() => setShowConfirmationModal(false)}>
        <Modal.Header closeButton><Modal.Title>Submission Confirmation</Modal.Title></Modal.Header>
        <Modal.Body><p>{validatedRecords.length} Simple variant records valid. Submit?</p></Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmationModal(false)}>Cancel</Button>
          <Button onClick={() => { setShowConfirmationModal(false); submitRecords(validatedRecords, '/ipsmany'); setData(''); }}>Submit</Button>
        </Modal.Footer>
      </Modal>

      {/* Variation Modals */}
      <Modal show={showNoRecordsPassedVar} onHide={() => setShowNoRecordsPassedVar(false)}>
        <Modal.Header closeButton><Modal.Title>Import Error</Modal.Title></Modal.Header>
        <Modal.Body><p>No expanded variant records passed validation. Please check your data.</p></Modal.Body>
        <Modal.Footer><Button onClick={() => setShowNoRecordsPassedVar(false)}>Close</Button></Modal.Footer>
      </Modal>
      <Modal show={showConfirmationModalVar} onHide={() => setShowConfirmationModalVar(false)}>
        <Modal.Header closeButton><Modal.Title>Submission Confirmation</Modal.Title></Modal.Header>
        <Modal.Body><p>{validatedVariationRecords.length} Expanded variant records valid. Submit?</p></Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmationModalVar(false)}>Cancel</Button>
          <Button onClick={() => { setShowConfirmationModalVar(false); submitRecords(validatedVariationRecords, '/ipsmany'); setData(''); }}>Submit</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default DataUploadPage;
