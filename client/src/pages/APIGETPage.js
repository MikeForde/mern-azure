import React, { useState, useEffect, useContext} from 'react';
import axios from 'axios';
import { Button, Alert, Form, DropdownButton, Dropdown } from 'react-bootstrap';
import './Page.css';
import { PatientContext } from '../PatientContext';
import { useLoading } from '../contexts/LoadingContext';

function APIGETPage() {
  const { selectedPatients, selectedPatient, setSelectedPatient } = useContext(PatientContext);
  const { startLoading, stopLoading } = useLoading();
  const [data, setData] = useState('');
  const [mode, setMode] = useState('ips');
  const [modeText, setModeText] = useState('IPS JSON Bundle - /ips/:id or /ipsbyname/:name/:given');
  const [showNotification, setShowNotification] = useState(false);
  const [responseSize, setResponseSize] = useState(0);

  const handleRecordChange = (recordId) => {
    const record = selectedPatients.find(record => record._id === recordId);
    startLoading();
    setSelectedPatient(record);
  };

  useEffect(() => {
    if (selectedPatient) {
      const fetchData = async () => {
        let endpoint;
        if (mode === 'ipsbeerwithdelim') {
          endpoint = `/ipsbeer/${selectedPatient._id}/pipe`;
        } else {
          endpoint = `/${mode}/${selectedPatient._id}`;
        }

        console.log('Fetching data from:', endpoint);
        try {
          const response = await axios.get(endpoint);
          let responseData;
          if (mode === 'ipsbasic' || mode === 'ipsbeer' || mode === 'ipsbeerwithdelim' || mode === 'ipshl728') {
            responseData = response.data;
            setResponseSize(responseData.length);
          } else if (mode === 'ipsxml') {
            responseData = formatXML(response.data);
            setResponseSize(responseData.length);
          } else {
            setResponseSize(JSON.stringify(response.data).length);
            responseData = JSON.stringify(response.data, null, 2);
          }

          setData(responseData);
          console.log('Data:', responseData);
          setShowNotification(false);
        } catch (error) {
          console.error('Error fetching IPS record:', error);
        } finally {
          stopLoading();
        }
      };

      fetchData();
    }
  }, [selectedPatient, mode, stopLoading, startLoading]);

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
    startLoading();
    setMode(selectedMode);
    switch (selectedMode) {
      case 'ips':
        setModeText('IPS JSON Bundle - /ips/:id or /ipsbyname/:name/:given');
        break;
      case 'ipsxml':
        setModeText('IPS XML Bundle - /ipsxml/:id');
        break;
      case 'ipslegacy':
        setModeText('IPS Legacy JSON Bundle - /ipslegacy/:id');
        break;
      case 'ipsraw':
        setModeText('IPS MongoDB - /ipsmongo/:id');
        break;
      case 'ipsbasic':
        setModeText('IPS Minimal - /ipsbasic/:id');
        break;
      case 'ipsbeer':
        setModeText('IPS BEER - /ipsbeer/:id');
        break;
      case 'ipsbeerwithdelim':
        setModeText('IPS BEER - /ipsbeer/:id/pipe)');
        break;
      case 'ipshl728':
        setModeText('IPS HL7 2.8 - /ipshl728/:id');
        break;
     
        default:
          setModeText('IPS JSON Bundle - /ips/:id');
      }
    };
  
    const formatXML = (xml) => {
      const formatted = xml.replace(/></g, '>\n<');
      return formatted;
    };
  
    return (
      <div className="app">
        <div className="container">
          <h3>API GET - IPS Data: {responseSize}<div className="noteFont">- /:id can be the IPS id (the main UUID) or the internal MongoDB _id</div></h3>
          {selectedPatients.length > 0 && selectedPatient && (
            <>
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
              <div className="dropdown-container">
                <DropdownButton 
                  id="dropdown-mode" 
                  title={`API: ${modeText}`} 
                  onSelect={handleModeChange} 
                  className="dropdown-button"
                >
                  <Dropdown.Item eventKey="ips">IPS JSON Bundle - /ips/:id or /ipsbyname/:name/:given</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsxml">IPS XML Bundle - /ipsxml/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipslegacy">IPS Legacy JSON Bundle - /ipslegacy/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsmongo">IPS MongoDB - /ipsmongo/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsbasic">IPS Minimal - /ipsbasic/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsbeer">IPS BEER - /ipsbeer/:id</Dropdown.Item>
                  <Dropdown.Item eventKey="ipsbeerwithdelim">IPS BEER - /ipsbeer/:id/pipe</Dropdown.Item>
                  <Dropdown.Item eventKey="ipshl728">IPS HL7 2.8 - /ipshl728/:id</Dropdown.Item>
                </DropdownButton>
              </div>
            </>
          )}
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
              <Button 
                variant="primary" 
                className="mb-3" 
                onClick={() => window.open('https://ipsviewer.com', '_blank')}
              >
                Open IPS Viewer
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  export default APIGETPage;
  