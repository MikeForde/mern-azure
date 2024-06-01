import React, { useState } from 'react';
import { Button, Modal, Form } from 'react-bootstrap';
import axios from 'axios';
import './Page.css';
import { useLoading } from '../contexts/LoadingContext';

function DataUploadPage() {
  const [data, setData] = useState('');
  const [validatedRecords, setValidatedRecords] = useState([]);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showNoRecordsPassed, setShowNoRecordsPassed] = useState(false);
  const { startLoading, stopLoading } = useLoading();

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
      if (fields.length !== 10) {
        console.error('Invalid number of fields:', fields);
        return null; // Skip record if number of fields is not 7
      }

      const [packageUUID, name, given, dob, gender, nation, practitioner, ...rest] = fields;

      // Validate required fields
      if (!packageUUID || !name || !given || !dob || !gender || !nation || !practitioner) {
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

      // Check if gender is just single letter and if so make full work e.g. f --> Female, m-->Male, u--->Unknown, o--->Other
      let genderFinal = gender;

      const genderMap = {
        f: 'Female',
        m: 'Male',
        u: 'Unknown',
        o: 'Other'
      };
      const genderFull = genderMap[
        gender.toLowerCase() // Convert to lowercase to handle both upper and lower case
      ];
      if (genderFull) { genderFinal = genderFull; }

      const timeStamp = new Date().toISOString();

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
          const [allergyName, allergyCriticality, allergyDate] = allergiesData.slice(i, i + 3);
          if (!allergyName || !allergyCriticality || !allergyDate) {
            console.error('Missing allergy field:', allergiesData.slice(i, i + 3));
            return null; // Skip record if any allergy field is missing
          }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(allergyDate)) {
            console.error('Invalid date format for allergy date:', allergyDate);
            return null; // Skip record if allergy date is not in yyyy-mm-dd format
          }
          // As we are only interested in active allergies
          // The data is already sorted in reverse chronological order
          // So we can just keep the first occurrence of each allergy
          // We need to trim the allergy name as there are leading/trailing spaces in the data
          const allergyTrimName = allergyName.trim();

          const existingAllergy = allergies.find(allergy => allergy.name === allergyTrimName);
          if (!existingAllergy)  {
            allergies.push({
              name: allergyTrimName,
              criticality: allergyCriticality,
              date: allergyDate
            });
          }
        }
      }

      // Create Conditions array
      const conditions = [];
      if (rest[2]) {
        const conditionsData = rest[2].split(';');
        if (conditionsData.length % 2 !== 0) {
          console.error('Invalid conditions data:', rest[2]);
          return null; // Skip record if conditions data is not in multiples of two
        }
        for (let i = 0; i < conditionsData.length; i += 2) {
          const [conditionName, conditionDate] = conditionsData.slice(i, i + 2);
          if (!conditionName || !conditionDate) {
            console.error('Missing condition field:', conditionsData.slice(i, i + 2));
            return null; // Skip record if any condition field is missing
          }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(conditionDate)) {
            console.error('Invalid date format for condition date:', conditionDate);
            return null; // Skip record if condition date is not in yyyy-mm-dd format
          }
          // As we are only interested in active conditions
          // The data is already sorted in reverse chronological order
          // So we can just keep the first occurrence of each condition
          // We need to trim the condition name as there are leading/trailing spaces in the data
          const conditionTrimName = conditionName.trim();
          
          const existingCondition = conditions.find(condition => condition.name === conditionTrimName);
          if (!existingCondition) {
            conditions.push({
              name: conditionTrimName,
              date: conditionDate
            });
          }
        }
      }

      return {
        packageUUID,
        timeStamp,
        patient: {
          name,
          given,
          dob,
          gender: genderFinal,
          nation,
          practitioner
        },
        medication,
        allergies,
        conditions
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
    startLoading();
    //Send the IPS records to the server
    axios.post('/ipsmany', validatedRecords)
      .then(response => {
        console.log('Data uploaded successfully:', response.data);
        // Add your logic here to handle successful upload
      })
      .catch(error => {
        console.error('Error uploading data:', error);
        // Add your logic here to handle errors
      })
      .finally(() => {
        // Stop the loading spinner
        stopLoading();
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
