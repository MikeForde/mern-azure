const { v4: uuidv4 } = require('uuid');
const { IPSModel } = require('../models/IPSModel');

function getIPSLegacyBundle(req, res) {
    const id = req.params.id;
    IPSModel.findById(id)
        .exec()
        .then((ips) => {
            if (!ips) {
                return res.status(404).json({ message: "IPS record not found" });
            }

            // Constructing the JSON structure
            const bundle = {
                resourceType: "Bundle",
                id: ips.packageUUID, // First ID is the packageUUID
                type: "collection",
                total: 2 + (ips.medication.length * 2) + ips.allergies.length, // Total resources
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
                            gender: "Unknown",
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
                                id: uuidv4(), // Generate UUID for medication request ID
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
                ],
            };

            res.json(bundle);
        })
        .catch((err) => {
            res.status(400).send(err);
        });
}

module.exports = { getIPSLegacyBundle };
