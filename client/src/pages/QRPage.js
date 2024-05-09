import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode.react';
import axios from 'axios';
import { Button, Alert, DropdownButton, Dropdown } from 'react-bootstrap';
import './HomePage.css';

function QRPage() {
    const { id } = useParams();
    const [ipsRecords, setIPSRecords] = useState([]);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [qrData, setQRData] = useState('');
    const [mode, setMode] = useState('ipsurl');
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

    const THRESHOLD = 3000;

    // Fetch QR data based on selected record and mode
    useEffect(() => {
        if (selectedRecord) {
            let endpoint;
            if (mode === 'ips') {
                endpoint = `/ips/${selectedRecord._id}`;
            } else if (mode === 'ipsraw') {
                endpoint = `/ipsraw/${selectedRecord._id}`;
            } else if (mode === 'ipsminimal') {
                endpoint = `/ipsbasic/${selectedRecord._id}`;
            }

            if (mode === 'ipsurl') {
                const baseUrl = window.location.origin; // Get the base URL of the application
                const url = `${baseUrl}/ips/${selectedRecord._id}`;
                setQRData(url);
                setShowNotification(false);
            } else {
                axios.get(endpoint)
                    .then(response => {
                        let responseData;
                        if (mode === 'ipsminimal') {
                            responseData = response.data;
                        } else {
                            responseData = JSON.stringify(response.data);
                        }

                        console.log('Response data length:', responseData.length);

                        if (responseData.length > THRESHOLD) {
                            setShowNotification(true);
                        } else {
                            setQRData(responseData);
                            console.log('QR Data:', responseData);
                            setShowNotification(false);
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching IPS record:', error);
                    });
            }
        }
    }, [selectedRecord, mode]);

    const handleDownloadQR = () => {
        const canvas = document.getElementById('qr-canvas');
        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = 'ips_qr_code.png';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    const handleModeChange = (selectedMode) => {
        setMode(selectedMode);
    };

    return (
        <div className="app">
            <div className="container">
                <h3>Generate QR Code</h3>
                <div>
                    <label>Select Record: </label>
                    <DropdownButton id="dropdown-record" title="Select Record" onSelect={handleRecordChange}>
                        {ipsRecords.map(record => (
                            <Dropdown.Item key={record._id} eventKey={record._id} active={selectedRecord && selectedRecord._id === record._id}>
                                {record.packageUUID}
                            </Dropdown.Item>
                        ))}
                    </DropdownButton>
                </div>
                <div>
                    <label>Select Mode: </label>
                    <DropdownButton id="dropdown-mode" title={`Select Mode: ${mode}`} onSelect={handleModeChange}>
                        <Dropdown.Item eventKey="ips">IPS JSON Bundle</Dropdown.Item>
                        <Dropdown.Item eventKey="ipsraw">IPS MongoDB Record</Dropdown.Item>
                        <Dropdown.Item eventKey="ipsminimal">IPS Minimal</Dropdown.Item>
                        <Dropdown.Item eventKey="ipsurl">IPS URL for Patient</Dropdown.Item>
                    </DropdownButton>
                </div>
                {showNotification ? (
                    <Alert variant="danger">QR data is too large to display. Please try a different mode.</Alert>
                ) : (
                    <div style={{ width: '400px', height: '400px' }}>
                        {qrData && (
                            <QRCode id="qr-canvas" value={qrData} size={400} />
                        )}
                    </div>
                )}
                <br />
                <Button className="mb-3" onClick={handleDownloadQR}>Download QR Code</Button>
            </div>
        </div>
    );
}

export default QRPage;
