import React, { useState, useEffect } from 'react';
import { Container, Spinner, Tab, Nav, Button, ButtonGroup } from 'react-bootstrap';
import ReactJson from 'react-json-view';

export default function IPSchemaViewer() {
  const [schemas, setSchemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeKey, setActiveKey] = useState('Bundle');
  const [expandAll, setExpandAll] = useState({});
  const [showExample, setShowExample] = useState({});
  const [showRawExample, setShowRawExample] = useState({});

  // Example data for each resource
  const exampleData = {
    Patient: {
      resourceType: 'Patient',
      id: 'pt1',
      identifier: [
        { system: 'NATO_Id', value: 'ABC123' },
        { system: 'National_Id', value: 'XYZ789' }
      ],
      name: [{ family: 'Doe', given: ['John'] }],
      gender: 'male',
      birthDate: '1980-01-01',
      address: [{ country: 'Wonderland' }]
    },
    Organization: {
      resourceType: 'Organization',
      id: 'org1',
      name: 'Example Org'
    },
    Medication: {
      resourceType: 'Medication',
      id: 'med1',
      code: {
        coding: [
          { system: 'http://example.org', code: 'asp', display: 'Aspirin' }
        ]
      }
    },
    MedicationRequest: {
      resourceType: 'MedicationRequest',
      id: 'medreq1',
      status: 'active',
      medicationReference: { reference: 'Medication/med1', display: 'Aspirin' },
      subject: { reference: 'Patient/pt1' },
      authoredOn: '2025-05-15T08:30:00Z',
      dosageInstruction: [{ text: '1 tablet daily' }]
    },
    AllergyIntolerance: {
      resourceType: 'AllergyIntolerance',
      id: 'allergy1',
      category: ['medication'],
      criticality: 'high',
      code: { coding: [ { system: 'http://snomed.info/sct', code: '12345', display: 'Peanut allergy' } ] },
      patient: { reference: 'Patient/pt1' },
      onsetDateTime: '2025-01-01T00:00:00Z'
    },
    Condition: {
      resourceType: 'Condition',
      id: 'condition1',
      code: { coding: [ { system: 'http://snomed.info/sct', code: '67890', display: 'Hypertension' } ] },
      subject: { reference: 'Patient/pt1' },
      onsetDateTime: '2020-06-01T00:00:00Z'
    },
    Observation: {
      resourceType: 'Observation',
      id: 'ob1',
      status: 'final',
      code: {
        coding: [
          { system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure' }
        ]
      },
      subject: { reference: 'Patient/pt1' },
      effectiveDateTime: '2025-05-16T09:00:00Z',
      component: [
        { code: { coding: [ { system: 'http://snomed.info/sct', code: '271649006', display: 'Systolic blood pressure' } ] }, valueQuantity: { value: 120, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' } },
        { code: { coding: [ { system: 'http://snomed.info/sct', code: '271650006', display: 'Diastolic blood pressure' } ] }, valueQuantity: { value: 80, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' } }
      ]
    }
  };

  // Construct full Bundle example
  exampleData.Bundle = {
    resourceType: 'Bundle',
    id: 'example-bundle',
    timestamp: '2025-05-16T10:00:00Z',
    type: 'collection',
    total: Object.keys(exampleData).length - 1,
    entry: Object.values(exampleData)
      .filter(res => res.resourceType !== 'Bundle')
      .map(res => ({ resource: res }))
  };

  useEffect(() => {
    async function loadSchemas() {
      try {
        const schemaFiles = [
          'Bundle.schema.json',
          'Patient.schema.json',
          'Organization.schema.json',
          'MedicationRequest.schema.json',
          'Medication.schema.json',
          'AllergyIntolerance.schema.json',
          'Condition.schema.json',
          'Observation.schema.json'
        ];

        const fetched = await Promise.all(
          schemaFiles.map(async file => {
            const res = await fetch(`/ipsdef/${file}`);
            if (!res.ok) throw new Error(`Failed to load ${file}: ${res.statusText}`);
            const json = await res.json();
            return { id: file.replace('.schema.json', ''), schema: json };
          })
        );
        setSchemas(fetched);
        setActiveKey(fetched[0].id);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadSchemas();
  }, []);

  const toggleView = id => {
    setExpandAll(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openPlainText = id => {
    window.open(`${window.location.origin}/ipsdef/${id}.schema.json`, '_blank');
  };

  const toggleExample = id => {
    setShowExample(prev => ({ ...prev, [id]: !prev[id] }));
    setShowRawExample(prev => ({ ...prev, [id]: false }));
  };

  const toggleRawExample = id => {
    setShowRawExample(prev => ({ ...prev, [id]: !prev[id] }));
    setShowExample(prev => ({ ...prev, [id]: false }));
  };

  if (loading) return (
    <Container className="mt-5 text-center">
      <Spinner animation="border" />
    </Container>
  );

  if (error) return (
    <Container className="mt-5">
      <p className="text-danger">Error: {error}</p>
    </Container>
  );

  return (
    <Container className="mt-5">
      <h3>IPS Unified JSON Schemas</h3>
      <p>Toggle between default view, expanded view, raw schema, or example formats.</p>

      <Tab.Container activeKey={activeKey} onSelect={setActiveKey}>
        <Nav variant="tabs">
          {schemas.map(({ id }) => (
            <Nav.Item key={id}>
              <Nav.Link eventKey={id}>{id}</Nav.Link>
            </Nav.Item>
          ))}
        </Nav>

        <Tab.Content style={{ marginTop: '1rem' }}>
          {schemas.map(({ id, schema }) => {
            const isExpanded = expandAll[id] || false;
            const isExample = showExample[id] || false;
            const isRaw = showRawExample[id] || false;
            return (
              <Tab.Pane key={id} eventKey={id} style={{ overflow: 'auto' }}>
                <ButtonGroup size="sm" className="mb-2">
                  <Button variant="outline-primary" onClick={() => toggleView(id)}>
                    {isExpanded ? 'Default View' : 'Expand All'}
                  </Button>
                  <Button variant="outline-secondary" onClick={() => openPlainText(id)}>
                    View Raw Schema
                  </Button>
                  <Button variant="outline-info" onClick={() => toggleExample(id)}>
                    {isExample ? 'Hide Example' : 'Show Example'}
                  </Button>
                  <Button variant="outline-warning" onClick={() => toggleRawExample(id)}>
                    {isRaw ? 'Hide Raw Example' : 'View Raw Example'}
                  </Button>
                </ButtonGroup>

                {isRaw ? (
                  <pre style={{
                    background: '#f8f9fa', padding: '1rem', borderRadius: '4px',
                    maxHeight: '600px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                  }}>
                    {JSON.stringify(exampleData[id], null, 2)}
                  </pre>
                ) : (
                  <ReactJson
                    src={isExample ? exampleData[id] : schema}
                    name={false}
                    collapsed={isExpanded ? false : 2}
                    enableClipboard={false}
                    displayDataTypes={false}
                    onAdd={false}
                    onEdit={false}
                    onDelete={false}
                    style={{ fontSize: '0.85rem' }}
                  />
                )}
              </Tab.Pane>
            );
          })}
        </Tab.Content>
      </Tab.Container>
    </Container>
  );
}
