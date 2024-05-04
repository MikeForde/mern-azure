import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode.react';
import axios from 'axios';
import './HomePage.css';
import { Button } from 'react-bootstrap';

function QRPage() {
    const { id } = useParams();
    const [ipsRecords, setIPSRecords] = useState([]);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [qrData, setQRData] = useState('');
    const [mode, setMode] = useState('ips');

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

    const handleRecordChange = (e) => {
        const selectedId = e.target.value;
        const record = ipsRecords.find(record => record._id === selectedId);
        setSelectedRecord(record);
    };

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
            } else {
                axios.get(endpoint)
                .then(response => {
                    if (mode === 'ipsminimal') {
                        setQRData(response.data);
                    } else {
                        setQRData(JSON.stringify(response.data));
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

    const handleModeChange = (e) => {
        setMode(e.target.value);
    };

    return (
        <div className="app">
            <div className="container">
                <h3>Generate QR Code</h3>
                <div>
                    <label>Select Record: </label>
                    <select value={selectedRecord ? selectedRecord._id : ''} onChange={handleRecordChange}>
                        {ipsRecords.map(record => (
                            <option key={record._id} value={record._id}>{record.packageUUID}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label>Select Mode: </label>
                    <select value={mode} onChange={handleModeChange}>
                        <option value="ips">IPS JSON Bundle</option>
                        <option value="ipsraw">IPS MongoDB Record</option>
                        <option value="ipsminimal">IPS Minimal</option>
                        <option value="ipsurl">IPS URL for Patient</option>
                    </select>
                </div>
                <div style={{ width: '400px', height: '400px' }}>
                    {qrData && (
                        <QRCode id="qr-canvas" value={qrData} size={400} />
                    )}
                </div>
                <br />
                <Button className="mb-3" onClick={handleDownloadQR}>Download QR Code</Button>
            </div>
        </div>
    );
}

export default QRPage;
