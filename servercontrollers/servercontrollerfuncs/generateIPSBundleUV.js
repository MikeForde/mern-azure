// servercontrollers/servercontrollerfuncs/generateIPSBundleUV.js

const { v4: uuidv4, v5: uuidv5 } = require("uuid");

/*
 * Standalone HL7 UV IPS Bundle generator.
 *
 * This deliberately does NOT reuse the EPS generator.
 *
 * It produces a FHIR R4 document Bundle using the HL7 UV IPS profile family:
 *
 *   http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips
 *   http://hl7.org/fhir/uv/ips/StructureDefinition/Composition-uv-ips
 *   http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips
 *   etc.
 *
 * IDs are deterministic UUIDv5 values based on packageUUID where possible.
 * This matters for MedOrange because:
 *
 *   1. transaction fullUrl values remain valid urn:uuid values
 *   2. internal references are stable and resolvable
 *   3. delete can regenerate the same logical ids later
 */

const UV_UUID_NAMESPACE = "bff68f5f-e8f5-4637-973a-994a1e74c6b1";

const FHIR_ID_REGEX = /^[A-Za-z0-9\-.]{1,64}$/;

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanFhirId(value) {
    const id = String(value ?? "").trim();

    if (!id) return undefined;

    if (!FHIR_ID_REGEX.test(id)) {
        return undefined;
    }

    return id;
}

function idFromModelOrFallback(modelId, nextId, resourceType) {
    return cleanFhirId(modelId) || nextId(resourceType);
}

/**
 * Use urn:uuid only when the logical id is actually a UUID.
 *
 * If the stored id is non-UUID, such as "pt1", use a normal relative FHIR
 * reference. This keeps fullUrl and internal references identical.
 */
function makeFullUrl(resourceType, id) {
    if (UUID_REGEX.test(id)) {
        return `urn:uuid:${id}`;
    }

    return `${resourceType}/${id}`;
}

function makeReference(resourceType, id, display) {
    return pruneNulls({
        reference: makeFullUrl(resourceType, id),
        display,
    });
}

const IPS_PROFILE = {
    Bundle:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips",
    Composition:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/Composition-uv-ips",
    Patient:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips",
    Practitioner:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/Practitioner-uv-ips",
    PractitionerRole:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/PractitionerRole-uv-ips",
    Organization:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/Organization-uv-ips",
    Medication:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/Medication-uv-ips",
    MedicationStatement:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/MedicationStatement-uv-ips",
    AllergyIntolerance:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/AllergyIntolerance-uv-ips",
    Condition:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/Condition-uv-ips",
    ObservationLab:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/Observation-results-laboratory-pathology-uv-ips",
    ObservationVitalSigns:
        "http://hl7.org/fhir/StructureDefinition/vitalsigns",
    Immunization:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/Immunization-uv-ips",
    Procedure:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/Procedure-uv-ips",
    Device:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/Device-uv-ips",
    DeviceUseStatement:
        "http://hl7.org/fhir/uv/ips/StructureDefinition/DeviceUseStatement-uv-ips",
};

const SECTION_CODE = {
    medication: {
        system: "http://loinc.org",
        code: "10160-0",
        display: "History of Medication use Narrative",
    },
    allergies: {
        system: "http://loinc.org",
        code: "48765-2",
        display: "Allergies and adverse reactions Document",
    },
    problems: {
        system: "http://loinc.org",
        code: "11450-4",
        display: "Problem list - Reported",
    },
    procedures: {
        system: "http://loinc.org",
        code: "47519-4",
        display: "History of Procedures Document",
    },
    immunizations: {
        system: "http://loinc.org",
        code: "11369-6",
        display: "History of Immunization note",
    },
    results: {
        system: "http://loinc.org",
        code: "30954-2",
        display: "Relevant diagnostic tests/laboratory data note",
    },
    devices: {
        system: "http://loinc.org",
        code: "46264-8",
        display: "History of medical device use",
    },
    carePlan: {
        system: "http://loinc.org",
        code: "18776-5",
        display: "Plan of care note",
    },
};

function pruneNulls(value) {
    if (value === null || value === undefined) return undefined;

    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
    }

    if (Array.isArray(value)) {
        const arr = value.map(pruneNulls).filter((item) => item !== undefined);
        return arr.length ? arr : undefined;
    }

    if (typeof value === "object") {
        const out = {};

        for (const [key, item] of Object.entries(value)) {
            const pruned = pruneNulls(item);

            if (pruned !== undefined) {
                out[key] = pruned;
            }
        }

        return Object.keys(out).length ? out : undefined;
    }

    return value;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function narrativeDiv(innerHtml) {
    return `<div xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">${innerHtml}</div>`;
}

function narrativeParagraph(text) {
    return narrativeDiv(`<p>${escapeHtml(text)}</p>`);
}

function narrativeList(title, items) {
    const listItems = items.length
        ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
        : "<li>No information available</li>";

    return narrativeDiv(
        `<h3>${escapeHtml(title)}</h3><ul>${listItems}</ul>`
    );
}

function narrativeTable(title, rows) {
    const body = rows
        .map(
            (row) =>
                `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
        )
        .join("");

    return narrativeDiv(
        `<h3>${escapeHtml(title)}</h3><table border="1" cellpadding="4" cellspacing="0">${body}</table>`
    );
}

function asIsoDate(value) {
    if (!value) return undefined;

    if (value instanceof Date) {
        return value.toISOString().split("T")[0];
    }

    const s = String(value).trim();
    if (!s) return undefined;

    if (/^\d{4}$/.test(s)) return s;
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const d = new Date(s);

    if (!Number.isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
    }

    return s;
}

function asIsoDateTime(value) {
    if (!value) return undefined;

    if (value instanceof Date) {
        return value.toISOString();
    }

    const s = String(value).trim();
    if (!s) return undefined;

    const d = new Date(s);

    if (!Number.isNaN(d.getTime())) {
        return d.toISOString();
    }

    return s;
}

function stableId(seed, resourceType, index = 0) {
    return uuidv5(
        `${seed || "uv-ips"}|${resourceType}|${index}`,
        UV_UUID_NAMESPACE
    );
}

function makeIdFactory(seed) {
    const counters = {};

    return function nextId(resourceType) {
        const index = counters[resourceType] || 0;
        counters[resourceType] = index + 1;

        return stableId(seed, resourceType, index);
    };
}

function makeCoding(system, code, display) {
    return pruneNulls({
        system,
        code,
        display,
    });
}

function makeCodeableConcept(system, code, display, text) {
    const coding = makeCoding(system, code, display);

    return pruneNulls({
        coding: coding ? [coding] : undefined,
        text: text || display || code,
    });
}

function makeSectionCode(codeDef) {
    return {
        coding: [
            {
                system: codeDef.system,
                code: codeDef.code,
                display: codeDef.display,
            },
        ],
    };
}

function makeMeta(profile) {
    return {
        profile: [profile],
    };
}

function makeText(div) {
    return {
        status: "generated",
        div,
    };
}

function patientDisplay(ipsRecord) {
    return [
        ipsRecord?.patient?.given,
        ipsRecord?.patient?.name,
    ]
        .filter(Boolean)
        .join(" ")
        .trim();
}

function practitionerDisplay(ipsRecord) {
    return (
        ipsRecord?.patient?.practitioner ||
        [
            ipsRecord?.patient?.practitionerGiven,
            ipsRecord?.patient?.practitionerName,
        ]
            .filter(Boolean)
            .join(" ")
            .trim() ||
        "Unknown Practitioner"
    );
}

function organizationDisplay(ipsRecord) {
    return (
        ipsRecord?.patient?.organization ||
        ipsRecord?.patient?.nation ||
        "Unknown Organization"
    );
}

function getPatientIdentifiers(ipsRecord) {
    const patient = ipsRecord?.patient || {};

    if (Array.isArray(patient.identifier)) {
        return patient.identifier;
    }

    if (Array.isArray(patient.identifiers)) {
        return patient.identifiers;
    }

    const identifiers = [];

    if (patient.identifierValue || patient.identifier) {
        identifiers.push(
            pruneNulls({
                system:
                    patient.identifierSystem ||
                    "urn:ietf:rfc:9562",
                value: patient.identifierValue || patient.identifier,
            })
        );
    }

    if (ipsRecord.packageUUID) {
        identifiers.push({
            system: "urn:ietf:rfc:9562",
            value: ipsRecord.packageUUID,
        });
    }

    return identifiers.filter(Boolean);
}

function getCodeSystem(item, fallback = "http://snomed.info/sct") {
    return item?.system || fallback;
}

function getObservationCategory(observation) {
    const explicit = String(observation?.category || "").trim();

    if (explicit) {
        return explicit;
    }

    const name = String(observation?.name || "").toLowerCase();
    const code = String(observation?.code || "");

    const vitalCodes = new Set([
        "85354-9",
        "8480-6",
        "8462-4",
        "8867-4",
        "9279-1",
        "8310-5",
        "29463-7",
        "8302-2",
        "39156-5",
    ]);

    const vitalNames = [
        "blood pressure",
        "systolic",
        "diastolic",
        "heart rate",
        "pulse",
        "respiratory rate",
        "temperature",
        "body weight",
        "body height",
        "height",
        "weight",
        "bmi",
        "oxygen saturation",
    ];

    if (vitalCodes.has(code)) {
        return "vital-signs";
    }

    if (vitalNames.some((term) => name.includes(term))) {
        return "vital-signs";
    }

    return "laboratory";
}

function getObservationProfile(observation) {
    return getObservationCategory(observation) === "vital-signs"
        ? IPS_PROFILE.ObservationVitalSigns
        : IPS_PROFILE.ObservationLab;
}

function titleCase(value) {
    return String(value || "")
        .split(/[\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
}

function parseQuantity(value) {
    const s = String(value ?? "").trim();
    if (!s) return null;

    const match = s.match(/^(-?\d+(?:\.\d+)?)\s*([^\d\s].*)?$/);
    if (!match) return null;

    const numberValue = Number(match[1]);

    if (!Number.isFinite(numberValue)) {
        return null;
    }

    const unit = match[2]?.trim();

    return pruneNulls({
        value: numberValue,
        unit,
        system: unit ? "http://unitsofmeasure.org" : undefined,
        code: unit,
    });
}

function parseBloodPressure(value) {
    const s = String(value ?? "").trim();

    const match = s.match(
        /^(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)\s*(mmHg|mm\[Hg\])?$/i
    );

    if (!match) return null;

    return {
        systolic: Number(match[1]),
        diastolic: Number(match[2]),
    };
}

function parseDoseFromMedicationName(name) {
    const s = String(name ?? "");

    const match = s.match(
        /(\d+(?:\.\d+)?)\s*(mcg|µg|mg|g|ml|mL|iu|IU|units?)\b/
    );

    if (!match) return null;

    const value = Number(match[1]);

    if (!Number.isFinite(value)) {
        return null;
    }

    const unitRaw = match[2];
    const unit = unitRaw.toLowerCase();

    const map = {
        "µg": { unitText: "microgram", ucum: "ug" },
        mcg: { unitText: "microgram", ucum: "ug" },
        mg: { unitText: "milligram", ucum: "mg" },
        g: { unitText: "gram", ucum: "g" },
        ml: { unitText: "milliliter", ucum: "mL" },
        iu: { unitText: "international unit", ucum: "[IU]" },
        unit: { unitText: "unit", ucum: "{unit}" },
        units: { unitText: "unit", ucum: "{unit}" },
    };

    const hit = map[unit];

    if (!hit) return null;

    return {
        value,
        unit: hit.unitText,
        system: "http://unitsofmeasure.org",
        code: hit.ucum,
    };
}

function addResource(entries, resource) {
    entries.push({
        fullUrl: makeFullUrl(resource.resourceType, resource.id),
        resource: pruneNulls(resource),
    });

    return resource.id;
}

function makeEmptyReason(text) {
    return {
        coding: [
            {
                system: "http://terminology.hl7.org/CodeSystem/list-empty-reason",
                code: "nilknown",
                display: "Nil known",
            },
        ],
        text,
    };
}

function makeCompositionSection({
    title,
    code,
    entries,
    text,
    mandatory = false,
    emptyText,
}) {
    const hasEntries = entries.length > 0;

    if (!mandatory && !hasEntries) {
        return null;
    }

    const section = {
        title,
        code: makeSectionCode(code),
        text: makeText(
            text ||
            narrativeList(title, hasEntries ? entries.map((entry) => entry.display) : [emptyText])
        ),
    };

    if (hasEntries) {
        section.entry = entries.map((entry) => ({
            reference: entry.reference,
            ...(entry.display ? { display: entry.display } : {}),
        }));
    } else {
        section.emptyReason = makeEmptyReason(emptyText || "No information available");
    }

    return section;
}

function addPatient(entries, nextId, ipsRecord) {
    const id = idFromModelOrFallback(
        ipsRecord?.patient?.resourceId,
        nextId,
        "Patient"
    );
    const display = patientDisplay(ipsRecord);

    const patient = ipsRecord.patient || {};

    const resource = {
        resourceType: "Patient",
        id,
        meta: makeMeta(IPS_PROFILE.Patient),
        language: "en",
        text: makeText(
            narrativeTable("Patient", [
                ["Name", display],
                ["Date of birth", asIsoDate(patient.dob) || ""],
                ["Gender", patient.gender || ""],
                ["Country", patient.nation || ""],
            ])
        ),
        identifier: getPatientIdentifiers(ipsRecord),
        active: true,
        name: [
            pruneNulls({
                text: display,
                family: patient.name,
                given: patient.given ? [patient.given] : undefined,
            }),
        ],
        telecom: patient.phone
            ? [
                {
                    system: "phone",
                    value: patient.phone,
                    use: "home",
                },
            ]
            : undefined,
        gender: patient.gender,
        birthDate: asIsoDate(patient.dob),
        address: [
            pruneNulls({
                use: "home",
                type: "physical",
                line: patient.addressLine ? [patient.addressLine] : undefined,
                city: patient.city,
                postalCode: patient.postalCode,
                country: patient.nation,
            }),
        ],
    };

    addResource(entries, resource);

    return {
        id,
        reference: makeFullUrl("Patient", id),
        display,
    };
}

function addOrganization(entries, nextId, ipsRecord) {
    const id = idFromModelOrFallback(
        ipsRecord?.patient?.organizationResourceId,
        nextId,
        "Organization"
    );
    const display = organizationDisplay(ipsRecord);
    const patient = ipsRecord.patient || {};

    const resource = {
        resourceType: "Organization",
        id,
        meta: makeMeta(IPS_PROFILE.Organization),
        language: "en",
        text: makeText(
            narrativeTable("Organization", [
                ["Name", display],
                ["Country", patient.nation || ""],
            ])
        ),
        active: true,
        identifier: patient.organizationIdentifier
            ? [
                {
                    system:
                        patient.organizationIdentifierSystem ||
                        "urn:ietf:rfc:9562",
                    value: patient.organizationIdentifier,
                },
            ]
            : undefined,
        name: display,
        telecom: patient.organizationPhone
            ? [
                {
                    system: "phone",
                    value: patient.organizationPhone,
                    use: "work",
                },
            ]
            : undefined,
        address: [
            pruneNulls({
                use: "work",
                line: patient.organizationAddressLine
                    ? [patient.organizationAddressLine]
                    : undefined,
                city: patient.organizationCity || patient.city,
                postalCode: patient.organizationPostalCode || patient.postalCode,
                country: patient.organizationCountry || patient.nation,
            }),
        ],
    };

    addResource(entries, resource);

    return {
        id,
        reference: makeFullUrl("Organization", id),
        display,
    };
}

function addPractitioner(entries, nextId, ipsRecord) {
    const id = idFromModelOrFallback(
        ipsRecord?.patient?.practitionerResourceId,
        nextId,
        "Practitioner"
    );
    const display = practitionerDisplay(ipsRecord);
    const patient = ipsRecord.patient || {};

    const nameParts = display.split(/\s+/).filter(Boolean);
    const fallbackFamily =
        patient.practitionerName ||
        nameParts.slice(-1)[0] ||
        "Practitioner";

    const fallbackGiven =
        patient.practitionerGiven ||
        (nameParts.length > 1 ? nameParts[0] : undefined);

    const resource = {
        resourceType: "Practitioner",
        id,
        meta: makeMeta(IPS_PROFILE.Practitioner),
        language: "en",
        text: makeText(
            narrativeTable("Practitioner", [
                ["Name", display],
            ])
        ),
        active: true,
        identifier: patient.practitionerIdentifier
            ? [
                {
                    system:
                        patient.practitionerIdentifierSystem ||
                        "urn:ietf:rfc:9562",
                    value: patient.practitionerIdentifier,
                },
            ]
            : undefined,
        name: [
            pruneNulls({
                text: display,
                family: fallbackFamily,
                given: fallbackGiven ? [fallbackGiven] : undefined,
            }),
        ],
    };

    addResource(entries, resource);

    return {
        id,
        reference: makeFullUrl("Practitioner", id),
        display,
    };
}

function addMedications(entries, nextId, ipsRecord, patientRef) {
    const sectionEntries = [];

    for (const med of ipsRecord.medication || []) {
        const medicationId = idFromModelOrFallback(
            med.medicationResourceId,
            nextId,
            "Medication"
        );
        const statementId = idFromModelOrFallback(
            med.medicationStatementResourceId || med.medicationRequestResourceId,
            nextId,
            "MedicationStatement"
        );
        const dose = parseDoseFromMedicationName(med.name);

        const medication = {
            resourceType: "Medication",
            id: medicationId,
            meta: makeMeta(IPS_PROFILE.Medication),
            language: "en",
            text: makeText(
                narrativeTable("Medication", [
                    ["Name", med.name || ""],
                    ["Code", med.code || ""],
                ])
            ),
            code: makeCodeableConcept(
                getCodeSystem(med),
                med.code,
                med.name,
                med.name
            ),
        };

        addResource(entries, medication);

        const statement = {
            resourceType: "MedicationStatement",
            id: statementId,
            meta: makeMeta(IPS_PROFILE.MedicationStatement),
            language: "en",
            text: makeText(
                narrativeTable("Medication Statement", [
                    ["Medication", med.name || ""],
                    ["Status", med.status || "active"],
                    ["Date", asIsoDate(med.date) || ""],
                    ["Dosage", med.dosage || ""],
                ])
            ),
            status: med.status || "active",
            medicationReference: makeReference("Medication", medicationId, med.name),
            subject: {
                reference: patientRef.reference,
                display: patientRef.display,
            },
            effectivePeriod: med.date
                ? {
                    start: asIsoDate(med.date),
                }
                : undefined,
            dosage: [
                pruneNulls({
                    text: med.dosage,
                    doseAndRate: dose
                        ? [
                            {
                                doseQuantity: {
                                    value: dose.value,
                                    unit: dose.unit,
                                    system: dose.system,
                                    code: dose.code,
                                },
                            },
                        ]
                        : undefined,
                }),
            ],
        };

        addResource(entries, statement);

        sectionEntries.push({
            reference: makeFullUrl("MedicationStatement", statementId),
            display: med.name,
        });
    }

    return sectionEntries;
}

function addAllergies(entries, nextId, ipsRecord, patientRef) {
    const sectionEntries = [];

    for (const allergy of ipsRecord.allergies || []) {
        const id = idFromModelOrFallback(
            allergy.resourceId,
            nextId,
            "AllergyIntolerance"
        );

        const resource = {
            resourceType: "AllergyIntolerance",
            id,
            meta: makeMeta(IPS_PROFILE.AllergyIntolerance),
            language: "en",
            text: makeText(
                narrativeTable("Allergy / Intolerance", [
                    ["Substance", allergy.name || ""],
                    ["Criticality", allergy.criticality || ""],
                    ["Onset", asIsoDate(allergy.date) || ""],
                ])
            ),
            clinicalStatus: {
                coding: [
                    {
                        system:
                            "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                        code: allergy.status || "active",
                    },
                ],
            },
            verificationStatus: {
                coding: [
                    {
                        system:
                            "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                        code: allergy.verificationStatus || "confirmed",
                    },
                ],
            },
            type: allergy.type || "allergy",
            category: allergy.category ? [allergy.category] : undefined,
            criticality: allergy.criticality,
            code: makeCodeableConcept(
                getCodeSystem(allergy),
                allergy.code,
                allergy.name,
                allergy.name
            ),
            patient: {
                reference: patientRef.reference,
                display: patientRef.display,
            },
            onsetDateTime: asIsoDate(allergy.date),
        };

        addResource(entries, resource);

        sectionEntries.push({
            reference: makeFullUrl("AllergyIntolerance", id),
            display: allergy.name,
        });
    }

    return sectionEntries;
}

function addConditions(entries, nextId, ipsRecord, patientRef, practitionerRef) {
    const sectionEntries = [];

    for (const condition of ipsRecord.conditions || []) {
        const id = idFromModelOrFallback(
            condition.resourceId,
            nextId,
            "Condition"
        );

        const resource = {
            resourceType: "Condition",
            id,
            meta: makeMeta(IPS_PROFILE.Condition),
            language: "en",
            text: makeText(
                narrativeTable("Condition", [
                    ["Condition", condition.name || ""],
                    ["Status", condition.status || "active"],
                    ["Onset", asIsoDate(condition.date) || ""],
                ])
            ),
            clinicalStatus: {
                coding: [
                    {
                        system:
                            "http://terminology.hl7.org/CodeSystem/condition-clinical",
                        code: condition.status || "active",
                    },
                ],
            },
            verificationStatus: {
                coding: [
                    {
                        system:
                            "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                        code: condition.verificationStatus || "confirmed",
                    },
                ],
            },
            category: [
                {
                    coding: [
                        {
                            system: "http://loinc.org",
                            code: "75326-9",
                            display: "Problem",
                        },
                    ],
                },
            ],
            code: makeCodeableConcept(
                getCodeSystem(condition),
                condition.code,
                condition.name,
                condition.name
            ),
            subject: {
                reference: patientRef.reference,
                display: patientRef.display,
            },
            onsetDateTime: asIsoDate(condition.date),
            recordedDate: asIsoDate(condition.recordedDate),
            asserter: practitionerRef
                ? {
                    reference: practitionerRef.reference,
                    display: practitionerRef.display,
                }
                : undefined,
        };

        addResource(entries, resource);

        sectionEntries.push({
            reference: makeFullUrl("Condition", id),
            display: condition.name,
        });
    }

    return sectionEntries;
}

function addObservations(entries, nextId, ipsRecord, patientRef, organizationRef) {
    const sectionEntries = [];

    for (const observation of ipsRecord.observations || []) {
        const id = idFromModelOrFallback(
            observation.resourceId,
            nextId,
            "Observation"
        );
        const value = String(observation.value ?? "").trim();
        const bp = parseBloodPressure(value);
        const quantity = parseQuantity(value);
        const category = getObservationCategory(observation);

        const resource = {
            resourceType: "Observation",
            id,
            meta: makeMeta(getObservationProfile(observation)),
            language: "en",
            text: makeText(
                narrativeTable("Observation", [
                    ["Observation", observation.name || ""],
                    ["Value", value],
                    ["Date", asIsoDate(observation.date) || ""],
                ])
            ),
            status: observation.status || "final",
            category: [
                {
                    coding: [
                        {
                            system:
                                "http://terminology.hl7.org/CodeSystem/observation-category",
                            code: category,
                            display: titleCase(category),
                        },
                    ],
                },
            ],
            code: makeCodeableConcept(
                observation.system || "http://loinc.org",
                observation.code,
                observation.name,
                observation.name
            ),
            subject: {
                reference: patientRef.reference,
                display: patientRef.display,
            },
            effectiveDateTime:
                asIsoDateTime(observation.date) || asIsoDate(observation.date),
            performer: organizationRef
                ? [
                    {
                        reference: organizationRef.reference,
                        display: organizationRef.display,
                    },
                ]
                : undefined,
        };

        if (bp) {
            resource.component = [
                {
                    code: makeCodeableConcept(
                        "http://loinc.org",
                        "8480-6",
                        "Systolic blood pressure",
                        "Systolic blood pressure"
                    ),
                    valueQuantity: {
                        value: bp.systolic,
                        unit: "mm[Hg]",
                        system: "http://unitsofmeasure.org",
                        code: "mm[Hg]",
                    },
                },
                {
                    code: makeCodeableConcept(
                        "http://loinc.org",
                        "8462-4",
                        "Diastolic blood pressure",
                        "Diastolic blood pressure"
                    ),
                    valueQuantity: {
                        value: bp.diastolic,
                        unit: "mm[Hg]",
                        system: "http://unitsofmeasure.org",
                        code: "mm[Hg]",
                    },
                },
            ];
        } else if (quantity) {
            resource.valueQuantity = quantity;
        } else if (value) {
            resource.valueCodeableConcept = makeCodeableConcept(
                observation.valueSystem || observation.system,
                observation.valueCode,
                observation.valueDisplay || value,
                observation.valueText || value
            );
        }

        if (observation.interpretation) {
            resource.interpretation = [
                makeCodeableConcept(
                    observation.interpretationSystem ||
                    "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                    observation.interpretationCode || observation.interpretation,
                    observation.interpretationDisplay || observation.interpretation,
                    observation.interpretationDisplay || observation.interpretation
                ),
            ];
        }

        if (observation.note) {
            resource.note = [
                {
                    text: observation.note,
                },
            ];
        }

        addResource(entries, resource);

        sectionEntries.push({
            reference: makeFullUrl("Observation", id),
            display: observation.name,
        });
    }

    return sectionEntries;
}

function addImmunizations(entries, nextId, ipsRecord, patientRef) {
    const sectionEntries = [];

    for (const immunization of ipsRecord.immunizations || []) {
        const id = idFromModelOrFallback(
            immunization.resourceId,
            nextId,
            "Immunization"
        );

        const resource = {
            resourceType: "Immunization",
            id,
            meta: makeMeta(IPS_PROFILE.Immunization),
            language: "en",
            text: makeText(
                narrativeTable("Immunization", [
                    ["Vaccine", immunization.name || ""],
                    ["Date", asIsoDate(immunization.date) || ""],
                ])
            ),
            status: immunization.status || "completed",
            vaccineCode: makeCodeableConcept(
                getCodeSystem(immunization),
                immunization.code,
                immunization.name,
                immunization.name
            ),
            patient: {
                reference: patientRef.reference,
                display: patientRef.display,
            },
            occurrenceDateTime:
                asIsoDateTime(immunization.date) || asIsoDate(immunization.date),
            lotNumber: immunization.lotNumber,
            expirationDate: asIsoDate(immunization.expirationDate),
        };

        addResource(entries, resource);

        sectionEntries.push({
            reference: makeFullUrl("Immunization", id),
            display: immunization.name,
        });
    }

    return sectionEntries;
}

function addProcedures(entries, nextId, ipsRecord, patientRef, practitionerRef) {
    const sectionEntries = [];

    for (const procedure of ipsRecord.procedures || []) {
        const id = idFromModelOrFallback(
            procedure.resourceId,
            nextId,
            "Procedure"
        );

        const resource = {
            resourceType: "Procedure",
            id,
            meta: makeMeta(IPS_PROFILE.Procedure),
            language: "en",
            text: makeText(
                narrativeTable("Procedure", [
                    ["Procedure", procedure.name || ""],
                    ["Date", asIsoDate(procedure.date) || ""],
                ])
            ),
            status: procedure.status || "completed",
            code: makeCodeableConcept(
                getCodeSystem(procedure),
                procedure.code,
                procedure.name,
                procedure.name
            ),
            subject: {
                reference: patientRef.reference,
                display: patientRef.display,
            },
            performedDateTime:
                asIsoDateTime(procedure.date) || asIsoDate(procedure.date),
            performer: practitionerRef
                ? [
                    {
                        actor: {
                            reference: practitionerRef.reference,
                            display: practitionerRef.display,
                        },
                    },
                ]
                : undefined,
        };

        addResource(entries, resource);

        sectionEntries.push({
            reference: makeFullUrl("Procedure", id),
            display: procedure.name,
        });
    }

    return sectionEntries;
}

function addDevices(entries, nextId, ipsRecord, patientRef) {
    const sectionEntries = [];

    for (const device of ipsRecord.devices || []) {
        const deviceId = nextId("Device");
        const useId = nextId("DeviceUseStatement");

        const deviceResource = {
            resourceType: "Device",
            id: deviceId,
            meta: makeMeta(IPS_PROFILE.Device),
            language: "en",
            text: makeText(
                narrativeTable("Device", [
                    ["Device", device.name || ""],
                    ["Status", device.status || "active"],
                ])
            ),
            status: device.status || "active",
            type: makeCodeableConcept(
                getCodeSystem(device),
                device.code,
                device.name,
                device.name
            ),
            patient: {
                reference: patientRef.reference,
                display: patientRef.display,
            },
        };

        addResource(entries, deviceResource);

        const useResource = {
            resourceType: "DeviceUseStatement",
            id: useId,
            meta: makeMeta(IPS_PROFILE.DeviceUseStatement),
            language: "en",
            text: makeText(
                narrativeTable("Device Use", [
                    ["Device", device.name || ""],
                    ["Date", asIsoDate(device.date) || ""],
                ])
            ),
            status: device.useStatus || "active",
            subject: {
                reference: patientRef.reference,
                display: patientRef.display,
            },
            timingPeriod: device.date
                ? {
                    start: asIsoDate(device.date),
                }
                : undefined,
            device: makeReference("Device", deviceId, device.name),
        };

        addResource(entries, useResource);

        sectionEntries.push({
            reference: makeFullUrl("DeviceUseStatement", useId),
            display: device.name,
        });
    }

    return sectionEntries;
}

function addComposition({
    entries,
    nextId,
    ipsRecord,
    patientRef,
    practitionerRef,
    organizationRef,
    medicationSectionEntries,
    allergySectionEntries,
    conditionSectionEntries,
    observationSectionEntries,
    immunizationSectionEntries,
    procedureSectionEntries,
    deviceSectionEntries,
    now,
}) {
    const id = idFromModelOrFallback(
        ipsRecord?.compositionResourceId,
        nextId,
        "Composition"
    );

    const composition = {
        resourceType: "Composition",
        id,
        meta: makeMeta(IPS_PROFILE.Composition),
        language: "en",
        text: makeText(
            narrativeTable("International Patient Summary", [
                ["Patient", patientRef.display || ""],
                ["Date", now],
                ["Author", organizationRef.display || ""],
            ])
        ),
        identifier: {
            system: "urn:ietf:rfc:9562",
            value: stableId(ipsRecord.packageUUID || uuidv4(), "CompositionIdentifier"),
        },
        status: "final",
        type: {
            coding: [
                {
                    system: "http://loinc.org",
                    code: "60591-5",
                    display: "Patient summary Document",
                },
            ],
            text: "Patient summary Document",
        },
        subject: {
            reference: patientRef.reference,
            display: patientRef.display,
        },
        date: now,
        author: [
            {
                reference: organizationRef.reference,
                display: organizationRef.display,
            },
        ],
        title: `Patient Summary${patientRef.display ? ` - ${patientRef.display}` : ""}`,
        confidentiality: "N",
        attester: [
            {
                mode: "legal",
                time: now,
                party: {
                    reference: practitionerRef.reference,
                    display: practitionerRef.display,
                },
            },
        ],
        event: [
            {
                code: [
                    {
                        coding: [
                            {
                                system:
                                    "http://terminology.hl7.org/CodeSystem/v3-ActClass",
                                code: "PCPR",
                            },
                        ],
                    },
                ],
                period: {
                    end: now,
                },
            },
        ],
        section: [
            makeCompositionSection({
                title: "Medication",
                code: SECTION_CODE.medication,
                entries: medicationSectionEntries,
                mandatory: true,
                emptyText: "No known medications",
                text: narrativeList(
                    "Medication",
                    medicationSectionEntries.map((entry) => entry.display)
                ),
            }),
            makeCompositionSection({
                title: "Allergies and Intolerances",
                code: SECTION_CODE.allergies,
                entries: allergySectionEntries,
                mandatory: true,
                emptyText: "No known allergies or intolerances",
                text: narrativeList(
                    "Allergies and Intolerances",
                    allergySectionEntries.map((entry) => entry.display)
                ),
            }),
            makeCompositionSection({
                title: "Active Problems",
                code: SECTION_CODE.problems,
                entries: conditionSectionEntries,
                mandatory: true,
                emptyText: "No known problems",
                text: narrativeList(
                    "Active Problems",
                    conditionSectionEntries.map((entry) => entry.display)
                ),
            }),
            makeCompositionSection({
                title: "Results",
                code: SECTION_CODE.results,
                entries: observationSectionEntries,
                mandatory: false,
                emptyText: "No known results",
                text: narrativeList(
                    "Results",
                    observationSectionEntries.map((entry) => entry.display)
                ),
            }),
            makeCompositionSection({
                title: "Immunizations",
                code: SECTION_CODE.immunizations,
                entries: immunizationSectionEntries,
                mandatory: false,
                emptyText: "No known immunizations",
                text: narrativeList(
                    "Immunizations",
                    immunizationSectionEntries.map((entry) => entry.display)
                ),
            }),
            makeCompositionSection({
                title: "History of Procedures",
                code: SECTION_CODE.procedures,
                entries: procedureSectionEntries,
                mandatory: true,
                emptyText: "No known procedures",
                text: narrativeList(
                    "History of Procedures",
                    procedureSectionEntries.map((entry) => entry.display)
                ),
            }),
            makeCompositionSection({
                title: "Medical Devices",
                code: SECTION_CODE.devices,
                entries: deviceSectionEntries,
                mandatory: true,
                emptyText: "No known medical devices",
                text: narrativeList(
                    "Medical Devices",
                    deviceSectionEntries.map((entry) => entry.display)
                ),
            }),
            makeCompositionSection({
                title: "Plan of Treatment",
                code: SECTION_CODE.carePlan,
                entries: [],
                mandatory: false,
                emptyText: "No treatment plan recorded",
            }),
        ].filter(Boolean),
    };

    /*
     * FHIR document Bundle rule: Composition must be the first entry.
     */
    entries.unshift({
        fullUrl: makeFullUrl("Composition", id),
        resource: pruneNulls(composition),
    });

    return {
        id,
        reference: makeFullUrl("Composition", id),
        display: composition.title,
    };
}

function generateIPSBundleUV(ipsRecord, options = {}) {
    const seed =
        ipsRecord?.packageUUID ||
        ipsRecord?._id ||
        uuidv4();

    const nextId = makeIdFactory(seed);
    const entries = [];

    const now =
        asIsoDateTime(ipsRecord?.timeStamp) ||
        asIsoDateTime(options.timestamp) ||
        new Date().toISOString();

    const patientRef = addPatient(entries, nextId, ipsRecord);
    const organizationRef = addOrganization(entries, nextId, ipsRecord);
    const practitionerRef = addPractitioner(entries, nextId, ipsRecord);

    const medicationSectionEntries =
        addMedications(entries, nextId, ipsRecord, patientRef);

    const allergySectionEntries =
        addAllergies(entries, nextId, ipsRecord, patientRef);

    const conditionSectionEntries =
        addConditions(entries, nextId, ipsRecord, patientRef, practitionerRef);

    const observationSectionEntries =
        addObservations(entries, nextId, ipsRecord, patientRef, organizationRef);

    const immunizationSectionEntries =
        addImmunizations(entries, nextId, ipsRecord, patientRef);

    const procedureSectionEntries =
        addProcedures(entries, nextId, ipsRecord, patientRef, practitionerRef);

    const deviceSectionEntries =
        addDevices(entries, nextId, ipsRecord, patientRef);

    addComposition({
        entries,
        nextId,
        ipsRecord,
        patientRef,
        practitionerRef,
        organizationRef,
        medicationSectionEntries,
        allergySectionEntries,
        conditionSectionEntries,
        observationSectionEntries,
        immunizationSectionEntries,
        procedureSectionEntries,
        deviceSectionEntries,
        now,
    });

    const bundleId = stableId(seed, "Bundle");

    const bundle = {
        resourceType: "Bundle",
        id: bundleId,
        meta: makeMeta(IPS_PROFILE.Bundle),
        language: "en",
        identifier: {
            system: "urn:ietf:rfc:9562",
            value: ipsRecord?.packageUUID || bundleId,
        },
        type: "document",
        timestamp: now,
        entry: entries,
    };

    //Output the bundle with all null values pruned
    console.log("Generated IPS Bundle:", JSON.stringify(bundle, null, 2));

    return pruneNulls(bundle);
}

module.exports = {
    generateIPSBundleUV,
};