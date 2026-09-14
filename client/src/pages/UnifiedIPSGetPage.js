import { useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Form,
  Button,
  DropdownButton,
  Dropdown
} from 'react-bootstrap';
import { useLoading } from '../contexts/LoadingContext';
import { PatientContext } from '../PatientContext';

const FHIR_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FHIR_SUMMARY_TARGETS = {
  HealthStaq: {
    label: 'HealthStaq',
    proxyBase: '/healthstaq',
    idLabel: 'HealthStaq Patient Resource UUID',
    idPlaceholder: '3b254934-46b1-43df-b326-3029af408e5e',
    endpointPlaceholder:
      '/healthstaq/Patient/<HealthStaq Patient UUID>/$summary',
    requireUuid: true,
  },

  MedOrange: {
    label: 'MedOrange',
    proxyBase: '/medorange',
    idLabel: 'MedOrange Patient Resource ID',
    idPlaceholder: 'pt1 or MedOrange Patient logical id',
    endpointPlaceholder:
      '/medorange/Patient/<MedOrange Patient ID>/$summary',
    requireUuid: false,
  },

  VigiaCC: {
    label: 'VigiaCC',
    proxyBase: '/ipsmernvigia',
    idLabel: 'VigiaCC ID_PATIENT_CLOUD UUID',
    idPlaceholder: '8bef7902-fbac-42da-94f5-0a8353d0fa7c',
    endpointPlaceholder:
      '/ipsmernvigia/fetchvigianps?return=vigia&retainOrganization=true → /patientNPS/<VigiaCC Patient UUID>',
    requireUuid: true,
    fetchMode: 'vigiaNps',
  },
};

const GENERIC_TARGETS = {
  'IPS SERN': {
    label: 'IPS SERN D2S',
    key: 'ips-sern',
  },

  'IPS MERN Azure': {
    label: 'IPS MERN Azure',
    key: 'ips-mern-azure',
  },

  VitalsIQ: {
    label: 'VitalsIQ',
    key: 'vitalsiq',
  },
};

const getExternalPatientResourceId = (record, target) => {
  if (!record) return '';

  if (target === 'VigiaCC') {
    return (
      record.patient?.vigiaId ||
      record.patient?.vigiaPatientId ||
      record.patient?.vigiaPatientUUID ||
      record.patient?.vigiaPatientUuid ||
      record.patient?.idPatientCloud ||
      record.patient?.ID_PATIENT_CLOUD ||
      record.vigiaPatientId ||
      record.vigiaPatientUUID ||
      record.vigiaPatientUuid ||
      record.idPatientCloud ||
      record.ID_PATIENT_CLOUD ||
      record.patient?.resourceId ||
      record.patient?.resourceID ||
      record.patient?.fhirId ||
      record.patient?.fhirID ||
      record.patientResourceId ||
      record.patientId ||
      record.fhirPatientId ||
      ''
    );
  }

  if (target === 'MedOrange') {
    return (
      record.patient?.medOrangeId ||
      record.patient?.medOrangePatientId ||
      record.patient?.medorangeId ||
      record.patient?.medorangePatientId ||
      record.medOrangePatientId ||
      record.medorangePatientId ||
      record.patient?.resourceId ||
      record.patient?.resourceID ||
      record.patient?.fhirId ||
      record.patient?.fhirID ||
      record.patientResourceId ||
      record.patientId ||
      record.fhirPatientId ||
      ''
    );
  }

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
  const [patientResourceId, setPatientResourceId] = useState('');

  const { startLoading, stopLoading } = useLoading();

  const {
    selectedPatients,
    selectedPatient,
    setSelectedPatient
  } = useContext(PatientContext);

  const isLocalhost = useMemo(() => {
    const host = window.location.hostname;

    return host === 'localhost' || host === '127.0.0.1';
  }, []);

  const [target, setTarget] = useState('VigiaCC');

  const summaryTargetConfig =
    FHIR_SUMMARY_TARGETS[target] || null;

  const genericTargetConfig =
    GENERIC_TARGETS[target] || null;

  const isFhirSummaryTarget =
    Boolean(summaryTargetConfig);

  const isVigiaTarget =
    summaryTargetConfig?.fetchMode === 'vigiaNps';

  const summaryEndpoint = summaryTargetConfig
    ? isVigiaTarget
      ? patientResourceId.trim()
        ? `/ipsmernvigia/fetchvigianps?return=vigia&retainOrganization=true → /patientNPS/${patientResourceId.trim()}`
        : summaryTargetConfig.endpointPlaceholder
      : patientResourceId.trim()
        ? `${summaryTargetConfig.proxyBase}/Patient/${patientResourceId.trim()}/$summary`
        : summaryTargetConfig.endpointPlaceholder
    : '';

  useEffect(() => {
    if (!selectedPatient) return;

    const resourceId =
      getExternalPatientResourceId(
        selectedPatient,
        target
      );

    if (resourceId) {
      setPatientResourceId(resourceId);
    }
  }, [selectedPatient, target]);

  const handleTargetChange = (selectedTarget) => {
    setTarget(selectedTarget);

    const resourceId =
      getExternalPatientResourceId(
        selectedPatient,
        selectedTarget
      );

    if (resourceId) {
      setPatientResourceId(resourceId);
    } else {
      setPatientResourceId('');
    }

    setIpsData(null);
    setError(null);
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    startLoading();

    try {
      /*
       * HealthStaq / MedOrange / VigiaCC
       */
      if (isFhirSummaryTarget) {
        const patientId =
          patientResourceId.trim();

        if (!patientId) {
          setError(
            `${summaryTargetConfig.label} fetch requires a Patient resource ID.`
          );

          setIpsData(null);
          return;
        }

        if (
          summaryTargetConfig.requireUuid &&
          !FHIR_UUID_REGEX.test(patientId)
        ) {
          setError(
            `${summaryTargetConfig.label} fetch requires a valid Patient resource UUID, not a packageUUID or MRN.`
          );

          setIpsData(null);
          return;
        }

        /*
         * VigiaCC
         */
        if (isVigiaTarget) {
          const requestPath =
            '/ipsmernvigia/fetchvigianps?return=vigia&retainOrganization=true';

          const vigiaPath =
            `/patientNPS/${encodeURIComponent(patientId)}`;

          const response =
            await axios.post(
              requestPath,
              {
                method: 'GET',
                path: vigiaPath,
              },
              {
                headers: {
                  Accept:
                    'application/fhir+json',
                  'Content-Type':
                    'application/json',
                },
              }
            );

          setIpsData(response.data);
          setError(null);
          return;
        }

        /*
         * HealthStaq / MedOrange
         */
        const requestPath =
          `${summaryTargetConfig.proxyBase}/Patient/` +
          `${encodeURIComponent(patientId)}/$summary`;

        const response =
          await axios.get(
            requestPath,
            {
              headers: {
                Accept:
                  'application/fhir+json',
              },
            }
          );

        setIpsData(response.data);
        setError(null);
        return;
      }

      /*
       * Generic name-based IPS targets:
       *
       * IPS SERN
       * IPS MERN Azure
       * VitalsIQ
       *
       * Only a target key is sent.
       * No destination URL is supplied by the browser.
       */
      if (!genericTargetConfig) {
        setError('Invalid target');
        setIpsData(null);
        return;
      }

      const response =
        await axios.get('/fetchips', {
          params: {
            target:
              genericTargetConfig.key,
            name,
            givenName,
          },
        });

      setIpsData(response.data);
      setError(null);

    } catch (err) {
      const data =
        err.response?.data;

      const msg =
        typeof data === 'string'
          ? data
          : data?.issue
            ? JSON.stringify(data, null, 2)
            : data?.error
              ? typeof data.error === 'string'
                ? data.error
                : JSON.stringify(
                    data.error,
                    null,
                    2
                  )
              : 'Failed to fetch IPS data';

      setError(msg);
      setIpsData(null);

    } finally {
      stopLoading();
    }
  };

  const handleTransform = async () => {
    try {
      await axios.post(
        '/ipsbundle',
        ipsData
      );

      setMessage(
        'IPS record successfully transformed and saved to MongoDB'
      );

      setError(null);

    } catch (err) {
      setMessage(err.message);

      setError(
        'Failed to transform IPS record'
      );
    }
  };

  return (
    <div className="app">
      <div className="container">

        <h3>
          External IPS API - GET (Pull)
        </h3>

        <Form onSubmit={handleSubmit}>

          {!isFhirSummaryTarget && (
            <>
              <Form.Group controlId="name">
                <Form.Control
                  type="text"
                  placeholder="Family/Surname"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  required
                />
              </Form.Group>

              <Form.Group controlId="givenName">
                <Form.Control
                  type="text"
                  placeholder="First/Given Name"
                  value={givenName}
                  onChange={(e) =>
                    setGivenName(e.target.value)
                  }
                  required
                />
              </Form.Group>
            </>
          )}

          {isFhirSummaryTarget && (
            <Form.Group
              controlId="patientResourceId"
              className="mb-2"
            >
              <Form.Label>
                {summaryTargetConfig.idLabel}
              </Form.Label>

              <Form.Control
                type="text"
                placeholder={
                  summaryTargetConfig.idPlaceholder
                }
                value={patientResourceId}
                onChange={(e) =>
                  setPatientResourceId(
                    e.target.value
                  )
                }
                required
                isInvalid={
                  summaryTargetConfig.requireUuid &&
                  patientResourceId.trim().length > 0 &&
                  !FHIR_UUID_REGEX.test(
                    patientResourceId.trim()
                  )
                }
              />

              <Form.Control.Feedback
                type="invalid"
              >
                Enter a valid{' '}
                {summaryTargetConfig.label}{' '}
                Patient UUID. This is not the
                IPS packageUUID.
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

              <Dropdown.Item
                eventKey="IPS SERN"
                active={
                  target === 'IPS SERN'
                }
              >
                IPS SERN D2S
              </Dropdown.Item>

              {isLocalhost && (
                <Dropdown.Item
                  eventKey="IPS MERN Azure"
                  active={
                    target ===
                    'IPS MERN Azure'
                  }
                >
                  IPS MERN Azure
                </Dropdown.Item>
              )}

              <Dropdown.Item
                eventKey="VitalsIQ"
                active={
                  target === 'VitalsIQ'
                }
              >
                VitalsIQ
              </Dropdown.Item>

              <Dropdown.Item
                eventKey="HealthStaq"
                active={
                  target === 'HealthStaq'
                }
              >
                HealthStaq
              </Dropdown.Item>

              <Dropdown.Item
                eventKey="MedOrange"
                active={
                  target === 'MedOrange'
                }
              >
                MedOrange
              </Dropdown.Item>

              <Dropdown.Item
                eventKey="VigiaCC"
                active={
                  target === 'VigiaCC'
                }
              >
                VigiaCC
              </Dropdown.Item>

            </DropdownButton>

          </div>

          {selectedPatients?.length > 0 &&
            selectedPatient && (
              <div className="dropdown-container mb-2">

                <DropdownButton
                  id="dropdown-record-get"
                  title={
                    `Patient: ` +
                    `${selectedPatient.patient?.given || ''} ` +
                    `${selectedPatient.patient?.name || ''}`
                  }
                  onSelect={(recordId) => {

                    const record =
                      selectedPatients.find(
                        (record) =>
                          record._id ===
                          recordId
                      );

                    if (record) {
                      setSelectedPatient(
                        record
                      );
                    }
                  }}
                  className="dropdown-button"
                >

                  {selectedPatients.map(
                    (record) => (
                      <Dropdown.Item
                        key={record._id}
                        eventKey={
                          record._id
                        }
                        active={
                          selectedPatient &&
                          selectedPatient._id ===
                            record._id
                        }
                      >
                        {
                          record.patient
                            ?.given
                        }{' '}
                        {
                          record.patient
                            ?.name
                        }
                      </Dropdown.Item>
                    )
                  )}

                </DropdownButton>

              </div>
            )}

          {isFhirSummaryTarget && (
            <Form.Group
              controlId="endpointInput"
              className="mb-2"
            >
              <Form.Label>
                Endpoint
              </Form.Label>

              <Form.Control
                type="text"
                value={summaryEndpoint}
                disabled
              />
            </Form.Group>
          )}

          <Button
            variant="primary"
            type="submit"
          >
            Submit GET Request
          </Button>

        </Form>

        {error && (
          <p style={{ color: 'red' }}>
            {error}
          </p>
        )}

        {ipsData && (
          <div>

            <h4>IPS Data</h4>

            <div className="text-area">
              <Form.Control
                as="textarea"
                rows={10}
                value={JSON.stringify(
                  ipsData,
                  null,
                  2
                )}
                readOnly
              />
            </div>

            <Button
              variant="success"
              onClick={handleTransform}
            >
              Transform to IPS MERN Record
            </Button>

          </div>
        )}

        {message && (
          <p style={{ color: 'green' }}>
            {message}
          </p>
        )}

      </div>
    </div>
  );
};

export default UnifiedIPSGetPage;