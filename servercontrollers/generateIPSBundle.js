const { v4: uuidv4 } = require('uuid');

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
                "criticality": allergy.severity,
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
        "timestamp": currentDateTime,
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
                    "gender": "unknown",
                    "birthDate": ipsRecord.patient.dob,
                    "address": [
                        {
                            "country": ipsRecord.patient.nationality
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
                    "name": "UK DMS"
                }
            },
            // Medication and AllergyIntolerance entries
            // MedicationStatement plus Medication constitutes a Medication Summary 'entry'
            ...medicationStatements,
            ...medications,
            ...allergyIntolerances
        ]
    };

    return ipsBundle;
}

module.exports = { generateIPSBundle };
