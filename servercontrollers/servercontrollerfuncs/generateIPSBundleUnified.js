const { v4: uuidv4 } = require('uuid');
const { stripMilliseconds, stripTime } = require('../../utils/timeUtils');
//const { encryptPrimitiveField, underscoreFieldFor } = require('../../encryption/fhirFieldCrypt');
const { encryptPrimitiveFieldJWE, underscoreFieldForJWE } = require('../../encryption/jweFieldCrypt');
//const { system } = require('nodemon/lib/config');
//const { encryptPrimitiveFieldPW, underscoreFieldForPW } = require('../../encryption/pwFieldCrypt');


// Helper function to check if a string contains a number
const containsNumber = (str) => /\d/.test(str);

function generateIPSBundleUnified(ips) {

    const ptId = "pt1";

    var medcount = 0;
    var algcount = 0;
    var condcount = 0;
    var obscount = 0;
    var proccount = 0;

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
                            reference: "Medication/med" + medcount,
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
            // Procedure entries
            ...ips.procedures.map((procedure) => ({
                resource: {
                    resourceType: "Procedure",
                    id: "proc" + ++proccount,
                    status: procedure.status ? procedure.status.toLowerCase() : "completed",
                    code: {
                        coding: [
                            {
                                display: procedure.name,
                                system: procedure.system,
                                code: procedure.code,
                            },
                        ],
                    },
                    subject: {
                        reference: "Patient/" + ptId,
                    },
                    performedDateTime: stripMilliseconds(procedure.date),
                },
            })),
        ],
    };

    return ipsBundle;
}

// Async post-process: apply 'jwe' or 'omit'
async function protectIPSBundle(ipsBundle, protectMethod = "none") {
    if (!ipsBundle || protectMethod === "none") return ipsBundle;

    const patientEntry = ipsBundle.entry.find(e => e.resource?.resourceType === 'Patient');
    if (!patientEntry?.resource) return ipsBundle;
    const patient = patientEntry.resource;

    console.log(`Applying protection method: ${protectMethod}`);

    if (protectMethod === "jwe") {
        try {
            if (patient.identifier && Array.isArray(patient.identifier)) {
                if (patient.identifier[0]?.value) {
                    const enc0 = await encryptPrimitiveFieldJWE(patient.identifier[0].value, {
                        url: 'https://example.org/fhir/StructureDefinition/encrypted-nato-id',
                        recipients: [{ type: 'pbes2', password: 'patient phrase', p2c: 150000, kid: 'patient-pw' }],
                        enc: 'A256GCM',
                        aadUtf8: `Patient/${patient.id}#identifier[0].value`
                    });
                    patient.identifier[0].value = enc0.placeholder;
                    Object.assign(patient.identifier[0], underscoreFieldForJWE('value', enc0.extension));
                }
                if (patient.identifier[1]?.value) {
                    const enc1 = await encryptPrimitiveFieldJWE(patient.identifier[1].value, {
                        url: 'https://example.org/fhir/StructureDefinition/encrypted-national-id',
                        recipients: [{ type: 'pbes2', password: 'patient phrase', p2c: 150000, kid: 'patient-pw' }],
                        enc: 'A256GCM',
                        aadUtf8: `Patient/${patient.id}#identifier[1].value`
                    });
                    patient.identifier[1].value = enc1.placeholder;
                    Object.assign(patient.identifier[1], underscoreFieldForJWE('value', enc1.extension));
                }
            }
            // if (patient.identifier[0]?.value) {
            //     const enc0 = await encryptPrimitiveFieldPW(patient.identifier[0].value, {
            //         url: 'https://example.org/fhir/StructureDefinition/encrypted-nato-id',
            //         password: 'patient phrase',
            //         iter: 150000,
            //         aadUtf8: `Patient/${ptId}#identifier[0].value`,
            //     });
            //     patient.identifier[0].value = enc0.placeholder;
            //     Object.assign(patient.identifier[0], underscoreFieldForPW('value', enc0.extension));
            // }

            // if (patient.identifier[1]?.value) {
            //     const enc1 = await encryptPrimitiveFieldPW(patient.identifier[1].value, {
            //         url: 'https://example.org/fhir/StructureDefinition/encrypted-national-id',
            //         password: 'patient phrase',
            //         iter: 150000,
            //         aadUtf8: `Patient/${ptId}#identifier[1].value`,
            //     });
            //     patient.identifier[1].value = enc1.placeholder;
            //     Object.assign(patient.identifier[1], underscoreFieldForPW('value', enc1.extension));
            // }
        } catch (err) {
            const msg = err?.message || String(err);
            console.error('Field-level ID encryption skipped:', msg);
            if (patient?.identifier?.[0]) patient.identifier[0].encryptionError = msg;
        }
    }

    if (protectMethod === "omit") {
        if (patientEntry?.resource) {
            const { gender, birthDate } = patientEntry.resource; // preserve existing values
            patientEntry.resource = {
                resourceType: "Patient",
                id: patientEntry.resource.id,
                identifier: [{system: "omitted", value: "omitted"}],
                name: [{ family: "omitted", given: ["omitted"] }],
                gender,      // may be undefined if not present; that's fine
                birthDate,   // ditto
                address: [{ country: "omitted" }],
            };
        }
        // All other resources still reference Patient/pt1 — that remains valid.
    }

    console.log('Protection applied successfully.');

    return ipsBundle;
}

module.exports = { generateIPSBundleUnified, protectIPSBundle };