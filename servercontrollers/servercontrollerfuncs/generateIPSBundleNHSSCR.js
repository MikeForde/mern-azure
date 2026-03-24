const { v4: uuidv4 } = require("uuid");

// Helper function to check if a string contains a number
const containsNumber = (str) => /\d/.test(str);

function parseDoseFromMedicationName(name) {
  // e.g. "Paracetamol 500mg tablets" -> { value: 500, unitText: "milligram", ucum: "mg" }
  const s = String(name ?? "");
  const m = s.match(/(\d+(?:\.\d+)?)\s*(mcg|µg|mg|g|ml|mL|iu|IU|units?)\b/);
  if (!m) return null;

  const value = parseFloat(m[1]);
  if (!Number.isFinite(value)) return null;

  const rawUnit = m[2];
  const u = rawUnit.toLowerCase();

  const map = {
    "µg": { unitText: "microgram", ucum: "ug" },
    mcg: { unitText: "microgram", ucum: "ug" },
    mg: { unitText: "milligram", ucum: "mg" },
    g: { unitText: "gram", ucum: "g" },
    ml: { unitText: "milliliter", ucum: "mL" },
    ml: { unitText: "milliliter", ucum: "mL" }, // kept as-is (duplicate in your source)
    iu: { unitText: "international unit", ucum: "[IU]" },
    units: { unitText: "unit", ucum: "{unit}" },
    unit: { unitText: "unit", ucum: "{unit}" },
  };

  const hit = map[u] || map[u.replace(/s$/, "")];
  if (!hit) return null;

  return { value, ...hit };
}

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
    const arr = value.map(pruneNulls).filter((v) => v !== undefined);
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
  const safe = escapeHtml(sentence);
  return `<div xmlns="http://www.w3.org/1999/xhtml" lang="${lang}" xml:lang="${lang}">${safe}</div>`;
}

// FHIR requires XHTML in a div with this xmlns
function xhtmlDiv(innerXhtml) {
  return `<div xmlns="http://www.w3.org/1999/xhtml">${innerXhtml}</div>`;
}

function narrativeFromRows(title, rows) {
  const header = `<h3>${escapeHtml(title)}</h3>`;
  const table =
    `<table border="1" cellpadding="4" cellspacing="0">` +
    rows
      .map(
        (r) =>
          `<tr>${r
            .map((c) => `<td>${escapeHtml(c)}</td>`)
            .join("")}</tr>`
      )
      .join("") +
    `</table>`;
  return xhtmlDiv(header + table);
}

function narrativeFromList(title, items) {
  const header = `<h3>${escapeHtml(title)}</h3>`;
  const list = `<ul>${items
    .map((i) => `<li>${escapeHtml(i)}</li>`)
    .join("")}</ul>`;
  return xhtmlDiv(header + list);
}

// ---------- Composition section builder ----------
function makeSection({
  title,
  code,
  text,
  entryRefs,
  mandated = false,

  emptyReasonCode = "nilknown",
  emptyReasonDisplay = "Nil known",
  emptyReasonText = "No information available",

  emptyNarrativeSentence,
  narrativeLang = "en-GB",
}) {
  const hasEntries = Array.isArray(entryRefs) && entryRefs.length > 0;

  if (!hasEntries && !mandated) return null;

  const section = {
    title,
    code,
    ...(text ? { text } : {}),
    ...(hasEntries ? { entry: entryRefs.map((reference) => ({ reference })) } : {}),
  };

  if (!hasEntries) {
    if (!section.text && emptyNarrativeSentence) {
      section.text = {
        status: "generated",
        div: narrativeEmptySentence(emptyNarrativeSentence, narrativeLang),
      };
    }

    section.emptyReason = {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/list-empty-reason",
          code: emptyReasonCode,
          display: emptyReasonDisplay,
        },
      ],
      text: emptyReasonText,
    };
  }

  return section;
}

/**
 * options:
 *  - includeNarrative: boolean (default false) -> Composition.section[].text
 *  - includeResourceNarrative: boolean (default false) -> resource.text on entries too
 */
function generateIPSBundleNHSSCR(ipsRecord, options = {}) {
  const { includeNarrative = false, includeResourceNarrative = false } = options;

  // Generate UUIDs
  const compositionUUID = uuidv4();
  const patientUUID = uuidv4();
  const practitionerUUID = uuidv4();
  const organizationUUID = uuidv4();

  // Get current date/time
  const currentDateTime = new Date().toISOString();

  // Construct MedicationStatement resources (with contained Medication + contained source Organization)
  const medicationStatements = (ipsRecord.medication ?? []).map((med) => {
    const medicationStatementUUID = uuidv4();

    const dose = parseDoseFromMedicationName(med.name);

    const resource = {
      resourceType: "MedicationStatement",
      id: medicationStatementUUID,

      contained: [
        {
          resourceType: "Medication",
          id: "med",
          code: {
            coding: [
              {
                system: med.system,
                code: med.code,
                display: med.name,
              },
            ],
            text: med.name,
          },
        },
        {
          resourceType: "Organization",
          id: "source",
          identifier: ipsRecord.patient?.odsCode
            ? [
                {
                  system: "https://fhir.nhs.uk/Id/ods-organization-code",
                  value: ipsRecord.patient.odsCode,
                },
              ]
            : undefined,
          name: ipsRecord.patient?.organization || "Unknown",
        },
      ],

      identifier: [
        {
          system: "http://test-nhs-scr-ips.com/medicationstatement",
          value: uuidv4(),
        },
      ],

      status: med.status ? med.status : "active",

      category: {
        coding: [
          {
            system:
              "http://terminology.hl7.org/CodeSystem/medication-statement-category",
            code: "outpatient",
            display: "Outpatient",
          },
        ],
        text: "Outpatient",
      },

      medicationReference: { reference: "#med" },

      subject: { reference: `urn:uuid:${patientUUID}` },

      // NHS example uses effectiveDateTime (not effectivePeriod)
      effectiveDateTime: med.date,

      // NHS example includes dateAsserted
      dateAsserted: currentDateTime,

      // NHS example uses contained Organization as informationSource
      informationSource: { reference: "#source" },

      dosage: [
        {
          text: med.dosage,
          ...(dose
            ? {
                doseAndRate: [
                  {
                    doseQuantity: {
                      value: dose.value,
                      unit: dose.unitText,
                      system: "http://unitsofmeasure.org",
                      code: dose.ucum,
                    },
                  },
                ],
              }
            : {}),
        },
      ],
    };

    if (includeResourceNarrative) {
      resource.text = {
        status: "generated",
        div: narrativeFromRows("Medication Statement", [
          ["Medication", med.name],
          ["Category", "Outpatient"],
          ["Source", ipsRecord.patient?.organization || "Unknown"],
          ["Effective date", med.date],
          ["Asserted date", currentDateTime],
          ["Dosage", med.dosage],
          ...(dose ? [["Dose", `${dose.value} ${dose.unitText}`]] : []),
        ]),
      };
    }

    return {
      fullUrl: `urn:uuid:${medicationStatementUUID}`,
      resource,
    };
  });

  // Construct AllergyIntolerance resources
  const allergyIntolerances = (ipsRecord.allergies ?? []).map((allergy) => {
    const allergyIntoleranceUUID = uuidv4();

    const resource = {
      resourceType: "AllergyIntolerance",
      id: allergyIntoleranceUUID,
      identifier: [
        {
          system: "http://test-nhs-scr-ips.com/allergy",
          value: "71059e0b-f5bf-4edc-8426-be5c813d3b90",
        },
      ],
      clinicalStatus: {
        coding: [
          {
            system:
              "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
            code: "active",
            display: "Active",
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system:
              "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
            code: "confirmed",
            display: "Confirmed",
          },
        ],
      },
      code: {
        coding: [
          {
            display: allergy.name,
            system: allergy.system,
            code: allergy.code,
          },
        ],
        text: allergy.name,
      },
      patient: {
        reference: `urn:uuid:${patientUUID}`,
      },
      onsetDateTime: allergy.date,
    };

    if (includeResourceNarrative) {
      resource.text = {
        status: "generated",
        div: narrativeFromRows("Allergy / Intolerance", [
          ["Substance", allergy.name],
          ["Criticality", allergy.criticality],
          ["Onset", allergy.date],
        ]),
      };
    }

    return {
      fullUrl: `urn:uuid:${allergyIntoleranceUUID}`,
      resource,
    };
  });

  // Construct Condition resources
  const conditions = (ipsRecord.conditions ?? []).map((condition) => {
    const conditionUUID = uuidv4();

    const resource = {
      resourceType: "Condition",
      id: conditionUUID,
      identifier: [
        {
          system: "http://test-nhs-scr-ips.com/condition",
          value: "d72d7f08-e856-412e-a7ba-894a1ede5d82",
        },
      ],
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
            display: "Active",
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "problem-list-item",
              display: "Problem List Item",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            display: condition.name,
            system: condition.system,
            code: condition.code,
          },
        ],
        text: condition.name,
      },
      subject: {
        reference: `urn:uuid:${patientUUID}`,
      },
      onsetDateTime: condition.date,
    };

    if (includeResourceNarrative) {
      resource.text = {
        status: "generated",
        div: narrativeFromRows("Condition", [
          ["Condition", condition.name],
          ["Onset", condition.date],
        ]),
      };
    }

    return {
      fullUrl: `urn:uuid:${conditionUUID}`,
      resource,
    };
  });

  // Construct Observation resources
  const observations = (ipsRecord.observations ?? []).map((observation) => {
    const observationUUID = uuidv4();

    let resource = {
      resourceType: "Observation",
      id: observationUUID,
      status: observation.status ? observation.status : "final",
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
        reference: `urn:uuid:${patientUUID}`,
      },
      effectiveDateTime: observation.date,
    };

    if (observation.value) {
      if (containsNumber(observation.value)) {
        // Check if the value is in the blood pressure format
        if (observation.value.includes("-")) {
          if (
            observation.value.endsWith("mmHg") ||
            observation.value.endsWith("mm[Hg]")
          ) {
            const cleaned = observation.value
              .replace("mmHg", "")
              .replace("mm[Hg]", "");
            const bpValues = cleaned
              .split("-")
              .map((v) => parseFloat(v.trim()));
            resource.component = [
              {
                code: {
                  coding: [
                    {
                      system: "http://snomed.info/sct",
                      code: "271649006",
                      display: "Systolic blood pressure",
                    },
                  ],
                },
                valueQuantity: {
                  value: bpValues[0],
                  unit: "mm[Hg]",
                  system: "http://unitsofmeasure.org",
                  code: "mm[Hg]",
                },
              },
              {
                code: {
                  coding: [
                    {
                      system: "http://snomed.info/sct",
                      code: "271650006",
                      display: "Diastolic blood pressure",
                    },
                  ],
                },
                valueQuantity: {
                  value: bpValues[1],
                  unit: "mm[Hg]",
                  system: "http://unitsofmeasure.org",
                  code: "mm[Hg]",
                },
              },
            ];
          } else {
            // Generic hyphenated numeric values (not BP)
            const otherValues = observation.value
              .split("-")
              .map((v) => parseFloat(v.trim()));
            const unit = observation.value
              .substring(observation.value.lastIndexOf(" ") + 1)
              .trim();
            resource.component = otherValues.map((value, index) => ({
              code: { coding: [{ display: `Component ${index + 1}` }] },
              valueQuantity: {
                value,
                unit,
                system: "http://unitsofmeasure.org",
                code: unit,
              },
            }));
          }
        } else if (observation.value.includes(".")) {
          const valueMatch = observation.value.match(/(\d+\.\d+)(\D+)/);
          if (valueMatch) {
            resource.valueQuantity = {
              value: parseFloat(valueMatch[1]),
              unit: valueMatch[2].trim(),
              system: "http://unitsofmeasure.org",
              code: valueMatch[2].trim(),
            };
          }
        } else {
          const valueMatch = observation.value.match(/(\d+)(\D+)/);
          if (valueMatch) {
            resource.valueQuantity = {
              value: parseFloat(valueMatch[1]),
              unit: valueMatch[2].trim(),
              system: "http://unitsofmeasure.org",
              code: valueMatch[2].trim(),
            };
          }
        }
      } else {
        // Text value (temporary heuristic)
        resource.bodySite = { coding: [{ display: observation.value }] };
      }

      if (observation.bodySite) {
        resource.bodySite = {
          coding: [{ display: observation.bodySite }],
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
        ]),
      };
    }

    return {
      fullUrl: `urn:uuid:${observationUUID}`,
      resource,
    };
  });

  // Construct Immunization resources
  const immunizations = (ipsRecord.immunizations ?? []).map((immunization) => {
    const immunizationUUID = uuidv4();

    const manufacturerName =
      immunization.name.includes("(") && immunization.name.includes(")")
        ? immunization.name.substring(
            immunization.name.lastIndexOf("(") + 1,
            immunization.name.lastIndexOf(")")
          )
        : "Unknown Manufacturer";

    const resource = {
      resourceType: "Immunization",
      id: immunizationUUID,
      contained: [
        {
          resourceType: "Organization",
          id: "manufacturer",
          name: manufacturerName,
        },
      ],
      extension: [
        {
          url: "https://fhir.hl7.org.uk/StructureDefinition/Extension-UKCore-VaccinationProcedure",
          valueCodeableConcept: {
            coding: [
              {
                system: immunization.system,
                code: immunization.code,
                display: `Administration of first dose of ${immunization.name}`,
              },
            ],
            text: `Administration of first dose of ${immunization.name}`,
          },
        },
      ],
      identifier: [
        {
          system: "http://test-nhs-scr-ips.com/immunisation",
          value: "dcf651b9-8763-424a-bea0-b4c29416049b",
        },
      ],
      status: "completed",
      vaccineCode: {
        coding: [
          {
            display: immunization.name,
            system: immunization.system,
            code: immunization.code,
          },
        ],
      },
      patient: {
        reference: `urn:uuid:${patientUUID}`,
      },
      occurrenceDateTime: immunization.date,
      manufacturer: {
        reference: "#manufacturer",
      },
    };

    if (includeResourceNarrative) {
      resource.text = {
        status: "generated",
        div: narrativeFromRows("Immunization", [
          ["Vaccine", immunization.name],
          ["Date", immunization.date],
        ]),
      };
    }

    return {
      fullUrl: `urn:uuid:${immunizationUUID}`,
      resource,
    };
  });

  // Construct Procedure resources
  const procedures = (ipsRecord.procedures ?? []).map((procedure) => {
    const procedureUUID = uuidv4();

    const resource = {
      resourceType: "Procedure",
      id: procedureUUID,
      contained: [
        {
          resourceType: "Practitioner",
          id: "prac1",
          name: [{ text: "Dr Mike Forde" }],
        },
        {
          resourceType: "Organization",
          id: "org1",
          name: "ACME Hospital",
        },
      ],
      identifier: [
        {
          system: "http://test-nhs-scr-ips.com/procedure",
          value: "da7b221e-15a9-49e2-b9ab-1099c6b0e821",
        },
      ],
      status: procedure.status ? procedure.status : "completed",
      code: {
        coding: [
          {
            display: procedure.name,
            system: procedure.system,
            code: procedure.code,
          },
        ],
        text: procedure.name,
      },
      subject: {
        reference: `urn:uuid:${patientUUID}`,
      },
      performedDateTime: procedure.date,
      performer: [
        {
          actor: { reference: "#prac1" },
          onBehalfOf: { reference: "#org1" },
        },
      ],
    };

    if (includeResourceNarrative) {
      resource.text = {
        status: "generated",
        div: narrativeFromRows("Procedure", [
          ["Procedure", procedure.name],
          ["Date", procedure.date],
        ]),
      };
    }

    return {
      fullUrl: `urn:uuid:${procedureUUID}`,
      resource,
    };
  });

  // Build narrative strings for Composition (optional)
  const compositionText = includeNarrative
    ? {
        status: "generated",
        div: narrativeFromRows("Composition", [
          ["Title", `Shared Care Record Patient Summary as at ${currentDateTime}`],
          ["Document Type", "Patient summary Document"],
          ["Date", currentDateTime],
          ["Author", ipsRecord.patient.organization || "Unknown"],
        ]),
      }
    : undefined;

  // Build per-section entry references
  const medicationEntryRefs = medicationStatements.map(
    (ms) => `urn:uuid:${ms.resource.id}`
  );
  const allergiesEntryRefs = allergyIntolerances.map(
    (ai) => `urn:uuid:${ai.resource.id}`
  );
  const problemsEntryRefs = conditions.map((c) => `urn:uuid:${c.resource.id}`);
  const observationsEntryRefs = observations.map(
    (o) => `urn:uuid:${o.resource.id}`
  );
  const immunizationsEntryRefs = immunizations.map(
    (i) => `urn:uuid:${i.resource.id}`
  );
  const proceduresEntryRefs = procedures.map(
    (p) => `urn:uuid:${p.resource.id}`
  );

  // Only build section narrative text if requested AND there is at least one entry
  const medicationSectionText =
    includeNarrative && medicationEntryRefs.length
      ? {
          status: "generated",
          div: narrativeFromList(
            "Medication",
            (ipsRecord.medication ?? []).map(
              (m) =>
                `${m.name}${m.dosage ? ` — ${m.dosage}` : ""}${
                  m.date ? ` (${m.date})` : ""
                }`
            )
          ),
        }
      : undefined;

  const allergiesSectionText =
    includeNarrative && allergiesEntryRefs.length
      ? {
          status: "generated",
          div: narrativeFromList(
            "Allergies and Intolerances",
            (ipsRecord.allergies ?? []).map(
              (a) =>
                `${a.name}${a.criticality ? ` — ${a.criticality}` : ""}${
                  a.date ? ` (${a.date})` : ""
                }`
            )
          ),
        }
      : undefined;

  const conditionsSectionText =
    includeNarrative && problemsEntryRefs.length
      ? {
          status: "generated",
          div: narrativeFromList(
            "Conditions",
            (ipsRecord.conditions ?? []).map(
              (c) => `${c.name}${c.date ? ` (${c.date})` : ""}`
            )
          ),
        }
      : undefined;

  const observationsSectionText =
    includeNarrative && observationsEntryRefs.length
      ? {
          status: "generated",
          div: narrativeFromRows("Observations", [
            ["Name", "Value", "Date"],
            ...(ipsRecord.observations ?? []).map((o) => [
              o.name,
              o.value ?? "",
              o.date,
            ]),
          ]),
        }
      : undefined;

  const immunizationsSectionText =
    includeNarrative && immunizationsEntryRefs.length
      ? {
          status: "generated",
          div: narrativeFromList(
            "Immunizations",
            (ipsRecord.immunizations ?? []).map(
              (i) => `${i.name}${i.date ? ` (${i.date})` : ""}`
            )
          ),
        }
      : undefined;

  const proceduresSectionText =
    includeNarrative && proceduresEntryRefs.length
      ? {
          status: "generated",
          div: narrativeFromList(
            "Procedures",
            (ipsRecord.procedures ?? []).map(
              (p) => `${p.name}${p.date ? ` (${p.date})` : ""}`
            )
          ),
        }
      : undefined;

  // Construct Composition resource
  const composition = {
    fullUrl: `urn:uuid:${compositionUUID}`,
    resource: {
      resourceType: "Composition",
      id: compositionUUID,
      text: compositionText,
      identifier: {
        system: "http://test-nhs-scr-ips.com",
        value: "a8c03d4f-700d-4fdb-9011-73929cd56e56",
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
      },
      subject: { reference: `urn:uuid:${patientUUID}` },
      date: currentDateTime,
      author: [{ reference: `urn:uuid:${practitionerUUID}` }],
      title: `Shared Care Record Patient Summary as at ${currentDateTime}`,
      event: [
        {
          code: [
            {
              coding: [
                {
                  system:
                    "http://terminology.hl7.org/CodeSystem/v3-ActClass",
                  code: "PCPR",
                  display: "care provision",
                },
              ],
              text: "care provision",
            },
          ],
          period: { end: currentDateTime },
        },
      ],
      custodian: { reference: `urn:uuid:${organizationUUID}` },

      section: [
        makeSection({
          title: "Medication Summary",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "10160-0",
                display: "History of Medication use Narrative",
              },
            ],
          },
          text: medicationSectionText,
          entryRefs: medicationEntryRefs,
          mandated: true,
          emptyReasonCode: "nilknown",
          emptyReasonDisplay: "Nil known",
          emptyReasonText: "No known medications",
          emptyNarrativeSentence:
            "There is no information available about the subject's medication use or administration.",
        }),

        makeSection({
          title: "Allergies and Intolerances",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "48765-2",
                display: "Allergies and adverse reactions Document",
              },
            ],
          },
          text: allergiesSectionText,
          entryRefs: allergiesEntryRefs,
          mandated: true,
          emptyReasonCode: "nilknown",
          emptyReasonDisplay: "Nil known",
          emptyReasonText: "No known allergies",
          emptyNarrativeSentence:
            "There is no information available regarding the subject's allergy conditions.",
        }),

        makeSection({
          title: "Problems",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "11450-4",
                display: "Problem List - Reported",
              },
            ],
          },
          text: conditionsSectionText,
          entryRefs: problemsEntryRefs,
          mandated: true,
          emptyReasonCode: "nilknown",
          emptyReasonDisplay: "Nil known",
          emptyReasonText: "No known conditions",
          emptyNarrativeSentence:
            "There is no information available about the subject's health problems or disabilities.",
        }),

        makeSection({
          title: "Observations",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "8716-3",
                display:
                  "Vital signs note",
              },
            ],
          },
          text: observationsSectionText,
          entryRefs: observationsEntryRefs,
        }),

        makeSection({
          title: "Immunizations",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "11369-6",
                display: "Immunization Activity",
              },
            ],
          },
          text: immunizationsSectionText,
          entryRefs: immunizationsEntryRefs,
        }),

        makeSection({
          title: "Procedures",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "47519-4",
                display: "History of Procedures Narrative",
              },
            ],
          },
          text: proceduresSectionText,
          entryRefs: proceduresEntryRefs,
        }),
      ].filter(Boolean),
    },
  };

  // Construct bundle
  const ipsBundle = {
    resourceType: "Bundle",
    id: ipsRecord.packageUUID,
    identifier: {
      system: "http://test-nhs-scr-ips.com",
      value: "604d90a6-4683-4d0f-ac38-bafda31b56d8",
    },
    type: "document",
    timestamp: ipsRecord.timeStamp.toISOString(),
    entry: [
      composition,
      {
        fullUrl: `urn:uuid:${patientUUID}`,
        resource: {
          resourceType: "Patient",
          id: patientUUID,
          meta: {
            profile: [
              "https://fhir.hl7.org.uk/StructureDefinition/UKCore-Patient",
              "http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips",
            ],
          },
          identifier: [
            {
              extension: [
                {
                  url: "https://fhir.hl7.org.uk/StructureDefinition/Extension-UKCore-NHSNumberVerificationStatus",
                  valueCodeableConcept: {
                    coding: [
                      {
                        system:
                          "https://fhir.hl7.org.uk/CodeSystem/UKCore-NHSNumberVerificationStatusEngland",
                        code: "01",
                        display: "Number present and verified",
                      },
                    ],
                  },
                },
              ],
              system: "https://fhir.nhs.uk/Id/nhs-number",
              value: "1234567890",
            },
          ],
          name: [
            {
              family: ipsRecord.patient.name,
              given: [ipsRecord.patient.given],
              prefix:
                ipsRecord.patient.gender === "female"
                  ? ["Ms"]
                  : ipsRecord.patient.gender === "male"
                  ? ["Mr"]
                  : undefined,
            },
          ],
          gender: ipsRecord.patient.gender,
          birthDate: ipsRecord.patient.dob.toISOString().split("T")[0],
          address: [{ country: ipsRecord.patient.nation }],
          ...(includeResourceNarrative
            ? {
                text: {
                  status: "generated",
                  div: narrativeFromRows("Patient", [
                    [
                      "Name",
                      `${ipsRecord.patient.given} ${ipsRecord.patient.name}`,
                    ],
                    ["DOB", ipsRecord.patient.dob.toISOString().split("T")[0]],
                    ["Gender", ipsRecord.patient.gender],
                    ["Country", ipsRecord.patient.nation],
                  ]),
                },
              }
            : {}),
        },
      },
      {
        fullUrl: `urn:uuid:${practitionerUUID}`,
        resource: {
          resourceType: "Practitioner",
          id: practitionerUUID,
          name: [{ text: ipsRecord.patient.practitioner }],
          ...(includeResourceNarrative
            ? {
                text: {
                  status: "generated",
                  div: narrativeFromRows("Practitioner", [
                    ["Name", ipsRecord.patient.practitioner],
                  ]),
                },
              }
            : {}),
        },
      },
      {
        fullUrl: `urn:uuid:${organizationUUID}`,
        resource: {
          resourceType: "Organization",
          id: organizationUUID,
          name: ipsRecord.patient.organization
            ? ipsRecord.patient.organization
            : "Unknown",
          ...(includeResourceNarrative
            ? {
                text: {
                  status: "generated",
                  div: narrativeFromRows("Organization", [
                    [
                      "Name",
                      ipsRecord.patient.organization
                        ? ipsRecord.patient.organization
                        : "Unknown",
                    ],
                  ]),
                },
              }
            : {}),
        },
      },
      ...medicationStatements,
      ...allergyIntolerances,
      ...conditions,
      ...observations,
      ...immunizations,
      ...procedures,
    ],
  };

  return pruneNulls(ipsBundle);
}

module.exports = { generateIPSBundleNHSSCR };