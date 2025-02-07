import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Button, Alert, Form, DropdownButton, Dropdown } from 'react-bootstrap';
import './Page.css';
import { PatientContext } from '../PatientContext';
import { useLoading } from '../contexts/LoadingContext';

function UnifiedPostPage() {
    const { selectedPatients, selectedPatient, setSelectedPatient } = useContext(PatientContext);
    const [data, setData] = useState('');
    const [message, setMessage] = useState('');
    const [showNotification, setShowNotification] = useState(false);
    const [target, setTarget] = useState('IPS SERN'); // options: "VitalsIQ", "NLD", "IPS SERN"
    const { startLoading, stopLoading } = useLoading();
    // Add these state variables at the top of your component:
    const [endpoint, setEndpoint] = useState('https://ips-d2s-uksc-medsnomed-medsno.apps.ocp1.azure.dso.digital.mod.uk/ipsbundle');
    const [dataFormat, setDataFormat] = useState('ipsunified'); // options: "ipsunified", "ips", "ipslegacy"
    const [hl7Wrapper, setHl7Wrapper] = useState(false);


    const handleRecordChange = (recordId) => {
        const record = selectedPatients.find(record => record._id === recordId);
        startLoading();
        setSelectedPatient(record);
    };

    useEffect(() => {
        if (selectedPatient) {
            // Build the GET endpoint based on the selected dataFormat.
            const getEndpoint = `/${dataFormat}/${selectedPatient._id}`;
            axios.get(getEndpoint)
                .then(response => {
                    let responseData = JSON.stringify(response.data, null, 2);
                    if (hl7Wrapper) {
                        responseData = `{\n  "hl7": ${responseData}\n}`;
                    }
                    setData(responseData);
                    setShowNotification(false);
                })
                .catch(error => {
                    console.error('Error fetching IPS record:', error);
                })
                .finally(() => {
                    stopLoading();
                });
        }
    }, [selectedPatient, dataFormat, hl7Wrapper, stopLoading]);


    const handlePushIPS = async () => {
        startLoading();
        try {
            const ipsData = JSON.parse(data);
            await axios.post('/puships', { ipsBundle: ipsData, endpoint, dataFormat, hl7Wrapper });
            setMessage('IPS data successfully pushed to the external server');
            setShowNotification(false);
        } catch (error) {
            console.error('Error pushing IPS data:', error);
            setShowNotification(true);
        } finally {
            stopLoading();
        }
    };


    return (
        <div className="app">
            <div className="container">
                <h3>External IPS API Page - POST (Push)</h3>
                {selectedPatients.length > 0 && selectedPatient && (
                    <div className="dropdown-container">
                        <DropdownButton
                            id="dropdown-record"
                            title={`Patient: ${selectedPatient.patient.given} ${selectedPatient.patient.name}`}
                            onSelect={handleRecordChange}
                            className="dropdown-button"
                        >
                            {selectedPatients.map(record => (
                                <Dropdown.Item
                                    key={record._id}
                                    eventKey={record._id}
                                    active={selectedPatient && selectedPatient._id === record._id}
                                >
                                    {record.patient.given} {record.patient.name}
                                </Dropdown.Item>
                            ))}
                        </DropdownButton>
                    </div>
                )}
                <div className="dropdown-container">
                    <DropdownButton
                        id="dropdown-target"
                        title={`Target Endpoint: ${target}`}
                        onSelect={(e) => {
                            setTarget(e);
                            if (e === "VitalsIQ") {
                                setEndpoint("https://4202xiwc.offroadapps.dev:62444/Fhir/ips/json");
                            } else if (e === "NLD") {
                                setEndpoint("https://medicalcloud.orange-synapse.nl/api/fhir/1");
                            } else if (e === "IPS SERN") {
                                setEndpoint("https://ips-d2s-uksc-medsnomed-medsno.apps.ocp1.azure.dso.digital.mod.uk/ipsbundle");
                            }
                        }}
                        className="dropdown-button"
                    >
                        <Dropdown.Item eventKey="IPS SERN" active={target === "IPS SERN"}>
                            IPS SERN
                        </Dropdown.Item>
                        <Dropdown.Item eventKey="NLD" active={target === "NLD"}>
                            NLD
                        </Dropdown.Item>
                        <Dropdown.Item eventKey="VitalsIQ" active={target === "VitalsIQ"}>
                            VitalsIQ
                        </Dropdown.Item>
                    </DropdownButton>
                </div>
                <div className="dropdown-container">
                    <DropdownButton
                        id="dropdown-dataFormat"
                        title={`Data Format: ${dataFormat === 'ipsunified'
                            ? 'IPS Unified'
                            : dataFormat === 'ips'
                                ? 'IPS Prev JSON'
                                : 'IPS Legacy'
                            }`}
                        onSelect={(e) => setDataFormat(e)}
                        className="dropdown-button"
                    >
                        <Dropdown.Item eventKey="ipsunified" active={dataFormat === 'ipsunified'}>
                            IPS Unified
                        </Dropdown.Item>
                        <Dropdown.Item eventKey="ips" active={dataFormat === 'ips'}>
                            IPS Prev JSON
                        </Dropdown.Item>
                        <Dropdown.Item eventKey="ipslegacy" active={dataFormat === 'ipslegacy'}>
                            IPS Legacy
                        </Dropdown.Item>
                    </DropdownButton>
                    <Form.Check
                        type="checkbox"
                        id="hl7-wrapper-checkbox"
                        label="Surround with HL7 Wrapper"
                        checked={hl7Wrapper}
                        onChange={(e) => setHl7Wrapper(e.target.checked)}
                        className="mt-2"
                    />
                </div>
                <div className="endpoint-container mt-2">
                    <Form.Group controlId="endpointInput">
                        <Form.Label>Endpoint</Form.Label>
                        <Form.Control
                            type="text"
                            value={endpoint}
                            onChange={(e) => setEndpoint(e.target.value)}
                        />
                    </Form.Group>
                </div>

                {showNotification ? (
                    <Alert variant="danger">Error pushing IPS data. Please try again.</Alert>
                ) : (
                    <div className="text-area">
                        <Form.Control as="textarea" rows={10} value={data} readOnly />
                    </div>
                )}
                <br />
                {message && <Alert variant="success">{message}</Alert>}
                <div className="button-container">
                    {selectedPatient && data && (
                        <Button className="mb-3" variant="danger" onClick={handlePushIPS}>
                            Push IPS JSON Data to {target} WebApp
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default UnifiedPostPage;
