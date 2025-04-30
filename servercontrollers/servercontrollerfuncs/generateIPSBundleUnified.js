const { v4: uuidv4 } = require('uuid');
const { stripMilliseconds, stripTime} = require('../../utils/timeUtils');

// Helper function to check if a string contains a number
const containsNumber = (str) => /\d/.test(str);

function generateIPSBundleUnified(ips) {

    const ptId = "pt1";

    var medcount = 0;
    var algcount = 0;
    var condcount = 0;
    var obscount = 0;

    const ipsBundle = {
                resourceType: "Bundle",
                id: ips.packageUUID, // First ID is the packageUUID
                timestamp: stripMilliseconds(ips.timeStamp),
                type: "collection",
                total: 2 + (ips.medication.length * 2) + ips.allergies.length + ips.conditions.length + ips.observations.length,
                entry: [
                    {
                        resource: {
                            resourceType: "Patient",
                            id: ptId,
                            identifier: [
                                {
                                    system: "NATO_Id",
                                    value: ips.patient.identifier ? ips.patient.identifier : uuidv4().split("-")[0],
                                },
                                {
                                    system: "National_Id",
                                    value: ips.patient.identifier2 ? ips.patient.identifier2 : uuidv4().split("-")[0],
                                },
                            ],
                            name: [
                                {
                                    family: ips.patient.name,
                                    given: [ips.patient.given],
                                },
                            ],
                            gender: ips.patient.gender.toLowerCase(),
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
                            resourceType: "Organization",
                            id: "org1",
                            name: ips.patient.organization,
                        }, 
                    },
                    // Medication entries
                    ...ips.medication.flatMap((med) => [
                        {
                            resource: {
                                resourceType: "MedicationRequest",
                                id: "medreq" + ++medcount,
                                status: med.status ? med.status.toLowerCase() : "active",
                                medicationReference: {
                                    reference: "med" + medcount,
                                    display: med.name,
                                },
                                subject: {
                                    reference: "Patient/" + ptId,
                                },
                                authoredOn: stripMilliseconds(med.date),
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
                                id: "med" + medcount,
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
                            id: "allergy" + ++algcount,
                            category: ["medication"],
                            criticality: allergy.criticality ? allergy.criticality.toLowerCase() : "high",
                            code: {
                                coding: [
                                    {
                                        display: allergy.name,
                                        system: allergy.system,
                                        code: allergy.code,
                                    },
                                ],
                            },
                            patient: {
                                reference: "Patient/" + ptId,
                            },
                            onsetDateTime: stripMilliseconds(allergy.date),
                        },
                    })),
                    // Condition entries
                    ...ips.conditions.map((condition) => ({
                        resource: {
                            resourceType: "Condition",
                            id: "condition" + ++condcount,
                            code: {
                                coding: [
                                    {
                                        display: condition.name,
                                        system: condition.system,
                                        code: condition.code,
                                    },
                                ],
                            },
                            subject: {
                                reference: "Patient/" + ptId,
                            },
                            onsetDateTime: stripMilliseconds(condition.date),
                        },
                    })),
                    // Observation entries
                    ...ips.observations.map((observation) => {
                        const observationUUID = "ob" + ++obscount;
                        let observationResource = {
                            resource: {
                                resourceType: "Observation",
                                id: observationUUID,
                                status: observation.status ? observation.status.toLowerCase() : "final",
                                code: {
                                    coding: [
                                        {
                                            display: observation.name,
                                            system: observation.system,
                                            code: observation.code,
                                        },
                                    ],
                                },
                                subject: {
                                    reference: "Patient/" + ptId,
                                },
                                effectiveDateTime: stripMilliseconds(observation.date),
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
                                            display: observation.value,
                                        }
                                    ]
                                };
                             }
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
    
                        return observationResource;
                    }),
                ],
            };

    return ipsBundle;
}

module.exports = { generateIPSBundleUnified };