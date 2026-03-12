import { useState, useEffect } from 'react';
import { Container, Spinner, Tab, Nav, Button, ButtonGroup } from 'react-bootstrap';
import ReactJson from 'react-json-view';

export default function IPSchemaViewerNhsScr() {
  const [schemas, setSchemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeKey, setActiveKey] = useState('Bundle');
  const [expandAll, setExpandAll] = useState({});
  const [showExample, setShowExample] = useState({});
  const [showRawExample, setShowRawExample] = useState({});

  // ---------------- Examples (NHS SCR flavour) ----------------

  // Minimal NHS-number verification extension (matches your Patient example pattern)
  const nhsNumberVerificationExt = {
    url: "https://fhir.hl7.org.uk/StructureDefinition/Extension-UKCore-NHSNumberVerificationStatus",
    valueCodeableConcept: {
      coding: [
        {
          system: "https://fhir.hl7.org.uk/CodeSystem/UKCore-NHSNumberVerificationStatusEngland",
          code: "01",
          display: "Number present and verified"
        }
      ]
    }
  };

  const exampleData = {
    Patient: {
      resourceType: "Patient",
      id: "ec92aa05-0d44-41e5-ab5d-c3ea153244bb",
      meta: {
        profile: [
          "https://fhir.hl7.org.uk/StructureDefinition/UKCore-Patient",
          "http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips"
        ]
      },
      identifier: [
        {
          extension: [nhsNumberVerificationExt],
          system: "https://fhir.nhs.uk/Id/nhs-number",
          value: "1234567890"
        }
      ],
      name: [
        {
          family: "HoForde",
          given: ["Huiberts"],
          prefix: ["Mr"]
        }
      ],
      gender: "male",
      birthDate: "1986-05-12",
      address: [
        {
          line: ["1 High Street"],
          city: "Poole",
          district: "Dorset",
          postalCode: "BH15 1AA",
          country: "UK"
        }
      ]
    },

    Organization: {
      resourceType: "Organization",
      id: "456748ce-70c1-48a9-806b-693e36ea15aa",
      name: "ACME Hospital"
    },

    Practitioner: {
      resourceType: "Practitioner",
      id: "3228a069-a601-4e50-88b9-910226e3f094",
      name: [{ text: "Unknown" }]
    },

    AllergyIntolerance: {
      resourceType: "AllergyIntolerance",
      id: "9eacc5fb-be78-46a0-81c6-938624792868",
      identifier: [
        {
          system: "http://test-nhs-scr-ips.com/allergy",
          value: "71059e0b-f5bf-4edc-8426-be5c813d3b90"
        }
      ],
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
            code: "active",
            display: "Active"
          }
        ]
      },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
            code: "confirmed",
            display: "Confirmed"
          }
        ]
      },
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "219084006",
            display: "Adverse reaction to tetanus vaccine"
          }
        ],
        text: "Adverse reaction to tetanus vaccine"
      },
      patient: { reference: "urn:uuid:6e070a5b-4cfc-490e-a10a-6c2ca9c52c73" },
      onsetDateTime: "2025-06-22T15:10:58.008Z"
    },

    Condition: {
      resourceType: "Condition",
      id: "96d1bbc6-7af3-4329-a672-98a884268495",
      identifier: [
        {
          system: "http://test-nhs-scr-ips.com/condition",
          value: "d72d7f08-e856-412e-a7ba-894a1ede5d82"
        }
      ],
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
            display: "Active"
          }
        ]
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "problem-list-item",
              display: "Problem List Item"
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "125116007",
            display: "Chronic erythema"
          }
        ],
        text: "Chronic erythema"
      },
      subject: { reference: "urn:uuid:6e070a5b-4cfc-490e-a10a-6c2ca9c52c73" },
      onsetDateTime: "2025-07-22T15:10:58.002Z"
    },

    Observation: {
      resourceType: "Observation",
      id: "1ddccb67-0963-4ab1-87e4-740b3e6978c2",
      status: "final",
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "75367002",
            display: "Blood Pressure"
          }
        ]
      },
      subject: { reference: "urn:uuid:ec92aa05-0d44-41e5-ab5d-c3ea153244bb" },
      effectiveDateTime: "2025-06-15T22:15:00.000Z",
      component: [
        {
          code: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "271649006",
                display: "Systolic blood pressure"
              }
            ]
          },
          valueQuantity: {
            value: 120,
            unit: "mm[Hg]",
            system: "http://unitsofmeasure.org",
            code: "mm[Hg]"
          }
        },
        {
          code: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "271650006",
                display: "Diastolic blood pressure"
              }
            ]
          },
          valueQuantity: {
            value: 80,
            unit: "mm[Hg]",
            system: "http://unitsofmeasure.org",
            code: "mm[Hg]"
          }
        }
      ]
    },

        DiagnosticReport: {
      resourceType: "DiagnosticReport",
      id: "13fdd8df-365d-4b56-9a2b-735adf35f042",
      contained: [
        {
          resourceType: "Specimen",
          id: "specimen",
          identifier: [
            {
              system: "http://api.graphnethealth.com/ID/Pathology-T-123",
              value: "P,24.3253590.H"
            }
          ],
          type: {
            coding: [
              {
                system: "https://fhir.graphnethealth.com/CodeSystem-LocalSpecimenCodes-1233",
                code: "S",
                display: "Serum"
              }
            ],
            text: "Serum"
          },
          receivedTime: "2025-08-13T08:29:05.6321392+01:00",
          collection: {
            collectedDateTime: "2025-08-11T08:29:05.6319131+01:00"
          }
        },
        {
          resourceType: "Practitioner",
          id: "resultsInterpreter",
          name: [
            {
              text: "JENNIFER ATHERTON"
            }
          ]
        }
      ],
      identifier: [
        {
          system: "http://api.graphnethealth.com/ID/Pathology-T-123",
          value: "P,24.3253590.H-CHM_SET_ISTUD2"
        }
      ],
      status: "final",
      category: [
        {
          coding: [
            {
              system: "https://fhir.graphnethealth.com/CodeSystem-DiagnosticReportCategory",
              code: "PATH",
              display: "Pathology"
            }
          ],
          text: "Pathology"
        }
      ],
      code: {
        coding: [
          {
            system: "https://fhir.graphnethealth.com/CodeSystem-LocalResultCodes-1233",
            code: "CHM_SET_ISTUD2",
            display: "IRON STUDIES"
          }
        ],
        text: "IRON STUDIES"
      },
      subject: {
        reference: "urn:uuid:02a03c25-a736-477f-8bb0-323e30688db7"
      },
      effectiveDateTime: "2025-08-21T08:29:05.6278124+01:00",
      resultsInterpreter: [
        {
          reference: "#resultsInterpreter"
        }
      ],
      specimen: [
        {
          reference: "#specimen"
        }
      ],
      result: [
        {
          reference: "urn:uuid:a8f0daeb-6802-4062-8d01-4fac5e23c808"
        }
      ]
    },

    Immunization: {
      resourceType: "Immunization",
      id: "bd47fbca-b3d2-4569-b3e3-02411aeb44ec",
      contained: [
        {
          resourceType: "Organization",
          id: "manufacturer",
          name: "Pfizer-BioNTech"
        }
      ],
      extension: [
        {
          url: "https://fhir.hl7.org.uk/StructureDefinition/Extension-UKCore-VaccinationProcedure",
          valueCodeableConcept: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "39115611000001103",
                display:
                  "Administration of first dose of COVID-19 mRNA Vaccine BNT162b2 30micrograms/0.3ml dose concentrate for suspension for injection multidose vials (Pfizer-BioNTech)"
              }
            ],
            text:
              "Administration of first dose of COVID-19 mRNA Vaccine BNT162b2 30micrograms/0.3ml dose concentrate for suspension for injection multidose vials (Pfizer-BioNTech)"
          }
        }
      ],
      identifier: [
        {
          system: "http://test-nhs-scr-ips.com/immunisation",
          value: "dcf651b9-8763-424a-bea0-b4c29416049b"
        }
      ],
      status: "completed",
      vaccineCode: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "39115611000001103",
            display:
              "COVID-19 mRNA Vaccine BNT162b2 30micrograms/0.3ml dose concentrate for suspension for injection multidose vials (Pfizer-BioNTech)"
          }
        ]
      },
      patient: { reference: "Patient/6e070a5b-4cfc-490e-a10a-6c2ca9c52c73" },
      occurrenceDateTime: "2025-06-02T15:10:58.036Z",
      manufacturer: { reference: "#manufacturer" }
    },

    MedicationStatement: {
      resourceType: "MedicationStatement",
      id: "a4766e27-f8dd-4045-8264-45e94ad763ee",
      contained: [
        {
          resourceType: "Medication",
          id: "med",
          code: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "370407003",
                display: "Amoxicillin 250mg chewable tablet"
              }
            ],
            text: "Amoxicillin 250mg chewable tablet"
          }
        },
        {
          resourceType: "Organization",
          id: "source",
          name: "Unknown"
        }
      ],
      identifier: [
        {
          system: "http://test-nhs-scr-ips.com/medicationstatement",
          value: "b17a4f18-687d-4c15-892f-8d37f92b840b"
        }
      ],
      status: "active",
      category: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/medication-statement-category",
            code: "outpatient",
            display: "Outpatient"
          }
        ],
        text: "Outpatient"
      },
      medicationReference: { reference: "#med" },
      subject: { reference: "urn:uuid:6e070a5b-4cfc-490e-a10a-6c2ca9c52c73" },
      effectiveDateTime: "2025-01-03T16:10:58.026Z",
      dateAsserted: "2026-02-26T08:18:22.380Z",
      informationSource: { reference: "#source" },
      dosage: [
        {
          text: "Take twice a day",
          doseAndRate: [
            {
              doseQuantity: {
                value: 250,
                unit: "milligram",
                system: "http://unitsofmeasure.org",
                code: "mg"
              }
            }
          ]
        }
      ]
    },

    Procedure: {
      resourceType: "Procedure",
      id: "0fdb9367-03fc-44d7-abee-e9b47cc1a02a",
      contained: [
        {
          resourceType: "Practitioner",
          id: "prac1",
          name: [{ text: "Dr Mike Forde" }]
        },
        {
          resourceType: "Organization",
          id: "org1",
          name: "ACME Hospital"
        }
      ],
      identifier: [
        {
          system: "http://test-nhs-scr-ips.com/procedure",
          value: "da7b221e-15a9-49e2-b9ab-1099c6b0e821"
        }
      ],
      status: "completed",
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "49006001",
            display: "Removal of foreign body from bladder by incision"
          }
        ],
        text: "Removal of foreign body from bladder by incision"
      },
      subject: { reference: "Patient/a624c0b2-ad13-444d-8b04-47962ca9fac8" },
      performedDateTime: "2025-06-07T15:10:58.064Z",
      performer: [
        {
          actor: { reference: "#prac1" },
          onBehalfOf: { reference: "#org1" }
        }
      ]
    },

        Device: {
      resourceType: "Device",
      id: "720c69ac-f629-4ad6-a4b4-74566e1dc5cc",
      identifier: [
        {
          system: "http://test-nhs-scr-ips.com",
          value: "8c60ff23-af96-4467-94ba-1387192bbc58"
        }
      ],
      manufacturer: "Acme Inc",
      deviceName: [
        {
          name: "Acme Inc. Shared Care Record",
          type: "user-friendly-name"
        }
      ]
    },

    Extension: [
      {
        url: "https://fhir.hl7.org.uk/StructureDefinition/Extension-UKCore-VaccinationProcedure",
        valueCodeableConcept: {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "39115611000001103",
              display:
                "Administration of first dose of COVID-19 mRNA Vaccine BNT162b2 30micrograms/0.3ml dose concentrate for suspension for injection multidose vials (Pfizer-BioNTech)"
            }
          ]
        }
      }
    ]
  };

  // Composition example (with required sections even if empty)
  exampleData.Composition = {
    resourceType: "Composition",
    id: "31d7554c-3757-4661-83b6-24dd2fd8cd04",
    identifier: {
      system: "http://test-nhs-scr-ips.com",
      value: "a8c03d4f-700d-4fdb-9011-73929cd56e56"
    },
    status: "final",
    type: {
      coding: [
        {
          system: "http://loinc.org",
          code: "60591-5",
          display: "Patient summary Document"
        }
      ]
    },
    subject: { reference: "urn:uuid:a624c0b2-ad13-444d-8b04-47962ca9fac8" },
    date: "2026-02-26T08:42:16.564Z",
    author: [{ reference: "urn:uuid:9dc87de4-bcb3-413d-998b-68e6032100b8" }],
    title: "Shared Care Record Patient Summary as at 2026-02-26T08:42:16.564Z",
    event: [
      {
        code: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v3-ActClass",
                code: "PCPR",
                display: "care provision"
              }
            ],
            text: "care provision"
          }
        ],
        period: { end: "2026-02-26T08:42:16.564Z" }
      }
    ],
    custodian: { reference: "urn:uuid:456748ce-70c1-48a9-806b-693e36ea15aa" },
    section: [
      {
        title: "Medication Summary",
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "10160-0",
              display: "History of Medication use Narrative"
            }
          ]
        },
        text: {
          status: "generated",
          div: "<div xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"en-GB\" xml:lang=\"en-GB\">There is no information available about the subject&#39;s medication use or administration.</div>"
        },
        emptyReason: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/list-empty-reason",
              code: "nilknown",
              display: "Nil known"
            }
          ],
          text: "No known medications"
        }
      },
      {
        title: "Allergies and Intolerances",
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "48765-2",
              display: "Allergies and adverse reactions Document"
            }
          ]
        },
        text: {
          status: "generated",
          div: "<div xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"en-GB\" xml:lang=\"en-GB\">There is no information available regarding the subject&#39;s allergy conditions.</div>"
        },
        emptyReason: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/list-empty-reason",
              code: "nilknown",
              display: "Nil known"
            }
          ],
          text: "No known allergies"
        }
      },
      {
        title: "Problems",
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "11450-4",
              display: "Problem List - Reported"
            }
          ]
        },
        text: {
          status: "generated",
          div: "<div xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"en-GB\" xml:lang=\"en-GB\">There is no information available about the subject&#39;s health problems or disabilities.</div>"
        },
        emptyReason: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/list-empty-reason",
              code: "nilknown",
              display: "Nil known"
            }
          ],
          text: "No known conditions"
        }
      }
    ]
  };

  // Bundle example (SCR document bundle)
  exampleData.Bundle = {
    resourceType: "Bundle",
    id: "30e18914-4c32-48af-8bef-bdaf9de43539",
    identifier: {
      system: "http://test-nhs-scr-ips.com",
      value: "604d90a6-4683-4d0f-ac38-bafda31b56d8"
    },
    type: "document",
    timestamp: "2024-06-03T07:09:41.000Z",
    entry: [
      { fullUrl: "urn:uuid:ebe8e31f-78ea-4fca-a6a0-9265b08403d8", resource: exampleData.Composition },
      { fullUrl: "urn:uuid:ec92aa05-0d44-41e5-ab5d-c3ea153244bb", resource: exampleData.Patient }
    ]
  };

  // ---------------- Schema loading ----------------
  useEffect(() => {
    async function loadSchemas() {
      try {
        const schemaFiles = [
          'Bundle.schema.json',
          'Composition.schema.json',
          'Patient.schema.json',
          'Organization.schema.json',
          'Practitioner.schema.json',
          'MedicationStatement.schema.json',
          'AllergyIntolerance.schema.json',
          'Condition.schema.json',
          'Observation.schema.json',
          'DiagnosticReport.schema.json',
          'Immunization.schema.json',
          'Procedure.schema.json',
          'Device.schema.json',
          'Extension.schema.json'
        ];

        const fetched = await Promise.all(
          schemaFiles.map(async file => {
            const res = await fetch(`/ipsNhsScrDef/${file}`);
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
    window.open(`${window.location.origin}/ipsNhsScrDef/${id}.schema.json`, '_blank');
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
      <h3>UK NHS SCR (Shared Care) JSON Schemas</h3>
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
                    background: '#f8f9fa',
                    padding: '1rem',
                    borderRadius: '4px',
                    maxHeight: '600px',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {JSON.stringify(exampleData[id], null, 2)}
                  </pre>
                ) : (
                  <ReactJson
                    src={isExample ? (exampleData[id] || { note: `No example provided for ${id}` }) : schema}
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