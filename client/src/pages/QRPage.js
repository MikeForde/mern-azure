import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode.react';
import axios from 'axios';
import './HomePage.css'; 
import { Button } from 'react-bootstrap';

function QRPage() {
    //const { id } = useParams();
    const [ipsRecords, setIPSRecords] = useState([]);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [qrData, setQRData] = useState('');
    const [mode, setMode] = useState('ips');

    useEffect(() => {
        // Fetch IPS records
        axios.get('/ips/all')
            .then(response => {
                setIPSRecords(response.data);
                setSelectedRecord(response.data[0]); // Select the first record by default
            })
            .catch(error => {
                console.error('Error fetching IPS records:', error);
            });
    }, []);

    const handleRecordChange = (e) => {
        const selectedId = e.target.value;
        const record = ipsRecords.find(record => record._id === selectedId);
        setSelectedRecord(record);
    };

    // Fetch QR data based on selected record and mode
    useEffect(() => {
        if (selectedRecord) {
            const endpoint = mode === 'ips' ? `/ips/${selectedRecord._id}` : `/ipsraw/${selectedRecord._id}`;
            axios.get(endpoint)
                .then(response => {
                    setQRData(JSON.stringify(response.data));
                })
                .catch(error => {
                    console.error('Error fetching IPS record:', error);
                });
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
                <h1>Generate QR Code</h1>
                <div>
                    <label>Select Record:</label>
                    <select value={selectedRecord ? selectedRecord._id : ''} onChange={handleRecordChange}>
                        {ipsRecords.map(record => (
                            <option key={record._id} value={record._id}>{record.packageUUID}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label>Select Mode:</label>
                    <select value={mode} onChange={handleModeChange}>
                        <option value="ips">IPS</option>
                        <option value="ipsraw">IPS Raw</option>
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
