import React, { useState } from 'react';
import { Button, Modal, Form } from 'react-bootstrap';
import axios from 'axios';
import './Page.css';

function DataUploadPage() {
  const [data, setData] = useState('');
  const [validatedRecords, setValidatedRecords] = useState([]);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showNoRecordsPassed, setShowNoRecordsPassed] = useState(false);

  const handleUpload = () => {
    // Check if data is empty
    if (!data.trim()) {
      return;
    }

    // Split the data by lines to get individual records
    const records = data.split('\n'); // Split data into individual records
    const ipsRecords = records.map(record => {
      const fields = record.split(',');// Split record into fields

      // Validate number of fields
      if (fields.length !== 8) {
        console.error('Invalid number of fields:', fields);
        return null; // Skip record if number of fields is not 7
      }

      const [packageUUID, name, given, dob, nationality, practitioner, ...rest] = fields;

      // Validate required fields
      if (!packageUUID || !name || !given || !dob || !nationality || !practitioner) {
        console.error('Missing required fields:', fields);
        return null; // Skip record if any required field is missing
      }

      // Validate UUID format for packageUUID
      if (!isValidUUID(packageUUID)) {
        console.error('Invalid UUID format for packageUUID:', packageUUID);
        return null; // Skip record if packageUUID is not in a valid UUID format
      }

      // Validate date format for dob
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        console.error('Invalid date format for dob:', dob);
        return null; // Skip record if dob is not in yyyy-mm-dd format
      }

      // Create medication array
      const medication = [];
      if (rest[0]) {
        const medications = rest[0].split(';');
        if (medications.length % 3 !== 0) {
          console.error('Invalid medication data:', rest[0]);
          return null; // Skip record if medication data is not in multiples of three
        }
        for (let i = 0; i < medications.length; i += 3) {
          const [medicationName, medicationDate, medicationDosage] = medications.slice(i, i + 3);
          if (!medicationName || !medicationDate || !medicationDosage) {
            console.error('Missing medication field:', medications.slice(i, i + 3));
            return null; // Skip record if any medication field is missing
          }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(medicationDate)) {
            console.error('Invalid date format for medication date:', medicationDate);
            return null; // Skip record if medication date is not in yyyy-mm-dd format
          }
          medication.push({
            name: medicationName,
            date: medicationDate,
            dosage: medicationDosage
          });
        }
      }

      // Create allergies array
      const allergies = [];
      if (rest[1]) {
        const allergiesData = rest[1].split(';');
        if (allergiesData.length % 3 !== 0) {
          console.error('Invalid allergies data:', rest[1]);
          return null; // Skip record if allergies data is not in multiples of three
        }
        for (let i = 0; i < allergiesData.length; i += 3) {
          const [allergyName, allergySeverity, allergyDate] = allergiesData.slice(i, i + 3);
          if (!allergyName || !allergySeverity || !allergyDate) {
            console.error('Missing allergy field:', allergiesData.slice(i, i + 3));
            return null; // Skip record if any allergy field is missing
          }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(allergyDate)) {
            console.error('Invalid date format for allergy date:', allergyDate);
            return null; // Skip record if allergy date is not in yyyy-mm-dd format
          }
          allergies.push({
            name: allergyName,
            severity: allergySeverity,
            date: allergyDate
          });
        }
      }

      return {
        packageUUID,
        patient: {
          name,
          given,
          dob,
          nationality,
          practitioner
        },
        medication,
        allergies
      };
    }).filter(record => record !== null); // Remove null records (failed validation)


    console.log('IPS Records:', ipsRecords);
    console.log(JSON.stringify(ipsRecords, null, 2));

    if (ipsRecords.length === 0) {
      // No records passed validation, show a message to the user
      setShowNoRecordsPassed(true);
    } else {
      // Records passed validation, set them for confirmation and show the confirmation modal
      setValidatedRecords(ipsRecords);
      setShowConfirmationModal(true);
    }
  };

  const handleChange = (e) => {
    setData(e.target.value);
  };

  // Function to validate UUID format
  // Simple regex - this is isn't a proper validation for UUIDs but will do for this context
  const isValidUUID = (uuid) => {
    const UUIDPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return UUIDPattern.test(uuid);
  };

  const handleSubmit = () => {
    setShowConfirmationModal(false);

    //Send the IPS records to the server
    axios.post('/ipsmany', validatedRecords)
      .then(response => {
        console.log('Data uploaded successfully:', response.data);
        // Add your logic here to handle successful upload
      })
      .catch(error => {
        console.error('Error uploading data:', error);
        // Add your logic here to handle errors
      });

    // Clear the data entry textbox
    setData('');
  };

  return (
    <div className="app">
      <div className="container">
        <h3>Bulk Upload of DMICP Data for IPS</h3>
        {/* <textarea
          rows="10"
          cols="50"
          value={data}
          onChange={handleChange}
          placeholder="Paste your SmartDoc DMICP data here..."
        /> */}
        <div className="text-area">
                        <Form.Control as="textarea" 
                        rows={10} value={data} 
                        onChange={handleChange} 
                        placeholder="Paste your DMICP data here...&#13;&#10;(This should be the CSV format created using the IPS SmartDoc)" />
                    </div>
        <br />
        <Button className="mb-3" onClick={handleUpload}>Convert Pasted Data into IPS Records</Button>
      </div>
      <Modal show={showNoRecordsPassed} onHide={() => setShowNoRecordsPassed(false)}>
        <Modal.Header closeButton>
          <Modal.Title>IPS Import Error</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>No records passed validation. Please check your data and try again.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowNoRecordsPassed(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showConfirmationModal} onHide={() => setShowConfirmationModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>IPS Record Submission Confirmation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {validatedRecords.length > 0 && (
            <p>{validatedRecords.length} records have passed validation. Do you want to submit?</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmationModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>Submit</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default DataUploadPage;
