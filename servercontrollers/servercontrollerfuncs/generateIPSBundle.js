const { v4: uuidv4 } = require('uuid');

// Helper function to check if a string contains a number
const containsNumber = (str) => /\d/.test(str);

function pruneNulls(value) {
    if (value === null || value === undefined) return undefined;

    // ✅ Strip empty or whitespace-only strings
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
    }

    // ✅ Preserve Date objects (convert to FHIR-friendly ISO string)
    if (value instanceof Date) {
        const t = value.getTime();
        return Number.isFinite(t) ? value.toISOString() : undefined;
    }

    if (Array.isArray(value)) {
        const arr = value
            .map(pruneNulls)
            .filter(v => v !== undefined);
        return arr.length ? arr : undefined;
    }

    if (typeof value === "object") {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            const pruned = pruneNulls(v);
            if (pruned !== undefined) out[k] = pruned;
        }
        return Object.keys(out).length ? out : undefined;
    }

    return value; // numbers, booleans
}

// ---------- Narrative helpers ----------
function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function narrativeEmptySentence(sentence, lang = "en-GB") {
    // Keep it simple: a single XHTML div (FHIR-compliant), with language tags
    const safe = escapeHtml(sentence);
    return `<div xmlns="http://www.w3.org/1999/xhtml" lang="${lang}" xml:lang="${lang}">${safe}</div>`;
}

// FHIR requires XHTML in a div with this xmlns
function xhtmlDiv(innerXhtml) {
    return `<div xmlns="http://www.w3.org/1999/xhtml">${innerXhtml}</div>`;
}

function narrativeFromRows(title, rows) {
    // rows: array of arrays (cells)
    const header = `<h3>${escapeHtml(title)}</h3>`;
    const table =
        `<table border="1" cellpadding="4" cellspacing="0">` +
        rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("") +
        `</table>`;
    return xhtmlDiv(header + table);
}

function narrativeFromList(title, items) {
    const header = `<h3>${escapeHtml(title)}</h3>`;
    const list = `<ul>${items.map(i => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
    return xhtmlDiv(header + list);
}

/**
 * options:
 *  - includeNarrative: boolean (default false) -> Composition.section[].text
 *  - includeResourceNarrative: boolean (default false) -> resource.text on entries too
 */
function generateIPSBundle(ipsRecord, options = {}) {
    const {
        includeNarrative = false,
        includeResourceNarrative = false,
    } = options;

    // Generate UUIDs
    const compositionUUID = uuidv4();
    const patientUUID = uuidv4();
    const practitionerUUID = uuidv4();
    const organizationUUID = uuidv4();

    // Get current date/time
    const currentDateTime = new Date().toISOString();

    // Construct Medication resources - Medication first as referenced by MedicationStatement
    const medications = ipsRecord.medication.map((med) => {
        const medicationUUID = uuidv4();

        const resource = {
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
        };

        if (includeResourceNarrative) {
            resource.text = {
                status: "generated",
                div: narrativeFromRows("Medication", [
                    ["Name", med.name],
                    ["System", med.system],
                    ["Code", med.code],
                ])
            };
        }

        return {
            "fullUrl": `urn:uuid:${medicationUUID}`,
            "resource": resource
        };
    });

    // Construct MedicationStatement resources
    const medicationStatements = medications.map((medication, index) => {
        const medicationStatementUUID = uuidv4();
        const med = ipsRecord.medication[index];

        const resource = {
            "resourceType": "MedicationStatement",
            "id": medicationStatementUUID,
            "status": med.status ? med.status : "active",
            "medicationReference": {
                "reference": `Medication/${medication.resource.id}`,
                "display": medication.resource.code.coding[0].display
            },
            "subject": {
                "reference": `Patient/${patientUUID}`
            },
            "effectivePeriod": {
                "start": med.date
            },
            "dosage": [
                {
                    "text": med.dosage
                }
            ]
        };

        if (includeResourceNarrative) {
            resource.text = {
                status: "generated",
                div: narrativeFromRows("Medication Statement", [
                    ["Medication", medication.resource.code.coding[0].display],
                    ["Start", med.date],
                    ["Dosage", med.dosage],
                ])
            };
        }

        return {
            "fullUrl": `urn:uuid:${medicationStatementUUID}`,
            "resource": resource
        };
    });

    // Construct AllergyIntolerance resources
    const allergyIntolerances = ipsRecord.allergies.map((allergy) => {
        const allergyIntoleranceUUID = uuidv4();

        const resource = {
            "resourceType": "AllergyIntolerance",
            "id": allergyIntoleranceUUID,
            "clinicalStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                        "code": "active",
                    }
                ]
            },
            "verificationStatus": {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                        "code": "confirmed",
                    }
                ]
            },
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
        };

        console.log("Constructed AllergyIntolerance resource:", JSON.stringify(resource, null, 2));

        if (includeResourceNarrative) {
            resource.text = {
                status: "generated",
                div: narrativeFromRows("Allergy / Intolerance", [
                    ["Substance", allergy.name],
                    ["Criticality", allergy.criticality],
                    ["Onset", allergy.date],
                ])
            };
        }

        return {
            "fullUrl": `urn:uuid:${allergyIntoleranceUUID}`,
            "resource": resource
        };
    });

    // Construct Condition resource
    const conditions = ipsRecord.conditions.map((condition) => {
        const conditionUUID = uuidv4();

        const resource = {
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
        };

        if (includeResourceNarrative) {
            resource.text = {
                status: "generated",
                div: narrativeFromRows("Condition", [
                    ["Condition", condition.name],
                    ["Onset", condition.date],
                ])
            };
        }

        return {
            "fullUrl": `urn:uuid:${conditionUUID}`,
            "resource": resource
        };
    });

    // Construct Observation resources
    const observations = ipsRecord.observations.map((observation) => {
        const observationUUID = uuidv4();

        let resource = {
            "resourceType": "Observation",
            "id": observationUUID,
            "status": observation.status ? observation.status : "final",
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
        };

        if (observation.value) {
            if (containsNumber(observation.value)) {
                // Check if the value is in the blood pressure format
                if (observation.value.includes('-')) {
                    if (observation.value.endsWith('mmHg') || observation.value.endsWith('mm[Hg]')) {
                        const cleaned = observation.value.replace('mmHg', '').replace('mm[Hg]', '');
                        const bpValues = cleaned.split('-').map(v => parseFloat(v.trim()));
                        resource.component = [
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
                        // Generic hyphenated numeric values (not BP)
                        const otherValues = observation.value.split('-').map(v => parseFloat(v.trim()));
                        const unit = observation.value.substring(observation.value.lastIndexOf(' ') + 1).trim();
                        resource.component = otherValues.map((value, index) => ({
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
                    const valueMatch = observation.value.match(/(\d+\.\d+)(\D+)/);
                    if (valueMatch) {
                        resource.valueQuantity = {
                            value: parseFloat(valueMatch[1]),
                            unit: valueMatch[2].trim(),
                            system: "http://unitsofmeasure.org",
                            code: valueMatch[2].trim()
                        };
                    }
                } else {
                    const valueMatch = observation.value.match(/(\d+)(\D+)/);
                    if (valueMatch) {
                        resource.valueQuantity = {
                            value: parseFloat(valueMatch[1]),
                            unit: valueMatch[2].trim(),
                            system: "http://unitsofmeasure.org",
                            code: valueMatch[2].trim()
                        };
                    }
                }
            } else {
                // Text value (temporary heuristic)
                resource.bodySite = {
                    coding: [
                        {
                            display: observation.value
                        }
                    ]
                };
            }

            if (observation.bodySite) {
                resource.bodySite = {
                    "coding": [
                        {
                            "display": observation.bodySite
                        }
                    ]
                };
            }
        }

        if (includeResourceNarrative) {
            const valueDisplay = observation.value ?? "";
            resource.text = {
                status: "generated",
                div: narrativeFromRows("Observation", [
                    ["Observation", observation.name],
                    ["Value", valueDisplay],
                    ["Date", observation.date],
                    ...(observation.bodySite ? [["Body site", observation.bodySite]] : []),
                ])
            };
        }

        return {
            "fullUrl": `urn:uuid:${observationUUID}`,
            "resource": resource
        };
    });

    // Construct Immunization resources
    const immunizations = ipsRecord.immunizations.map((immunization) => {
        const immunizationUUID = uuidv4();

        const resource = {
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
        };

        if (includeResourceNarrative) {
            resource.text = {
                status: "generated",
                div: narrativeFromRows("Immunization", [
                    ["Vaccine", immunization.name],
                    ["Date", immunization.date],
                ])
            };
        }

        return {
            "fullUrl": `urn:uuid:${immunizationUUID}`,
            "resource": resource
        };
    });

    // Construct Procedure resources
    const procedures = (ipsRecord.procedures ?? []).map((procedure) => {
        const procedureUUID = uuidv4();

        const resource = {
            resourceType: "Procedure",
            id: procedureUUID,
            status: procedure.status ? procedure.status : "completed",
            code: {
                coding: [
                    {
                        display: procedure.name,
                        system: procedure.system,
                        code: procedure.code
                    }
                ]
            },
            subject: {
                reference: `Patient/${patientUUID}`
            },
            performedDateTime: procedure.date
        };

        if (includeResourceNarrative) {
            resource.text = {
                status: "generated",
                div: narrativeFromRows("Procedure", [
                    ["Procedure", procedure.name],
                    ["Date", procedure.date],
                    ...(procedure.status ? [["Status", procedure.status]] : []),
                ])
            };
        }

        return {
            fullUrl: `urn:uuid:${procedureUUID}`,
            resource
        };
    });


    // Build narrative strings for Composition sections (optional)
    // ---------- Composition section builders ----------
    function makeSection({
        title,
        code,
        text,
        entryRefs,
        mandated = false,

        // empty handling
        emptyReasonCode = "nilknown",
        emptyReasonDisplay = "Nil Known",
        emptyReasonText = "No information available",

        // narrative for mandated-empty sections (only used if includeNarrative)
        emptyNarrativeSentence,
        narrativeLang = "en-GB",
    }) {
        const hasEntries = Array.isArray(entryRefs) && entryRefs.length > 0;

        if (!hasEntries && !mandated) return null;

        const section = {
            title,
            code,
            // Normal narrative text (when there are entries)
            ...(text ? { text } : {}),
            ...(hasEntries ? { entry: entryRefs.map(reference => ({ reference })) } : {}),
        };

        if (!hasEntries) {
            // If narrative requested but no entries, emit a generated XHTML sentence (examples you gave)
            if (!section.text && emptyNarrativeSentence) {
                section.text = {
                    status: "generated",
                    div: narrativeEmptySentence(emptyNarrativeSentence, narrativeLang)
                };
            }

            section.emptyReason = {
                coding: [{
                    system: "http://terminology.hl7.org/CodeSystem/list-empty-reason",
                    code: emptyReasonCode,
                    display: emptyReasonDisplay
                }],
                text: emptyReasonText
            };
        }

        return section;
    }

    // Build per-section entry references (only if resources exist)
    const medicationEntryRefs = medicationStatements.map(ms => `MedicationStatement/${ms.resource.id}`);
    const allergiesEntryRefs = allergyIntolerances.map(ai => `AllergyIntolerance/${ai.resource.id}`);
    const conditionsEntryRefs = conditions.map(c => `Condition/${c.resource.id}`);
    const observationsEntryRefs = observations.map(o => `Observation/${o.resource.id}`);
    const immunizationsEntryRefs = immunizations.map(i => `Immunization/${i.resource.id}`);
    const proceduresEntryRefs = procedures.map(p => `Procedure/${p.resource.id}`);

    // Only build narrative text if requested AND there is at least one entry
    const medicationSectionText = (includeNarrative && medicationEntryRefs.length)
        ? {
            status: "generated", div: narrativeFromList("Medication",
                ipsRecord.medication.map(m => `${m.name}${m.dosage ? ` — ${m.dosage}` : ""}${m.date ? ` (${m.date})` : ""}`)
            )
        }
        : undefined;

    const allergiesSectionText = (includeNarrative && allergiesEntryRefs.length)
        ? {
            status: "generated", div: narrativeFromList("Allergies and Intolerances",
                ipsRecord.allergies.map(a => `${a.name}${a.criticality ? ` — ${a.criticality}` : ""}${a.date ? ` (${a.date})` : ""}`)
            )
        }
        : undefined;

    const conditionsSectionText = (includeNarrative && conditionsEntryRefs.length)
        ? {
            status: "generated", div: narrativeFromList("Conditions",
                ipsRecord.conditions.map(c => `${c.name}${c.date ? ` (${c.date})` : ""}`)
            )
        }
        : undefined;

    const observationsSectionText = (includeNarrative && observationsEntryRefs.length)
        ? {
            status: "generated", div: narrativeFromRows("Observations",
                [
                    ["Name", "Value", "Date"],
                    ...ipsRecord.observations.map(o => [o.name, o.value ?? "", o.date])
                ]
            )
        }
        : undefined;

    const immunizationsSectionText = (includeNarrative && immunizationsEntryRefs.length)
        ? {
            status: "generated", div: narrativeFromList("Immunizations",
                ipsRecord.immunizations.map(i => `${i.name}${i.date ? ` (${i.date})` : ""}`)
            )
        }
        : undefined;

    const proceduresSectionText = (includeNarrative && proceduresEntryRefs.length)
        ? {
            status: "generated", div: narrativeFromList("Procedures",
                (ipsRecord.procedures ?? []).map(p => `${p.name}${p.date ? ` (${p.date})` : ""}`)
            )
        }
        : undefined;

    // Construct Composition resource
    const composition = {
        "fullUrl": `urn:uuid:${compositionUUID}`,
        "resource": {
            "resourceType": "Composition",
            "id": compositionUUID,
            "status": "final",
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
                makeSection({
                    title: "Medication",
                    code: {
                        coding: [{
                            system: "http://loinc.org",
                            code: "10160-0",
                            display: "History of Medication use Narrative"
                        }]
                    },
                    text: medicationSectionText,
                    entryRefs: medicationEntryRefs,
                    mandated: true,
                    emptyReasonCode: "nilknown",
                    emptyReasonText: "No known medications",
                    emptyNarrativeSentence: "There is no information available about the subject's medication use or administration."
                }),

                makeSection({
                    title: "Allergies and Intolerances",
                    code: {
                        coding: [{
                            system: "http://loinc.org",
                            code: "48765-2",
                            display: "Allergies and adverse reactions Document"
                        }]
                    },
                    text: allergiesSectionText,
                    entryRefs: allergiesEntryRefs,
                    mandated: true,
                    emptyReasonCode: "nilknown",
                    emptyReasonDisplay: "Nil known",
                    emptyReasonText: "No known allergies",
                    emptyNarrativeSentence: "There is no information available regarding the subject's allergy conditions."
                }),

                makeSection({
                    title: "Conditions",
                    code: {
                        coding: [{
                            system: "http://loinc.org",
                            code: "11450-4",
                            display: "Problem List - Reported"
                        }]
                    },
                    text: conditionsSectionText,
                    entryRefs: conditionsEntryRefs,
                    mandated: true,
                    emptyReasonCode: "nilknown",
                    emptyReasonText: "No known conditions",
                    emptyNarrativeSentence: "There is no information available about the subject's health problems or disabilities."
                }),

                makeSection({
                    title: "Observations",
                    code: {
                        coding: [{
                            system: "http://loinc.org",
                            code: "8716-3",
                            display: "Vital signs note"
                        }]
                    },
                    text: observationsSectionText,
                    entryRefs: observationsEntryRefs
                }),

                makeSection({
                    title: "Immunizations",
                    code: {
                        coding: [{
                            system: "http://loinc.org",
                            code: "11369-6",
                            display: "Immunization Activity"
                        }]
                    },
                    text: immunizationsSectionText,
                    entryRefs: immunizationsEntryRefs
                }),

                makeSection({
                    title: "History of Procedures",
                    code: {
                        coding: [{
                            system: "http://loinc.org",
                            code: "47519-4",
                            display: "History of Procedures Document"
                        }]
                    },
                    text: proceduresSectionText,
                    entryRefs: proceduresEntryRefs
                })
            ].filter(Boolean)
        }
    };

    // Construct bundle
    const ipsBundle = {
        "resourceType": "Bundle",
        "id": ipsRecord.packageUUID,
        "type": "document",
        "timestamp": ipsRecord.timeStamp.toISOString(),
        "entry": [
            composition,
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
                    ],
                    ...(includeResourceNarrative ? {
                        text: {
                            status: "generated",
                            div: narrativeFromRows("Patient", [
                                ["Name", `${ipsRecord.patient.given} ${ipsRecord.patient.name}`],
                                ["DOB", ipsRecord.patient.dob.toISOString().split('T')[0]],
                                ["Gender", ipsRecord.patient.gender],
                                ["Country", ipsRecord.patient.nation],
                            ])
                        }
                    } : {})
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
                    ],
                    ...(includeResourceNarrative ? {
                        text: {
                            status: "generated",
                            div: narrativeFromRows("Practitioner", [
                                ["Name", ipsRecord.patient.practitioner],
                            ])
                        }
                    } : {})
                }
            },
            {
                "fullUrl": `urn:uuid:${organizationUUID}`,
                "resource": {
                    "resourceType": "Organization",
                    "id": organizationUUID,
                    "name": ipsRecord.patient.organization ? ipsRecord.patient.organization : "Unknown",
                    ...(includeResourceNarrative ? {
                        text: {
                            status: "generated",
                            div: narrativeFromRows("Organization", [
                                ["Name", ipsRecord.patient.organization ? ipsRecord.patient.organization : "Unknown"],
                            ])
                        }
                    } : {})
                }
            },
            ...medicationStatements,
            ...medications,
            ...allergyIntolerances,
            ...conditions,
            ...observations,
            ...immunizations,
            ...procedures
        ]
    };

    return pruneNulls(ipsBundle);
}

module.exports = { generateIPSBundle };