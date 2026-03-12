import { useState, useEffect } from 'react';
import { Container, Spinner, Tab, Nav, Button, ButtonGroup } from 'react-bootstrap';
import ReactJson from 'react-json-view';

export default function IPSSchemaViewerEps() {
  const [schemas, setSchemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeKey, setActiveKey] = useState('Bundle');
  const [expandAll, setExpandAll] = useState({});
  const [showExample, setShowExample] = useState({});
  const [showRawExample, setShowRawExample] = useState({});

  // ---------------- Examples (EPS flavour) ----------------

  const exampleData = {
    Patient: {
      resourceType: 'Patient',
      id: 'f51071b2-6c06-4d31-85ed-26a6b964ef98',
      meta: {
        profile: [
          'http://hl7.eu/fhir/eps/StructureDefinition/patient-eu-eps'
        ]
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><table class="hl7__ips"><tr><td>Petra Schwartz</td><td>1950-04-19</td></tr></table></div>'
      },
      identifier: [
        {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'JHN'
              }
            ]
          },
          system: 'http://example.org/identifier-1',
          value: '5042-537688-1'
        },
        {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'MR'
              }
            ]
          },
          system: 'http://example.org/identifier-2',
          value: 'a707536c-14f2-3606-4ed4-7fd9991fd18e'
        }
      ],
      name: [
        {
          text: 'Petra Schwartz',
          family: 'Schwartz',
          given: ['Petra']
        }
      ],
      telecom: [
        {
          system: 'phone',
          value: '+49 034223 68 59'
        }
      ],
      gender: 'female',
      birthDate: '1950-04-19',
      address: [
        {
          use: 'home',
          type: 'physical',
          line: ['Hoheluftchaussee 46'],
          city: 'Dommitzsch',
          postalCode: '04878',
          country: 'Germany'
        }
      ]
    },

    Organization: {
      resourceType: 'Organization',
      id: 'ee1c1f62-cb27-4dc4-8d07-f9c58215f309',
      meta: {
        profile: [
          'http://hl7.eu/fhir/base/StructureDefinition/organization-eu'
        ]
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><p><b>name</b>: BfA-Klinik</p><p><b>address</b>: Bad Schmiedeberg 06905 Germany</p></div>'
      },
      identifier: [
        {
          system: 'urn:ietf:rfc:9562',
          value: 'cd9d8d77-6da5-4eee-b973-cf8467686ffe',
          assigner: {
            display: 'HL7 Europe'
          }
        }
      ],
      name: 'BfA-Klinik',
      address: [
        {
          city: 'Bad Schmiedeberg',
          postalCode: '06905',
          country: 'Germany'
        }
      ]
    },

    Practitioner: {
      resourceType: 'Practitioner',
      id: '398f1dee-39b2-4259-8293-7385d482d06e',
      meta: {
        profile: [
          'http://hl7.eu/fhir/base/StructureDefinition/practitioner-eu'
        ]
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><p><b>name</b>: Hel Ping</p></div>'
      },
      name: [
        {
          family: 'Ping',
          given: ['Hel'],
          prefix: ['Dr.']
        }
      ]
    },

    PractitionerRole: {
      resourceType: 'PractitionerRole',
      id: '79bb6d9a-24fa-4479-a1a6-92e958200414',
      meta: {
        profile: [
          'http://hl7.eu/fhir/base/StructureDefinition/practitionerRole-eu'
        ]
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><p><b>practitioner</b>: Practitioner Hel Ping</p><p><b>organization</b>: Organization BfA-Klinik</p></div>'
      },
      practitioner: {
        reference: 'urn:uuid:398f1dee-39b2-4259-8293-7385d482d06e'
      },
      organization: {
        reference: 'urn:uuid:ee1c1f62-cb27-4dc4-8d07-f9c58215f309'
      }
    },

    AllergyIntolerance: {
      resourceType: 'AllergyIntolerance',
      id: 'a989307f-3cf2-427a-9ea0-553fcb561480',
      meta: {
        profile: [
          'http://hl7.eu/fhir/base/StructureDefinition/allergyIntolerance-eu-core'
        ]
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><table class="hl7__ips"><tr><td>Penicillin V</td><td><span class="nb">1978-10-26</span></td><td>active</td><td>medication</td><td/></tr></table></div>'
      },
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: 'active'
          }
        ]
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: 'confirmed'
          }
        ]
      },
      type: 'allergy',
      category: ['medication'],
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '372725003',
            display: 'Penicillin V'
          }
        ],
        text: 'Penicillin V'
      },
      patient: {
        reference: 'urn:uuid:f51071b2-6c06-4d31-85ed-26a6b964ef98',
        display: 'Petra Schwartz'
      },
      onsetDateTime: '1978-10-26'
    },

    Condition: {
      resourceType: 'Condition',
      id: 'bc578ea8-f9ed-4cf2-a302-dfc36e4edbe5',
      meta: {
        profile: [
          'http://hl7.eu/fhir/base/StructureDefinition/condition-eu-core'
        ]
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><table class="hl7__ips"><tr><td>Hyperlipidemia</td><td><span class="nb">2020-06-15</span></td><td>active</td></tr></table></div>'
      },
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active'
          }
        ]
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-category',
              code: 'problem-list-item',
              display: 'Problem List Item'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '55822004',
            display: 'Hyperlipidemia (disorder)'
          }
        ],
        text: 'Hyperlipidemia'
      },
      subject: {
        reference: 'urn:uuid:f51071b2-6c06-4d31-85ed-26a6b964ef98',
        display: 'Petra Schwartz'
      },
      onsetDateTime: '2020-06-15',
      asserter: {
        reference: 'urn:uuid:398f1dee-39b2-4259-8293-7385d482d06e',
        display: 'Dr. Hel Ping'
      }
    },

    Medication: {
      resourceType: 'Medication',
      id: '08c33e59-a884-45cc-8d4c-f28165dd09ce',
      meta: {
        profile: [
          'http://hl7.eu/fhir/base/StructureDefinition/medication-eu-core'
        ]
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml">Hydrocortisone 10 mg/g and urea 100 mg/g cutaneous cream, Cutaneous cream</div>'
      },
      code: {
        coding: [
          {
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: '106258',
            display: 'hydrocortisone 10 MG/ML Topical Cream'
          },
          {
            system: 'http://snomed.info/sct',
            code: '331722005',
            display: 'Product containing precisely hydrocortisone 10 milligram/1 gram and urea 100 milligram/1 gram conventional release cutaneous cream (clinical drug)'
          }
        ],
        text: 'Hydrocortisone 10 mg/g and urea 100 mg/g cutaneous cream'
      },
      form: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '421628006',
            display: 'Cutaneous cream'
          }
        ]
      },
      ingredient: [
        {
          itemCodeableConcept: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '387092000',
                display: 'Urea'
              }
            ]
          },
          isActive: true
        }
      ]
    },

    MedicationStatement: {
      resourceType: 'MedicationStatement',
      id: '8cfdeca0-dc07-4f55-a987-bd8548fbbe34',
      meta: {
        profile: [
          'http://hl7.eu/fhir/eps/StructureDefinition/MedicationStatement-eu-eps'
        ]
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><table class="hl7__ips"><tr><td>Hydrocortisone 10 mg/g and urea 100 mg/g cutaneous cream</td><td><span class="nb">1978-10-11</span></td><td>Cutaneous cream</td><td>Apply a thin layer (approximately 1 g) to the affected area twice daily</td><td>Contact dermatitis</td></tr></table></div>'
      },
      status: 'active',
      medicationReference: {
        reference: 'urn:uuid:08c33e59-a884-45cc-8d4c-f28165dd09ce',
        display: 'Hydrocortisone 10 mg/g and urea 100 mg/g cutaneous cream'
      },
      subject: {
        reference: 'urn:uuid:f51071b2-6c06-4d31-85ed-26a6b964ef98',
        display: 'Petra Schwartz'
      },
      effectivePeriod: {
        start: '1978-10-11'
      },
      reasonCode: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '40275004',
              display: 'Contact dermatitis'
            }
          ]
        }
      ],
      dosage: [
        {
          text: 'Apply a thin layer (approximately 1 g) to the affected area twice daily',
          timing: {
            repeat: {
              frequency: 2,
              period: 1,
              periodUnit: 'd'
            }
          },
          asNeededBoolean: false,
          doseAndRate: [
            {
              doseQuantity: {
                value: 1,
                unit: 'g',
                system: 'http://unitsofmeasure.org',
                code: 'g'
              }
            }
          ]
        }
      ]
    },

    Immunization: {
      resourceType: 'Immunization',
      id: 'cfe36253-0c9c-49b6-8272-39d067952592',
      meta: {
        profile: [
          'http://hl7.eu/fhir/base/StructureDefinition/immunization-eu-core'
        ]
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><table class="hl7__ips"><tr><td>Influenza virus antigen only vaccine product</td><td><span class="nb">2025-07-14</span></td></tr></table></div>'
      },
      status: 'completed',
      vaccineCode: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '1181000221105',
            display: 'Vaccine product containing only Influenza virus antigen (medicinal product)'
          },
          {
            system: 'http://www.whocc.no/atc',
            code: 'J07BB02',
            display: 'influenza, inactivated, split virus or surface antigen'
          }
        ],
        text: 'Influenza virus antigen only vaccine product'
      },
      patient: {
        reference: 'urn:uuid:f51071b2-6c06-4d31-85ed-26a6b964ef98',
        display: 'Petra Schwartz'
      },
      occurrenceDateTime: '2025-07-14',
      lotNumber: 'AE-d4oGKOZN1',
      expirationDate: '2026-03-01',
      site: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '244979005',
            display: 'Entire muscle of upper arm'
          }
        ],
        text: 'Entire muscle of upper arm'
      },
      route: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '78421000',
            display: 'Intramuscular route'
          }
        ],
        text: 'Intramuscular route'
      }
    },

    Observation: {
      resourceType: 'Observation',
      id: '81628dd7-a8bf-43b5-bae5-001c46f1a8f8',
      meta: {
        profile: [
          'http://hl7.eu/fhir/base/StructureDefinition/medicalTestResult-eu-core'
        ]
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><p><b>status</b>: Final</p><p><b>category</b>: Laboratory</p><p><b>code</b>: Glucose [Mass/volume] in Blood</p></div>'
      },
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '2339-0',
            display: 'Glucose [Mass/volume] in Blood'
          }
        ],
        text: 'Glucose [Mass/volume] in Blood'
      },
      subject: {
        reference: 'urn:uuid:f51071b2-6c06-4d31-85ed-26a6b964ef98'
      },
      effectiveDateTime: '2024-07-15',
      performer: [
        {
          display: 'The Central European Lab'
        }
      ],
      valueQuantity: {
        value: 65.9,
        unit: 'mg/dL',
        system: 'http://unitsofmeasure.org',
        code: 'mg/dL'
      },
      interpretation: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: 'L',
              display: 'Low'
            }
          ]
        }
      ],
      referenceRange: [
        {
          low: {
            value: 70,
            system: 'http://unitsofmeasure.org',
            code: 'mg/dL'
          }
        },
        {
          high: {
            value: 99,
            system: 'http://unitsofmeasure.org',
            code: 'mg/dL'
          }
        }
      ]
    },

    Procedure: {
      resourceType: 'Procedure',
      id: '0fdb9367-03fc-44d7-abee-e9b47cc1a02a',
      meta: {
        profile: [
          'http://hl7.eu/fhir/base/StructureDefinition/procedure-eu-core'
        ]
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><table class="hl7__ips"><tr><td>Appendectomy</td><td><span class="nb">2020-03-05</span></td></tr></table></div>'
      },
      status: 'completed',
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '80146002',
            display: 'Appendectomy'
          }
        ],
        text: 'Appendectomy'
      },
      subject: {
        reference: 'urn:uuid:f51071b2-6c06-4d31-85ed-26a6b964ef98',
        display: 'Petra Schwartz'
      },
      performedDateTime: '2020-03-05',
      performer: [
        {
          actor: {
            reference: 'urn:uuid:398f1dee-39b2-4259-8293-7385d482d06e',
            display: 'Dr. Hel Ping'
          },
          onBehalfOf: {
            reference: 'urn:uuid:ee1c1f62-cb27-4dc4-8d07-f9c58215f309',
            display: 'BfA-Klinik'
          }
        }
      ]
    },

    Device: {
      resourceType: 'Device',
      id: '575520ac-c2ef-4f47-82bf-1b691f5e6466',
      meta: {
        profile: [
          'http://hl7.eu/fhir/eps/StructureDefinition/device-eu-eps'
        ]
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><p><b>status</b>: Active</p><p><b>type</b>: Blood glucose meter (physical object)</p></div>'
      },
      udiCarrier: [
        {
          id: '(01)70551104053281(11)910128(17)160212(10)34976447(21)50912'
        }
      ],
      status: 'active',
      type: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '337414009',
            display: 'Blood glucose meter (physical object)'
          }
        ]
      },
      patient: {
        reference: 'urn:uuid:f51071b2-6c06-4d31-85ed-26a6b964ef98',
        display: 'Petra Schwartz'
      }
    },

    DeviceUseStatement: {
      resourceType: 'DeviceUseStatement',
      id: '4fe58eba-854d-48a6-add1-42846081f515',
      meta: {
        profile: [
          'http://hl7.eu/fhir/eps/StructureDefinition/deviceUseStatement-eu-eps'
        ]
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><table class="hl7__ips"><tr><td>Blood glucose meter (physical object)</td><td><span class="nb">1991-02-18</span></td></tr></table></div>'
      },
      status: 'active',
      subject: {
        reference: 'urn:uuid:f51071b2-6c06-4d31-85ed-26a6b964ef98',
        display: 'Petra Schwartz'
      },
      timingPeriod: {
        start: '1991-02-18'
      },
      device: {
        reference: 'urn:uuid:575520ac-c2ef-4f47-82bf-1b691f5e6466',
        display: 'Blood glucose meter (physical object)'
      }
    },

    CarePlan: {
      resourceType: 'CarePlan',
      id: '646ea6ea-9efc-48da-86b8-a284557dad39',
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml"><table class="hl7__ips"><tr><td>Hyperlipidemia clinical management plan</td><td><span class="nb">2020-07-06</span></td><td>Hyperlipidemia</td></tr></table></div>'
      },
      status: 'active',
      intent: 'plan',
      category: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '734163000',
              display: 'Care plan'
            }
          ]
        }
      ],
      subject: {
        reference: 'urn:uuid:f51071b2-6c06-4d31-85ed-26a6b964ef98',
        display: 'Petra Schwartz'
      },
      period: {
        start: '2020-07-06'
      },
      activity: [
        {
          detail: {
            kind: 'Appointment',
            code: {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: '736285004',
                  display: 'Hyperlipidemia clinical management plan (record artifact)'
                }
              ]
            },
            reasonCode: [
              {
                coding: [
                  {
                    system: 'http://snomed.info/sct',
                    code: '55822004',
                    display: 'Hyperlipidemia'
                  }
                ]
              }
            ],
            status: 'unknown',
            description: 'Hyperlipidemia clinical management plan'
          }
        }
      ]
    },

    Extension: [
      {
        url: 'http://example.org/fhir/StructureDefinition/example-extension',
        valueString: 'Example EPS extension'
      }
    ]
  };

  exampleData.Composition = {
    resourceType: 'Composition',
    id: '76279633-d5a6-439b-9e88-5880c531e241',
    meta: {
      profile: [
        'http://hl7.eu/fhir/eps/StructureDefinition/composition-eu-eps'
      ]
    },
    text: {
      status: 'generated',
      div: '<div xmlns="http://www.w3.org/1999/xhtml"><p><b>title</b>: European Patient Summary</p></div>'
    },
    identifier: {
      system: 'urn:ietf:rfc:9562',
      value: '166615c7-0536-4d24-b5d7-8d659a29ce3e',
      assigner: {
        display: 'HL7 Europe'
      }
    },
    status: 'final',
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '60591-5',
          display: 'Patient summary Document'
        }
      ],
      text: 'Patient summary Document'
    },
    subject: {
      reference: 'urn:uuid:f51071b2-6c06-4d31-85ed-26a6b964ef98'
    },
    date: '2025-08-31T17:46:55Z',
    author: [
      {
        reference: 'urn:uuid:79bb6d9a-24fa-4479-a1a6-92e958200414'
      }
    ],
    title: 'European Patient Summary',
    confidentiality: 'N',
    custodian: {
      reference: 'urn:uuid:ee1c1f62-cb27-4dc4-8d07-f9c58215f309'
    },
    section: [
      {
        title: 'Problem list',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '11450-4',
              display: 'Problem list - Reported'
            }
          ]
        },
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><table class="hl7__ips"><tr><th>Condition</th><th>Onset Date</th><th>Status</th></tr><tr><td>Hyperlipidemia</td><td><span class="nb">2020-06-15</span></td><td>active</td></tr></table></div>'
        },
        entry: [
          {
            reference: 'urn:uuid:bc578ea8-f9ed-4cf2-a302-dfc36e4edbe5'
          }
        ]
      },
      {
        title: 'Medication list',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '10160-0',
              display: 'History of Medication use Narrative'
            }
          ]
        },
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><table class="hl7__ips"><tr><td>Hydrocortisone 10 mg/g and urea 100 mg/g cutaneous cream</td></tr></table></div>'
        },
        entry: [
          {
            reference: 'urn:uuid:8cfdeca0-dc07-4f55-a987-bd8548fbbe34'
          }
        ]
      },
      {
        title: 'Allergies and Intolerances',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '48765-2',
              display: 'Allergies and adverse reactions Document'
            }
          ]
        },
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><table class="hl7__ips"><tr><td>Penicillin V</td></tr></table></div>'
        },
        entry: [
          {
            reference: 'urn:uuid:a989307f-3cf2-427a-9ea0-553fcb561480'
          }
        ]
      },
      {
        title: 'History of Procedures',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '47519-4',
              display: 'History of Procedures Document'
            }
          ]
        },
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><table class="hl7__ips"><tr><td>Appendectomy</td></tr></table></div>'
        },
        entry: [
          {
            reference: 'urn:uuid:0fdb9367-03fc-44d7-abee-e9b47cc1a02a'
          }
        ]
      },
      {
        title: 'Device Use',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '46264-8',
              display: 'History of medical device use'
            }
          ]
        },
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><table class="hl7__ips"><tr><td>Blood glucose meter (physical object)</td></tr></table></div>'
        },
        entry: [
          {
            reference: 'urn:uuid:4fe58eba-854d-48a6-add1-42846081f515'
          }
        ]
      }
    ]
  };

  exampleData.Bundle = {
    resourceType: 'Bundle',
    id: 'Instance-Bundle-1a24e60d-9b12-4109-a50a-07249a4f21c3',
    meta: {
      profile: [
        'http://hl7.eu/fhir/eps/StructureDefinition/bundle-eu-eps'
      ]
    },
    identifier: {
      system: 'urn:ietf:rfc:9562',
      value: '350432b7-5d29-4949-89ea-f19efeb224ca',
      assigner: {
        display: 'HL7 Europe'
      }
    },
    type: 'document',
    timestamp: '2025-08-31T17:46:55Z',
    entry: [
      {
        fullUrl: 'urn:uuid:76279633-d5a6-439b-9e88-5880c531e241',
        resource: exampleData.Composition
      },
      {
        fullUrl: 'urn:uuid:f51071b2-6c06-4d31-85ed-26a6b964ef98',
        resource: exampleData.Patient
      },
      {
        fullUrl: 'urn:uuid:ee1c1f62-cb27-4dc4-8d07-f9c58215f309',
        resource: exampleData.Organization
      },
      {
        fullUrl: 'urn:uuid:79bb6d9a-24fa-4479-a1a6-92e958200414',
        resource: exampleData.PractitionerRole
      },
      {
        fullUrl: 'urn:uuid:398f1dee-39b2-4259-8293-7385d482d06e',
        resource: exampleData.Practitioner
      }
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
          'PractitionerRole.schema.json',
          'Medication.schema.json',
          'MedicationStatement.schema.json',
          'AllergyIntolerance.schema.json',
          'Condition.schema.json',
          'Observation.schema.json',
          'Immunization.schema.json',
          'Procedure.schema.json',
          'Device.schema.json',
          'DeviceUseStatement.schema.json',
          'CarePlan.schema.json',
          'Extension.schema.json'
        ];

        const fetched = await Promise.all(
          schemaFiles.map(async file => {
            const res = await fetch(`/epsDef/${file}`);
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

  const toggleView = (id) => {
    setExpandAll(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openPlainText = (id) => {
    window.open(`${window.location.origin}/epsDef/${id}.schema.json`, '_blank');
  };

  const toggleExample = (id) => {
    setShowExample(prev => ({ ...prev, [id]: !prev[id] }));
    setShowRawExample(prev => ({ ...prev, [id]: false }));
  };

  const toggleRawExample = (id) => {
    setShowRawExample(prev => ({ ...prev, [id]: !prev[id] }));
    setShowExample(prev => ({ ...prev, [id]: false }));
  };

  if (loading) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-5">
        <p className="text-danger">Error: {error}</p>
      </Container>
    );
  }

  return (
    <Container className="mt-5">
      <h3>EPS (European) JSON Schemas</h3>
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
                  <pre
                    style={{
                      background: '#f8f9fa',
                      padding: '1rem',
                      borderRadius: '4px',
                      maxHeight: '600px',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}
                  >
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