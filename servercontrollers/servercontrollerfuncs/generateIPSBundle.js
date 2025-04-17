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
                            "display": med.name,
                            "system": med.system,
                            "code": med.code
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
                            "display": allergy.name,
                            "system": allergy.system,
                            "code": allergy.code
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
                            "display": condition.name,
                            "system": condition.system,
                            "code": condition.code
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
                            "display": observation.name,
                            "system": observation.system,
                            "code": observation.code
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
                if (observation.value.includes('-')) {
                    if (observation.value.endsWith('mmHg') || observation.value.endsWith('mm[Hg]')) {
                        const bpValues = observation.value.replace('mmHg', '').split('-').map(v => parseFloat(v.trim()));
                        observationResource.resource.component = [
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
                                    value: bpValues[0],
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
                                    value: bpValues[1],
                                    unit: "mm[Hg]",
                                    system: "http://unitsofmeasure.org",
                                    code: "mm[Hg]"
                                }
                            }
                        ];
                    } else {
                        // More genenic solution to hyphenated values that are not therefore BP values - we won't include the code element and we take the unit and code from the last part of the string for both elements
                        const otherValues = observation.value.split('-').map(v => parseFloat(v.trim()));
                        // the unit is the last part of the string after the last space
                        const unit = observation.value.substring(observation.value.lastIndexOf(' ') + 1).trim();
                        observationResource.resource.component = otherValues.map((value, index) => ({
                            code: {
                                coding: [
                                    {
                                        display: `Component ${index + 1}`
                                    }
                                ]
                            },
                            valueQuantity: {
                                value: value,
                                unit: unit,
                                system: "http://unitsofmeasure.org",
                                code: unit
                            }
                        }));
                    }
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
                // Value is just text, for now assume it's body site related but we need to fix in future
                observationResource.resource.bodySite = {
                    coding: [
                        {
                            display: observation.value
                        }
                    ]
                };
            }

            // Eventually we will confine bodySite to just its field in the database but for now we'll cope with both options
            if (observation.bodySite) {
                observationResource.resource.bodySite = {
                    "coding": [
                        {
                            "display": observation.bodySite
                        }
                    ]
                };
            }
        }

        return observationResource;
    });

    // Construct Immunization resources
    const immunizations = ipsRecord.immunizations.map((immunization, index) => {
        const immunizationUUID = uuidv4();
        return {
            "fullUrl": `urn:uuid:${immunizationUUID}`,
            "resource": {
                "resourceType": "Immunization",
                "id": immunizationUUID,
                "status": "completed",
                "vaccineCode": {
                    "coding": [
                        {
                            "display": immunization.name,
                            "system": immunization.system,
                            "code": immunization.code
                        }
                    ]
                },
                "patient": {
                    "reference": `Patient/${patientUUID}`
                },
                "occurrenceDateTime": immunization.date
            }
        };
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
                },
                {
                    "title": "Immunizations",
                    "code": {
                        "coding": [
                            {
                                "system": "http://loinc .org",
                                "code": "11369-6",
                                "display": "Immunization Activity"
                            }
                        ]
                    },
                    "entry": immunizations.map((immunization) => ({
                        "reference": `Immunization/${immunization.resource.id}`
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
            ...observations,
            ...immunizations
        ]
    };

    return ipsBundle;
}

module.exports = { generateIPSBundle };