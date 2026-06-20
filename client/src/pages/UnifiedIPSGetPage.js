import { useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Form, Button, DropdownButton, Dropdown } from 'react-bootstrap';
import { useLoading } from '../contexts/LoadingContext';
import { PatientContext } from '../PatientContext';

const FHIR_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getHealthStaqPatientResourceId = (record) => {
  if (!record) return '';

  return (
    record.patient?.resourceId ||
    record.patient?.resourceID ||
    record.patient?.fhirId ||
    record.patient?.fhirID ||
    record.patient?.healthStaqId ||
    record.patient?.healthStaqPatientId ||
    record.patientResourceId ||
    record.patientId ||
    record.fhirPatientId ||
    record.healthStaqPatientId ||
    ''
  );
};

const UnifiedIPSGetPage = () => {
  const [name, setName] = useState('');
  const [givenName, setGivenName] = useState('');
  const [ipsData, setIpsData] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const { startLoading, stopLoading } = useLoading();
  const [patientResourceId, setPatientResourceId] = useState('');
  const { selectedPatients, selectedPatient, setSelectedPatient } = useContext(PatientContext);

  const isLocalhost = useMemo(() => {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }, []);

  const endpointMap = useMemo(() => {
    const baseMap = {
      'IPS SERN': 'https://ips-d2s-uksc-medsnomed-medsno.apps.ocp1.azure.dso.digital.mod.uk/ipsbyname',
      VitalsIQ: 'https://4202xiwc.offroadapps.dev:62444/Fhir/ips/json',
      HealthStaq: '/healthstaq/Patient/<HealthStaq Patient UUID>/$summary',
    };

    if (isLocalhost) {
      baseMap['IPS MERN Azure'] = 'https://ipsmern-dep.azurewebsites.net/ipsbyname';
    }

    return baseMap;
  }, [isLocalhost]);

  const [target, setTarget] = useState('HealthStaq');
  const [endpoint, setEndpoint] = useState(endpointMap['HealthStaq']);

  const isHealthStaq = target === 'HealthStaq';

  const healthStaqEndpoint = patientResourceId.trim()
    ? `/healthstaq/Patient/${patientResourceId.trim()}/$summary`
    : '/healthstaq/Patient/<HealthStaq Patient UUID>/$summary';


  useEffect(() => {
    if (!selectedPatient) return;

    const resourceId = getHealthStaqPatientResourceId(selectedPatient);

    if (resourceId) {
      setPatientResourceId(resourceId);
    }
  }, [selectedPatient]);

  const handleTargetChange = (selectedTarget) => {
    setTarget(selectedTarget);
    setEndpoint(endpointMap[selectedTarget] || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    startLoading();

    try {
      if (isHealthStaq) {
        const patientId = patientResourceId.trim();

        if (!FHIR_UUID_REGEX.test(patientId)) {
          setError(
            'HealthStaq fetch requires a valid HealthStaq Patient resource UUID, not a packageUUID or MRN.'
          );
          setIpsData(null);
          return;
        }

        const response = await axios.get(
          `/healthstaq/Patient/${encodeURIComponent(patientId)}/$summary`,
          {
            headers: {
              Accept: 'application/fhir+json',
            },
          }
        );

        setEndpoint(`/healthstaq/Patient/${patientId}/$summary`);
        setIpsData(response.data);
        setError(null);
        return;
      }

      const response = await axios.get('/fetchips', {
        params: { endpoint, name, givenName },
      });

      setIpsData(response.data);
      setError(null);
    } catch (err) {
      const data = err.response?.data;

      const msg =
        typeof data === 'string'
          ? data
          : data?.issue
            ? JSON.stringify(data, null, 2)
            : data?.error
              ? data.error
              : 'Failed to fetch IPS data';

      setError(msg);
      setIpsData(null);
    } finally {
      stopLoading();
    }
  };

  const handleTransform = async () => {
    try {
      await axios.post('/ipsbundle', ipsData);
      setMessage('IPS record successfully transformed and saved to MongoDB');
      setError(null);
    } catch (err) {
      setMessage(err.message);
      setError('Failed to transform IPS record');
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h3>External IPS API - GET (Pull)</h3>
        <Form onSubmit={handleSubmit}>
          {!isHealthStaq && (
            <>
              <Form.Group controlId="name">
                <Form.Control
                  type="text"
                  placeholder="Family/Surname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Form.Group>

              <Form.Group controlId="givenName">
                <Form.Control
                  type="text"
                  placeholder="First/Given Name"
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  required
                />
              </Form.Group>
            </>
          )}

          {isHealthStaq && (
            <Form.Group controlId="patientResourceId" className="mb-2">
              <Form.Label>HealthStaq Patient Resource UUID</Form.Label>
              <Form.Control
                type="text"
                placeholder="3b254934-46b1-43df-b326-3029af408e5e"
                value={patientResourceId}
                onChange={(e) => setPatientResourceId(e.target.value)}
                required
                isInvalid={
                  patientResourceId.trim().length > 0 &&
                  !FHIR_UUID_REGEX.test(patientResourceId.trim())
                }
              />
              <Form.Control.Feedback type="invalid">
                Enter a valid HealthStaq Patient UUID. This is not the IPS packageUUID.
              </Form.Control.Feedback>
            </Form.Group>
          )}

          <div className="dropdown-container mb-2">
            <DropdownButton
              id="dropdown-target-get"
              title={`Target Endpoint: ${target}`}
              onSelect={handleTargetChange}
              className="dropdown-button"
            >
              <Dropdown.Item eventKey="IPS SERN" active={target === 'IPS SERN'}>
                IPS SERN D2S
              </Dropdown.Item>

              {isLocalhost && (
                <Dropdown.Item eventKey="IPS MERN Azure" active={target === 'IPS MERN Azure'}>
                  IPS MERN Azure
                </Dropdown.Item>
              )}

              <Dropdown.Item eventKey="VitalsIQ" active={target === 'VitalsIQ'}>
                VitalsIQ
              </Dropdown.Item>

              <Dropdown.Item eventKey="HealthStaq" active={target === 'HealthStaq'}>
                HealthStaq
              </Dropdown.Item>
            </DropdownButton>
          </div>

          {selectedPatients?.length > 0 && selectedPatient && (
            <div className="dropdown-container mb-2">
              <DropdownButton
                id="dropdown-record-get"
                title={`Patient: ${selectedPatient.patient?.given || ''} ${selectedPatient.patient?.name || ''}`}
                onSelect={(recordId) => {
                  const record = selectedPatients.find(
                    (record) => record._id === recordId
                  );

                  if (record) {
                    setSelectedPatient(record);
                  }
                }}
                className="dropdown-button"
              >
                {selectedPatients.map((record) => (
                  <Dropdown.Item
                    key={record._id}
                    eventKey={record._id}
                    active={selectedPatient && selectedPatient._id === record._id}
                  >
                    {record.patient?.given} {record.patient?.name}
                  </Dropdown.Item>
                ))}
              </DropdownButton>
            </div>
          )}

          <Form.Group controlId="endpointInput" className="mb-2">
            <Form.Label>Endpoint</Form.Label>
            <Form.Control
              type="text"
              value={isHealthStaq ? healthStaqEndpoint : endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              disabled={isHealthStaq}
            />
          </Form.Group>

          <Button variant="primary" type="submit">
            Submit GET Request
          </Button>
        </Form>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        {ipsData && (
          <div>
            <h4>IPS Data</h4>
            <div className="text-area">
              <Form.Control
                as="textarea"
                rows={10}
                value={JSON.stringify(ipsData, null, 2)}
                readOnly
              />
            </div>
            <Button variant="success" onClick={handleTransform}>
              Transform to IPS MERN Record
            </Button>
          </div>
        )}

        {message && <p style={{ color: 'green' }}>{message}</p>}
      </div>
    </div>
  );
};

export default UnifiedIPSGetPage;