import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Button, Alert, Form, DropdownButton, Dropdown } from 'react-bootstrap';
import './Page.css';

function APIGETPage() {
    const { id } = useParams();
    const [ipsRecords, setIPSRecords] = useState([]);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [data, setData] = useState('');
    const [mode, setMode] = useState('ips');
    const [showNotification, setShowNotification] = useState(false);

    useEffect(() => {
        // Fetch IPS records
        axios.get('/ips/all')
            .then(response => {
                setIPSRecords(response.data);
                // Find the record matching the ID parameter
                let record;
                if (id) {
                    record = response.data.find(record => record._id === id);
                } else {
                    record = response.data[0]; // Select the first record if no ID is provided
                }
                setSelectedRecord(record);
            })
            .catch(error => {
                console.error('Error fetching IPS records:', error);
            });
    }, [id]);

    const handleRecordChange = (recordId) => {
        const record = ipsRecords.find(record => record._id === recordId);
        setSelectedRecord(record);
    };

    useEffect(() => {
        if (selectedRecord) {
            const endpoint = `/${mode}/${selectedRecord._id}`;

            axios.get(endpoint)
                .then(response => {
                    let responseData;
                    if (mode === 'ipsbasic') {
                        responseData = response.data;
                    } else if (mode === 'ipsxml') {
                        // Convert XML string to formatted text
                        responseData = formatXML(response.data);
                    } else {
                        responseData = JSON.stringify(response.data, null, 2);
                    }


                    setData(responseData);
                    console.log('Data:', responseData);
                    setShowNotification(false);
                    
                })
                .catch(error => {
                    console.error('Error fetching IPS record:', error);
                });
        }
    }, [selectedRecord, mode]);

    useEffect(() => {
        if (data && mode === 'ips') {
            navigator.clipboard.writeText(data)
                .then(() => console.log('Data copied to clipboard:', data))
                .catch(error => console.error('Error copying data to clipboard:', error));
        }
    }, [data, mode]);

    const handleDownloadData = () => {
        const blob = new Blob([data], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'ips_data.txt');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleModeChange = (selectedMode) => {
        setMode(selectedMode);
    };

    // Function to format XML string for better display
    const formatXML = (xml) => {
        const formatted = xml.replace(/></g, '>\n<');
        return formatted;
    };

    return (
        <div className="app">
            <div className="container">
                <h3>API GET - IPS Data</h3>
                <div className="dropdown-container">
                    <DropdownButton id="dropdown-record" title="Select Record" onSelect={handleRecordChange} className="dropdown-button">
                        {ipsRecords.map(record => (
                            <Dropdown.Item key={record._id} eventKey={record._id} active={selectedRecord && selectedRecord._id === record._id}>
                                {record.packageUUID}
                            </Dropdown.Item>
                        ))}
                    </DropdownButton>
                </div>
                <div className="dropdown-container">
                    <DropdownButton id="dropdown-mode" title={`Select Mode: ${mode}`} onSelect={handleModeChange} className="dropdown-button">
                        <Dropdown.Item eventKey="ips">IPS JSON Bundle - /ips/:id</Dropdown.Item>
                        <Dropdown.Item eventKey="ipsxml">IPS XML Bundle - /ipsxml/:id</Dropdown.Item>
                        <Dropdown.Item eventKey="ipslegacy">IPS Legacy JSON Bundle - /ipslegacy/:id</Dropdown.Item>
                        <Dropdown.Item eventKey="ipsraw">IPS MongoDB Record - /ipsraw/:id</Dropdown.Item>
                        <Dropdown.Item eventKey="ipsbasic">IPS Minimal - /ipsbasic/:id</Dropdown.Item>
                    </DropdownButton>
                </div>
                {showNotification ? (
                    <Alert variant="danger">Data is too large to display. Please try a different mode.</Alert>
                ) : (
                    <div className="text-area">
                        <Form.Control as="textarea" rows={10} value={data} readOnly />
                    </div>
                )}
                <br />
                <div className="button-container">
                    <Button className="mb-3" onClick={handleDownloadData}>Download Data</Button>
                    {mode === 'ips' && (
                        <Button variant="primary" className="mb-3" onClick={() => window.open('https://ipsviewer.com', '_blank')}>
                            Open IPS Viewer and Paste Data
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default APIGETPage;
