const { resolveId } = require('../utils/resolveId');
const { v4: uuidv4 } = require('uuid');

// Helper function to check if a string contains a number
const containsNumber = (str) => /\d/.test(str);

async function getIPSLegacyBundle(req, res) {
    const id = req.params.id;

    try {
        const ips = await resolveId(id);

        if (!ips) {
            return res.status(404).json({ message: "IPS record not found" });
        }

        // Construct the JSON structure
        const bundle = {
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

        res.json(bundle);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

module.exports = { getIPSLegacyBundle };
