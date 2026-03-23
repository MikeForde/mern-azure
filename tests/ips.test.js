const { convertIPSBundleToSchema } = require('../servercontrollers/servercontrollerfuncs/convertIPSBundleToSchema');
const { generateIPSBundle } = require('../servercontrollers/servercontrollerfuncs/generateIPSBundle');
const { generateIPSBEER } = require('../servercontrollers/servercontrollerfuncs/generateIPSBEER');

describe('convertIPSBundleToSchema', () => {
  test('should handle empty bundle', () => {
    const result = convertIPSBundleToSchema({});
    expect(result).toHaveProperty('packageUUID');
    expect(result).toHaveProperty('timeStamp');
    expect(result).toHaveProperty('patient');
    expect(result.medication).toEqual([]);
    expect(result.allergies).toEqual([]);
    expect(result.conditions).toEqual([]);
    expect(result.observations).toEqual([]);
    expect(result.immunizations).toEqual([]);
    expect(result.procedures).toEqual([]);
  });

  test('should handle null/undefined input', () => {
    const result1 = convertIPSBundleToSchema(null);
    expect(result1).toHaveProperty('packageUUID');
    
    const result2 = convertIPSBundleToSchema(undefined);
    expect(result2).toHaveProperty('packageUUID');
  });

  test('should extract patient information from Patient resource', () => {
    const bundle = {
      id: 'test-bundle-123',
      timestamp: '2024-01-15T10:00:00.000Z',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            name: [{ family: 'Smith', given: ['John'] }],
            birthDate: '1980-05-15',
            gender: 'male',
            address: [{ country: 'UK' }]
          }
        }
      ]
    };

    const result = convertIPSBundleToSchema(bundle);
    expect(result.patient.name).toBe('Smith');
    expect(result.patient.given).toBe('John');
    expect(result.patient.dob).toBe('1980-05-15');
    expect(result.patient.gender).toBe('male');
    expect(result.patient.nation).toBe('UK');
  });

  test('should extract practitioner from Practitioner resource', () => {
    const bundle = {
      entry: [
        {
          resource: {
            resourceType: 'Practitioner',
            name: [{ text: 'Dr. Jane Doe' }]
          }
        }
      ]
    };

    const result = convertIPSBundleToSchema(bundle);
    expect(result.patient.practitioner).toBe('Dr. Jane Doe');
  });

  test('should extract organization from Organization resource', () => {
    const bundle = {
      entry: [
        {
          resource: {
            resourceType: 'Organization',
            name: 'NHS Hospital'
          }
        }
      ]
    };

    const result = convertIPSBundleToSchema(bundle);
    expect(result.patient.organization).toBe('NHS Hospital');
  });

  test('should extract medication from MedicationStatement', () => {
    const bundle = {
      entry: [
        {
          resource: {
            resourceType: 'MedicationStatement',
            status: 'active',
            medicationReference: { display: 'Aspirin 100mg' },
            effectiveDateTime: '2024-01-15T10:00:00Z',
            dosage: [{ text: 'Once daily' }]
          }
        }
      ]
    };

    const result = convertIPSBundleToSchema(bundle);
    expect(result.medication).toHaveLength(1);
    expect(result.medication[0].name).toBe('Aspirin 100mg');
    expect(result.medication[0].status).toBe('active');
    expect(result.medication[0].dosage).toBe('Once daily');
  });

  test('should extract allergy from AllergyIntolerance', () => {
    const bundle = {
      entry: [
        {
          resource: {
            resourceType: 'AllergyIntolerance',
            code: {
              coding: [{ display: 'Penicillin', code: '12345', system: 'http://snomed.info/sct' }]
            },
            criticality: 'high',
            onsetDateTime: '2020-05-10'
          }
        }
      ]
    };

    const result = convertIPSBundleToSchema(bundle);
    expect(result.allergies).toHaveLength(1);
    expect(result.allergies[0].name).toBe('Penicillin');
    expect(result.allergies[0].criticality).toBe('high');
    expect(result.allergies[0].code).toBe('12345');
  });

  test('should extract condition from Condition', () => {
    const bundle = {
      entry: [
        {
          resource: {
            resourceType: 'Condition',
            code: {
              coding: [{ display: 'Hypertension', code: '38341003', system: 'http://snomed.info/sct' }]
            },
            onsetDateTime: '2023-06-15'
          }
        }
      ]
    };

    const result = convertIPSBundleToSchema(bundle);
    expect(result.conditions).toHaveLength(1);
    expect(result.conditions[0].name).toBe('Hypertension');
    expect(result.conditions[0].code).toBe('38341003');
  });

  test('should extract observation from Observation', () => {
    const bundle = {
      entry: [
        {
          resource: {
            resourceType: 'Observation',
            code: {
              coding: [{ display: 'Blood Pressure', code: '85354-9', system: 'http://loinc.org' }]
            },
            status: 'final',
            effectiveDateTime: '2024-01-15T10:00:00Z',
            valueQuantity: { value: 120, unit: 'mmHg' }
          }
        }
      ]
    };

    const result = convertIPSBundleToSchema(bundle);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].name).toBe('Blood Pressure');
    expect(result.observations[0].value).toBe('120 mmHg');
  });

  test('should extract immunization from Immunization', () => {
    const bundle = {
      entry: [
        {
          resource: {
            resourceType: 'Immunization',
            status: 'completed',
            vaccineCode: {
              coding: [{ display: 'COVID-19 Vaccine', code: '208', system: 'http://snomed.info/sct' }]
            },
            occurrenceDateTime: '2024-01-15'
          }
        }
      ]
    };

    const result = convertIPSBundleToSchema(bundle);
    expect(result.immunizations).toHaveLength(1);
    expect(result.immunizations[0].name).toBe('COVID-19 Vaccine');
    expect(result.immunizations[0].status).toBe('completed');
  });

  test('should extract procedure from Procedure', () => {
    const bundle = {
      entry: [
        {
          resource: {
            resourceType: 'Procedure',
            status: 'completed',
            code: {
              coding: [{ display: 'Appendectomy', code: '80146002', system: 'http://snomed.info/sct' }]
            },
            performedDateTime: '2023-12-01'
          }
        }
      ]
    };

    const result = convertIPSBundleToSchema(bundle);
    expect(result.procedures).toHaveLength(1);
    expect(result.procedures[0].name).toBe('Appendectomy');
    expect(result.procedures[0].status).toBe('completed');
  });
});

describe('generateIPSBundle', () => {
  const sampleIPSRecord = {
    packageUUID: 'test-uuid-123',
    timeStamp: new Date('2024-01-15T10:00:00.000Z'),
    patient: {
      name: 'Smith',
      given: 'John',
      dob: new Date('1980-05-15'),
      gender: 'male',
      nation: 'UK',
      practitioner: 'Dr. Jane Doe',
      organization: 'NHS Hospital'
    },
    medication: [
      { name: 'Aspirin', system: 'http://snomed.info/sct', code: '12345', date: '2024-01-10', dosage: '100mg daily', status: 'active' }
    ],
    allergies: [
      { name: 'Penicillin', system: 'http://snomed.info/sct', code: '67890', criticality: 'high', date: '2020-05-10' }
    ],
    conditions: [
      { name: 'Hypertension', system: 'http://snomed.info/sct', code: '38341003', date: '2023-06-15' }
    ],
    observations: [
      { name: 'Blood Pressure', system: 'http://loinc.org', code: '85354-9', value: '120-80 mmHg', date: '2024-01-15', status: 'final' }
    ],
    immunizations: [
      { name: 'COVID-19 Vaccine', system: 'http://snomed.info/sct', code: '208', date: '2024-01-15', status: 'completed' }
    ],
    procedures: [
      { name: 'Appendectomy', system: 'http://snomed.info/sct', code: '80146002', date: '2023-12-01', status: 'completed' }
    ]
  };

  test('should generate a valid FHIR Bundle', () => {
    const bundle = generateIPSBundle(sampleIPSRecord);
    
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('document');
    expect(bundle.id).toBe('test-uuid-123');
    expect(bundle).toHaveProperty('timestamp');
    expect(bundle).toHaveProperty('entry');
    expect(Array.isArray(bundle.entry)).toBe(true);
  });

  test('should include Composition resource', () => {
    const bundle = generateIPSBundle(sampleIPSRecord);
    const composition = bundle.entry.find(e => e.resource?.resourceType === 'Composition');
    
    expect(composition).toBeDefined();
    expect(composition.resource.status).toBe('final');
    expect(composition.resource.type.coding[0].code).toBe('60591-5');
  });

  test('should include Patient resource', () => {
    const bundle = generateIPSBundle(sampleIPSRecord);
    const patient = bundle.entry.find(e => e.resource?.resourceType === 'Patient');
    
    expect(patient).toBeDefined();
    expect(patient.resource.name[0].family).toBe('Smith');
    expect(patient.resource.name[0].given[0]).toBe('John');
  });

  test('should include Practitioner resource', () => {
    const bundle = generateIPSBundle(sampleIPSRecord);
    const practitioner = bundle.entry.find(e => e.resource?.resourceType === 'Practitioner');
    
    expect(practitioner).toBeDefined();
    expect(practitioner.resource.name[0].text).toBe('Dr. Jane Doe');
  });

  test('should include Organization resource', () => {
    const bundle = generateIPSBundle(sampleIPSRecord);
    const organization = bundle.entry.find(e => e.resource?.resourceType === 'Organization');
    
    expect(organization).toBeDefined();
    expect(organization.resource.name).toBe('NHS Hospital');
  });

  test('should include MedicationStatement resources', () => {
    const bundle = generateIPSBundle(sampleIPSRecord);
    const medStatements = bundle.entry.filter(e => e.resource?.resourceType === 'MedicationStatement');
    
    expect(medStatements.length).toBe(1);
    expect(medStatements[0].resource.medicationReference.display).toBe('Aspirin');
  });

  test('should include AllergyIntolerance resources', () => {
    const bundle = generateIPSBundle(sampleIPSRecord);
    const allergies = bundle.entry.filter(e => e.resource?.resourceType === 'AllergyIntolerance');
    
    expect(allergies.length).toBe(1);
    expect(allergies[0].resource.code.coding[0].display).toBe('Penicillin');
  });

  test('should include Condition resources', () => {
    const bundle = generateIPSBundle(sampleIPSRecord);
    const conditions = bundle.entry.filter(e => e.resource?.resourceType === 'Condition');
    
    expect(conditions.length).toBe(1);
    expect(conditions[0].resource.code.coding[0].display).toBe('Hypertension');
  });

  test('should include Observation resources', () => {
    const bundle = generateIPSBundle(sampleIPSRecord);
    const observations = bundle.entry.filter(e => e.resource?.resourceType === 'Observation');
    
    expect(observations.length).toBe(1);
    expect(observations[0].resource.code.coding[0].display).toBe('Blood Pressure');
  });

  test('should include Immunization resources', () => {
    const bundle = generateIPSBundle(sampleIPSRecord);
    const immunizations = bundle.entry.filter(e => e.resource?.resourceType === 'Immunization');
    
    expect(immunizations.length).toBe(1);
    expect(immunizations[0].resource.vaccineCode.coding[0].display).toBe('COVID-19 Vaccine');
  });

  test('should handle empty medication array', () => {
    const record = { ...sampleIPSRecord, medication: [] };
    const bundle = generateIPSBundle(record);
    
    const medStatements = bundle.entry.filter(e => e.resource?.resourceType === 'MedicationStatement');
    expect(medStatements.length).toBe(0);
  });

  test('should handle missing optional arrays', () => {
    const record = {
      packageUUID: 'test-123',
      timeStamp: new Date(),
      patient: { name: 'Test', given: 'User', dob: new Date(), gender: 'male' },
      medication: [],
      allergies: [],
      conditions: [],
      observations: [],
      immunizations: []
    };
    
    const bundle = generateIPSBundle(record);
    expect(bundle.entry.length).toBeGreaterThan(0);
  });

  test('should include narrative when requested', () => {
    const bundle = generateIPSBundle(sampleIPSRecord, { includeNarrative: true });
    
    const composition = bundle.entry.find(e => e.resource?.resourceType === 'Composition');
    expect(composition.resource.section[0].text).toBeDefined();
  });
});

describe('generateIPSBEER', () => {
  const sampleIPSRecord = {
    packageUUID: 'beer-test-123',
    timeStamp: new Date('2024-01-15T10:00:00.000Z'),
    patient: {
      name: 'Smith',
      given: 'John',
      dob: new Date('1980-05-15'),
      gender: 'male',
      nation: 'UK',
      practitioner: 'Dr. Jane Doe',
      organization: 'NHS Hospital'
    },
    medication: [
      { name: 'Aspirin', date: '2023-12-01', dosage: '100mg daily' }
    ],
    allergies: [
      { name: 'Penicillin', criticality: 'high', date: '2020-05-10' }
    ],
    conditions: [
      { name: 'Hypertension', date: '2023-06-15' }
    ],
    observations: [
      { name: 'Blood Pressure', value: '120-80 mmHg', date: '2024-01-10' }
    ],
    immunizations: [
      { name: 'COVID-19 Vaccine', system: 'http://snomed.info/sct', date: '2024-01-15' }
    ]
  };

  test('should generate BEER string with pipe delimiter', () => {
    const beer = generateIPSBEER(sampleIPSRecord, '|');
    
    expect(beer).toContain('H9|');
    expect(beer).toContain('Smith|');
    expect(beer).toContain('John|');
    expect(beer).toContain('beer-test-123|');
  });

  test('should include patient name and gender', () => {
    const beer = generateIPSBEER(sampleIPSRecord, '|');
    
    expect(beer).toContain('Smith|');
    expect(beer).toContain('John|');
    expect(beer).toContain('m|');
  });

  test('should include medication information', () => {
    const beer = generateIPSBEER(sampleIPSRecord, '|');
    
    expect(beer).toContain('M3-1|');
    expect(beer).toContain('Aspirin|');
  });

  test('should include allergy information', () => {
    const beer = generateIPSBEER(sampleIPSRecord, '|');
    
    expect(beer).toContain('A3-1|');
    expect(beer).toContain('Penicillin|');
    expect(beer).toContain('h|');
  });

  test('should handle newline delimiter', () => {
    const beer = generateIPSBEER(sampleIPSRecord, '\n');
    
    expect(beer).toContain('H9\n');
    expect(beer.split('\n').length).toBeGreaterThan(5);
  });

  test('should handle empty medication array', () => {
    const record = { ...sampleIPSRecord, medication: [] };
    const beer = generateIPSBEER(record, '|');
    
    expect(beer).toContain('H9|');
    expect(beer).not.toContain('M3-');
  });

  test('should handle empty allergies array', () => {
    const record = { ...sampleIPSRecord, allergies: [] };
    const beer = generateIPSBEER(record, '|');
    
    expect(beer).not.toContain('A3-');
  });

  test('should format dates correctly', () => {
    const beer = generateIPSBEER(sampleIPSRecord, '|');
    
    expect(beer).toContain('19800515|');
    expect(beer).toContain('20240115');
  });

  test('should handle unknown gender gracefully', () => {
    const record = { ...sampleIPSRecord, patient: { ...sampleIPSRecord.patient, gender: 'unknown' } };
    const beer = generateIPSBEER(record, '|');
    
    expect(beer).toContain('u|');
  });
});
