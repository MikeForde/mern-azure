const { v4: uuidv4, validate: isValidUUID } = require('uuid');
const { IPSModel } = require('../models/IPSModel');

// Helper function to check if a string contains a number
const containsNumber = (str) => /\d/.test(str);

function getIPSLegacyBundle(req, res) {
    const id = req.params.id;
    let query;

    // Check if the provided ID is a valid UUID
    if (isValidUUID(id)) {
        // Search using packageUUID if it is a valid UUID
        query = IPSModel.findOne({ packageUUID: id });
    } else {
        // Otherwise, assume it is a MongoDB ObjectId
        query = IPSModel.findById(id);
    }

    query.exec()
        .then((ips) => {
            if (!ips) {
                return res.status(404).json({ message: "IPS record not found" });
            }

            // Constructing the JSON structure
            const bundle = {
                resourceType: "Bundle",
                id: ips.packageUUID, // First ID is the packageUUID
                timestamp: ips.timeStamp, // Time stamp
                type: "collection",
                total: 2 + (ips.medication.length * 2) + ips.allergies.length + ips.conditions.length + ips.observations.length, // Total resources
                entry: [
                    {
                        resource: {
                            resourceType: "Patient",
                            id: uuidv4(), // Generate UUID for patient ID
                            name: [
                                {
                                    family: ips.patient.name,
                                    text: `${ips.patient.given} ${ips.patient.name}`,
                                    given: [ips.patient.given, ips.patient.given.charAt(0)],
                                },
                            ],
                            gender: ips.patient.gender,
                            birthDate: ips.patient.dob, // Date of birth
                            address: [
                                {
                                    country: ips.patient.nationality, // Nationality
                                },
                            ],
                        },
                    },
                    {
                        resource: {
                            resourceType: "Practitioner",
                            id: uuidv4(), // Generate UUID for practitioner ID
                            name: [
                                {
                                    text: ips.patient.practitioner, // Practitioner name
                                },
                            ],
                        },
                    },
                    // Medication entries
                    ...ips.medication.flatMap((med) => [
                        {
                            resource: {
                                resourceType: "MedicationRequest",
                                id: uuidv4(), // Generate UUID for medication request ID
                                intent: "order",
                                medicationReference: {
                                    reference: `urn:uuid:${uuidv4()}`, // Generate UUID for medication reference
                                    display: med.name, // Medication name
                                },
                                authoredOn: med.date, // Date
                                dosageInstruction: [
                                    {
                                        text: med.dosage, // Dosage
                                        // Other dosage instructions
                                    },
                                ],
                            },
                        },
                        {
                            resource: {
                                resourceType: "Medication",
                                id: uuidv4(), // Generate UUID for medication ID
                                code: {
                                    coding: [
                                        {
                                            display: med.name, // Medication name
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
                            id: uuidv4(), // Generate UUID for allergy ID
                            category: ["medication"],
                            criticality: "high",
                            code: {
                                coding: [
                                    {
                                        display: allergy.name, // Allergy name
                                    },
                                ],
                            },
                            onsetDateTime: allergy.date, // Onset date
                        },
                    })),
                    // Condition entries
                    ...ips.conditions.map((condition) => ({
                        resource: {
                            resourceType: "Condition",
                            id: uuidv4(), // Generate UUID for condition ID
                            code: {
                                coding: [
                                    {
                                        display: condition.name, // Condition name
                                    },
                                ],
                            },
                            onsetDateTime: condition.date, // Onset date
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
                                            display: observation.name, // Observation name
                                        },
                                    ],
                                },
                                effectiveDateTime: observation.date, // Effective date
                            }
                        };

                        if (observation.value) {
                            if (containsNumber(observation.value)) {
                                // Value contains a number, assume it's numerical value with units
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
                    }),
                ],
            };

            res.json(bundle);
        })
        .catch((err) => {
            res.status(400).send(err);
        });
}

module.exports = { getIPSLegacyBundle };
