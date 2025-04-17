const { v4: uuidv4 } = require('uuid');
const { stripMilliseconds, stripTime} = require('../../utils/timeUtils');

// Helper function to check if a string contains a number
const containsNumber = (str) => /\d/.test(str);

function generateIPSBundleLegacy(ips) {

    // const ptId = "pt1";

    // var medcount = 0;
    // var algcount = 0;
    // var condcount = 0;
    // var obscount = 0;

    // Construct the JSON structure
            const ipsBundle = {
                resourceType: "Bundle",
                id: ips.packageUUID, // First ID is the packageUUID
                timestamp: ips.timeStamp, // Time stamp
                type: "collection",
                total: 2 + (ips.medication.length * 2) + ips.allergies.length + ips.conditions.length + ips.observations.length + ips.immunizations.length,
                entry: [
                    {
                        resource: {
                            resourceType: "Patient",
                            id: uuidv4(),
                            name: [
                                {
                                    family: ips.patient.name,
                                    text: `${ips.patient.given} ${ips.patient.name}`,
                                    given: [ips.patient.given, ips.patient.given.charAt(0)],
                                },
                            ],
                            gender: ips.patient.gender,
                            birthDate: stripTime(ips.patient.dob),
                            address: [
                                {
                                    country: ips.patient.nation,
                                },
                            ],
                        },
                    },
                    {
                        resource: {
                            resourceType: "Practitioner",
                            id: uuidv4(),
                            name: [
                                {
                                    text: ips.patient.practitioner,
                                },
                            ],
                        },
                    },
                    // Medication entries
                    ...ips.medication.flatMap((med) => [
                        {
                            resource: {
                                resourceType: "MedicationRequest",
                                id: uuidv4(),
                                intent: "order",
                                medicationReference: {
                                    reference: `urn:uuid:${uuidv4()}`,
                                    display: med.name,
                                },
                                authoredOn: med.date,
                                dosageInstruction: [
                                    {
                                        text: med.dosage,
                                    },
                                ],
                            },
                        },
                        {
                            resource: {
                                resourceType: "Medication",
                                id: uuidv4(),
                                code: {
                                    coding: [
                                        {
                                            display: med.name,
                                            system: med.system,
                                            code: med.code,
                                        },
                                    ],
                                },
                            },
                        },
                    ]),
                    // Allergy entries
                    ...ips.allergies.map((allergy) => ({
                        resource: {
                            resourceType: "AllergyIntolerance",
                            id: uuidv4(),
                            category: ["medication"],
                            criticality: "high",
                            code: {
                                coding: [
                                    {
                                        display: allergy.name,
                                    },
                                ],
                            },
                            onsetDateTime: allergy.date,
                        },
                    })),
                    // Condition entries
                    ...ips.conditions.map((condition) => ({
                        resource: {
                            resourceType: "Condition",
                            id: uuidv4(),
                            code: {
                                coding: [
                                    {
                                        display: condition.name,
                                    },
                                ],
                            },
                            onsetDateTime: condition.date,
                        },
                    })),
                    // Observation entries
                    ...ips.observations.map((observation) => {
                        const observationUUID = uuidv4();
                        let observationResource = {
                            resource: {
                                resourceType: "Observation",
                                id: observationUUID,
                                code: {
                                    coding: [
                                        {
                                            display: observation.name,
                                        },
                                    ],
                                },
                                effectiveDateTime: observation.date,
                            }
                        };
    
                        if (observation.value) {
                            if (containsNumber(observation.value)) {
                                // Check if the value is in the blood pressure format
                                if (observation.value.includes('-') && (observation.value.endsWith('mmHg') || observation.value.endsWith('mm[Hg]'))) {
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
                                // Value is just text, for now assume it's body site related but we need to fix in future
                                observationResource.resource.bodySite = {
                                    coding: [
                                        {
                                            display: observation.value,
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
                    }),
                    // Immunization entries
                    ...ips.immunizations.map((immunization) => ({
                        resource: {
                            resourceType: "Immunization",
                            id: uuidv4(),
                            status: "completed",
                            vaccineCode: {
                                coding: [
                                    {
                                        system: immunization.system,
                                        code: immunization.name,
                                    },
                                ],
                            },
                            occurrenceDateTime: immunization.date,
                        },
                    })),
                ],
            };

    return ipsBundle;
}

module.exports = { generateIPSBundleLegacy };