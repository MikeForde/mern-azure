const { resolveId } = require('../utils/resolveId');
const { v4: uuidv4 } = require('uuid');

// Helper function to check if a string contains a number
const containsNumber = (str) => /\d/.test(str);

async function getIPSUnifiedBundle(req, res) {
    const id = req.params.id;

    var medcount = 0;
    var algcount = 0;
    var condcount = 0;
    var obscount = 0;

    try {
        const ips = await resolveId(id);

        if (!ips) {
            return res.status(404).json({ message: "IPS record not found" });
        }

        // Generate the timestamp
        const timestamp = new Date(ips.timeStamp);
        const formattedTimestamp = timestamp.toISOString().replace(/(\.\d+)?Z$/, "Z");

        // Construct the JSON structure
        const bundle = {
            resourceType: "Bundle",
            id: ips.packageUUID, // First ID is the packageUUID
            timestamp: formattedTimestamp,
            type: "collection",
            total: 2 + (ips.medication.length * 2) + ips.allergies.length + ips.conditions.length + ips.observations.length,
            entry: [
                {
                    resource: {
                        resourceType: "Patient",
                        id: "pt1",
                        name: [
                            {
                                family: ips.patient.name,
                                given: [ips.patient.given],
                            },
                        ],
                        gender: ips.patient.gender,
                        birthDate: ips.patient.dob,
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
                            intent: "order",
                            medicationReference: {
                                reference: "med" + medcount,
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
                        criticality: "high",
                        code: {
                            coding: [
                                {
                                    display: allergy.name,
                                    system: allergy.system,
                                    code: allergy.code,
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
                        onsetDateTime: condition.date,
                    },
                })),
                // Observation entries
                ...ips.observations.map((observation) => {
                    const observationUUID = "ob" + ++obscount;
                    let observationResource = {
                        resource: {
                            resourceType: "Observation",
                            id: observationUUID,
                            code: {
                                coding: [
                                    {
                                        display: observation.name,
                                        system: observation.system,
                                        code: observation.code,
                                    },
                                ],
                            },
                            effectiveDateTime: observation.date,
                        }
                    };

                    if (observation.value) {
                        if (containsNumber(observation.value)) {
                            const valueMatch = observation.value.match(/(\d+\.?\d*)(\D+)/);
                            if (valueMatch) {
                                observationResource.resource.valueQuantity = {
                                    value: parseFloat(valueMatch[1]),
                                    unit: valueMatch[2].trim(),
                                    system: "http://unitsofmeasure.org",
                                    code: valueMatch[2].trim()
                                };
                            }
                        } else {
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
                }),
            ],
        };

        res.json(bundle);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

module.exports = { getIPSUnifiedBundle };
