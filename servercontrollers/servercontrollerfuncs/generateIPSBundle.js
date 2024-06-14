const { v4: uuidv4 } = require('uuid');

// Helper function to check if a string contains a number
const containsNumber = (str) => /\d/.test(str);

function generateIPSBundle(ipsRecord) {
    // Generate UUIDs
    const compositionUUID = uuidv4();
    const patientUUID = uuidv4();
    const practitionerUUID = uuidv4();
    const organizationUUID = uuidv4();

    // Get current date/time
    const currentDateTime = new Date().toISOString();

    // Construct Medication resources - Medication first as referenced by MedicationStatement
    const medications = ipsRecord.medication.map((med, index) => {
        const medicationUUID = uuidv4();

        return {
            "fullUrl": `urn:uuid:${medicationUUID}`,
            "resource": {
                "resourceType": "Medication",
                "id": medicationUUID,
                "code": {
                    "coding": [
                        {
                            "display": med.name
                        }
                    ]
                }
            }
        };
    });

    // Construct MedicationStatement resources
    const medicationStatements = medications.map((medication, index) => {
        const medicationStatementUUID = uuidv4();

        return {
            "fullUrl": `urn:uuid:${medicationStatementUUID}`,
            "resource": {
                "resourceType": "MedicationStatement",
                "id": medicationStatementUUID,
                "medicationReference": {
                    "reference": `Medication/${medication.resource.id}`,
                    "display": medication.resource.code.coding[0].display
                },
                "subject": {
                    "reference": `Patient/${patientUUID}`
                },
                "effectivePeriod": {
                    "start": ipsRecord.medication[index].date
                },
                "dosage": [
                    {
                        "text": ipsRecord.medication[index].dosage
                    }
                ]
            }
        };
    });

    // Construct AllergyIntolerance resources
    const allergyIntolerances = ipsRecord.allergies.map((allergy, index) => {
        const allergyIntoleranceUUID = uuidv4();

        return {
            "fullUrl": `urn:uuid:${allergyIntoleranceUUID}`,
            "resource": {
                "resourceType": "AllergyIntolerance",
                "id": allergyIntoleranceUUID,
                "type": "allergy",
                "category": ["medication"],
                "criticality": allergy.criticality,
                "code": {
                    "coding": [
                        {
                            "display": allergy.name
                        }
                    ]
                },
                "patient": {
                    "reference": `Patient/${patientUUID}`
                },
                "onsetDateTime": allergy.date
            }
        };
    });

    // Construct Condition resource
    const conditions = ipsRecord.conditions.map((condition, index) => {
        const conditionUUID = uuidv4();

        return {
            "fullUrl": `urn:uuid:${conditionUUID}`,
            "resource": {
                "resourceType": "Condition",
                "id": conditionUUID,
                "code": {
                    "coding": [
                        {
                            "display": condition.name
                        }
                    ]
                },
                "subject": {
                    "reference": `Patient/${patientUUID}`
                },
                "onsetDateTime": condition.date
            }
        };
    });

    // Construct Observation resources
    const observations = ipsRecord.observations.map((observation, index) => {
        const observationUUID = uuidv4();
        let observationResource = {
            "fullUrl": `urn:uuid:${observationUUID}`,
            "resource": {
                "resourceType": "Observation",
                "id": observationUUID,
                "code": {
                    "coding": [
                        {
                            "display": observation.name
                        }
                    ]
                },
                "subject": {
                    "reference": `Patient/${patientUUID}`
                },
                "effectiveDateTime": observation.date
            }
        };

        if (observation.value) {
            if (containsNumber(observation.value)) {
                // Check if the value is in the blood pressure format
                if (observation.value.includes('-') && observation.value.endsWith('mmHg')) {
                    const bpValues = observation.value.split('-');
                    observationResource.resource.valueQuantity = {
                        value: bpValues[0] + '-' + parseFloat(bpValues[1]), // retain the full <number>-<number> part
                        unit: 'mmHg',
                        system: "http://unitsofmeasure.org",
                        code: 'mmHg'
                    };
                } else if (observation.value.includes('.')) {
                    // Value contains a decimal point, assume it's a numerical value with units
                    const valueMatch = observation.value.match(/(\d+\.\d+)(\D+)/);
                    if (valueMatch) {
                        observationResource.resource.valueQuantity = {
                            value: parseFloat(valueMatch[1]),
                            unit: valueMatch[2].trim(),
                            system: "http://unitsofmeasure.org",
                            code: valueMatch[2].trim()
                        };
                    }
                } else {
                    // Value contains a number, assume it's numerical value with units
                    const valueMatch = observation.value.match(/(\d+)(\D+)/);
                    if (valueMatch) {
                        observationResource.resource.valueQuantity = {
                            value: parseFloat(valueMatch[1]),
                            unit: valueMatch[2].trim(),
                            system: "http://unitsofmeasure.org",
                            code: valueMatch[2].trim()
                        };
                    }
                }
            }
             else {
                // Value is just text, assume it's body site related
                observationResource.resource.bodySite = {
                    coding: [
                        {
                            display: observation.value
                        }
                    ]
                };
            }
        }

        return observationResource;
    });

    // Construct Composition resource
    const composition = {
        "fullUrl": `urn:uuid:${compositionUUID}`,
        "resource": {
            "resourceType": "Composition",
            "id": compositionUUID,
            "type": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": "60591-5",
                        "display": "Patient summary Document"
                    }
                ]
            },
            "subject": {
                "reference": `Patient/${patientUUID}`
            },
            "date": currentDateTime,
            "author": [
                {
                    "reference": `Practitioner/${practitionerUUID}`
                }
            ],
            "title": `Patient Summary as of ${currentDateTime}`,
            "custodian": {
                "reference": `Organization/${organizationUUID}`
            },
            "section": [
                {
                    "title": "Medication",
                    "code": {
                        "coding": [
                            {
                                "system": "http://loinc.org",
                                "code": "10160-0",
                                "display": "History of Medication use Narrative"
                            }
                        ]
                    },
                    "entry": medicationStatements.map((medStatement) => ({
                        "reference": `MedicationStatement/${medStatement.resource.id}`
                    }))
                },
                {
                    "title": "Allergies and Intolerances",
                    "code": {
                        "coding": [
                            {
                                "system": "http://loinc.org",
                                "code": "48765-2",
                                "display": "Allergies and adverse reactions Document"
                            }
                        ]
                    },
                    "entry": allergyIntolerances.map((allergyIntolerance) => ({
                        "reference": `AllergyIntolerance/${allergyIntolerance.resource.id}`
                    }))
                },
                {
                    "title": "Conditions",
                    "code": {
                        "coding": [
                            {
                                "system": "http://loinc.org",
                                "code": "11450-4",
                                "display": "Problem List"
                            }
                        ]
                    },
                    "entry": conditions.map((condition) => ({
                        "reference": `Condition/${condition.resource.id}`
                    }))
                },
                {
                    "title": "Observations",
                    "code": {
                        "coding": [
                            {
                                "system": "http://loinc.org",
                                "code": "61150-9",
                                "display": "Vital signs, weight, length, head circumference, oxygen saturation and BMI Panel"
                            }
                        ]
                    },
                    "entry": observations.map((observation) => ({
                        "reference": `Observation/${observation.resource.id}`
                    }))
                }
            ]
        }
    };

    // Construct bundle - actual order of entries is important for FHIR compliance
    // However, we use the commonense order of Composition, Patient, Practitioner, Organization, Medication, AllergyIntolerance
    const ipsBundle = {
        "resourceType": "Bundle",
        "id": ipsRecord.packageUUID,
        "type": "document",
        "timestamp": ipsRecord.timeStamp.toISOString(),
        "entry": [
            // Composition entry - arguably nugatory but required for FHIR compliance
            composition,
            // Patient, Practitioner, and Organization entries
            {
                "fullUrl": `urn:uuid:${patientUUID}`,
                "resource": {
                    "resourceType": "Patient",
                    "id": patientUUID,
                    "name": [
                        {
                            "family": ipsRecord.patient.name,
                            "given": [ipsRecord.patient.given]
                        }
                    ],
                    "gender": ipsRecord.patient.gender,
                    "birthDate": ipsRecord.patient.dob.toISOString().split('T')[0],
                    "address": [
                        {
                            "country": ipsRecord.patient.nation
                        }
                    ]
                }
            },
            {
                "fullUrl": `urn:uuid:${practitionerUUID}`,
                "resource": {
                    "resourceType": "Practitioner",
                    "id": practitionerUUID,
                    "name": [
                        {
                            "text": ipsRecord.patient.practitioner
                        }
                    ]
                }
            },
            {
                "fullUrl": `urn:uuid:${organizationUUID}`,
                "resource": {
                    "resourceType": "Organization",
                    "id": organizationUUID,
                    "name": ipsRecord.patient.organization ? ipsRecord.patient.organization : "Unknown"
                }
            },
            // Medication and AllergyIntolerance entries
            // MedicationStatement plus Medication constitutes a Medication Summary 'entry'
            ...medicationStatements,
            ...medications,
            ...allergyIntolerances,
            ...conditions,
            ...observations
        ]
    };

    return ipsBundle;
}

module.exports = { generateIPSBundle };
