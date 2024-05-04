import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import './HomePage.css';

function DataUploadPage() {
  const [data, setData] = useState('');

  const handleUpload = () => {
    // Logic to handle data upload
    console.log('Uploaded data:', data);
    // You can add your logic here to process the uploaded data
  };

  const handleChange = (e) => {
    setData(e.target.value);
  };

  return (
    <div className="app">
      <div className="container">
        <h1>Bulk Upload of DMICP Data for IPS</h1>
        <textarea
          rows="10"
          cols="50"
          value={data}
          onChange={handleChange}
          placeholder="Paste your SmartDoc DMICP data here..."
        />
        <br />
        <Button className="mb-3" onClick={handleUpload}>Convert Pasted Data into IPS Records</Button>
      </div>
    </div>
  );
}

export default DataUploadPage;
