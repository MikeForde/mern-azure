const { v4: uuidv4 } = require("uuid");

// Helper function to check if a string contains a number
const containsNumber = (str) => /\d/.test(str);

function parseDoseFromMedicationName(name) {
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

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }

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

  return value;
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

function narrativeEmptySentence(sentence, lang = "en") {
  const safe = escapeHtml(sentence);
  return `<div xmlns="http://www.w3.org/1999/xhtml" lang="${lang}" xml:lang="${lang}">${safe}</div>`;
}

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
          `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`
      )
      .join("") +
    `</table>`;
  return xhtmlDiv(header + table);
}

function narrativeFromList(title, items) {
  const header = `<h3>${escapeHtml(title)}</h3>`;
  const list = `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
  return xhtmlDiv(header + list);
}

// ---------- Generic helpers ----------
function asIsoDate(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().split("T")[0];

  const s = String(value).trim();
  if (!s) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().split("T")[0];

  return s;
}

function asIsoDateTime(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();

  const s = String(value).trim();
  if (!s) return undefined;

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();

  return s;
}

function makeReference(uuid, display) {
  return {
    reference: `urn:uuid:${uuid}`,
    ...(display ? { display } : {}),
  };
}

function makeCodeableConcept(system, code, display, text) {
  return pruneNulls({
    coding: [
      pruneNulls({
        system,
        code,
        display,
      }),
    ],
    text: text ?? display,
  });
}

function titleCase(s) {
  if (!s) return s;
  return String(s)
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function inferGenderDisplay(gender) {
  const g = String(gender ?? "").toLowerCase();
  if (g === "male") return "Mr.";
  if (g === "female") return "Ms.";
  return undefined;
}

function inferObservationCategory(obs) {
  const cat = String(obs?.category ?? "").toLowerCase();
  if (cat) return cat;

  const name = String(obs?.name ?? "").toLowerCase();
  const code = String(obs?.code ?? "");

  const vitalHints = [
    "blood pressure",
    "heart rate",
    "respiratory rate",
    "body weight",
    "body height",
    "bmi",
    "pain",
    "pulse",
    "temperature",
  ];

  if (vitalHints.some((h) => name.includes(h))) return "vital-signs";

  if (["85354-9", "8867-4", "9279-1", "29463-7", "8302-2", "39156-5"].includes(code)) {
    return "vital-signs";
  }

  return "laboratory";
}

function inferObservationProfile(obs) {
  const cat = inferObservationCategory(obs);
  return cat === "vital-signs"
    ? "http://hl7.org/fhir/StructureDefinition/vitalsigns"
    : "http://hl7.eu/fhir/base/StructureDefinition/medicalTestResult-eu-core";
}

function parseObservationQuantity(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;

  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*(.+)$/);
  if (!m) return null;

  const num = parseFloat(m[1]);
  if (!Number.isFinite(num)) return null;

  const unit = m[2].trim();
  return {
    value: num,
    unit,
    system: "http://unitsofmeasure.org",
    code: unit,
  };
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
  narrativeLang = "en",
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
        status: "empty",
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
function generateIPSBundleEPS(ipsRecord, options = {}) {
  const { includeNarrative = false, includeResourceNarrative = false } = options;

  const bundleUUID = ipsRecord.packageUUID || `Instance-Bundle-${uuidv4()}`;
  const compositionUUID = uuidv4();
  const patientUUID = uuidv4();
  const practitionerUUID = uuidv4();
  const practitionerRoleUUID = uuidv4();
  const organizationUUID = uuidv4();

  const now = ipsRecord.timeStamp instanceof Date
    ? ipsRecord.timeStamp.toISOString()
    : asIsoDateTime(ipsRecord.timeStamp) || new Date().toISOString();

  const patientDisplay = [ipsRecord?.patient?.given, ipsRecord?.patient?.name].filter(Boolean).join(" ").trim() || undefined;
  const practitionerDisplay = ipsRecord?.patient?.practitioner || [ipsRecord?.patient?.practitionerGiven, ipsRecord?.patient?.practitionerName].filter(Boolean).join(" ").trim() || "Unknown Practitioner";
  const organizationDisplay = ipsRecord?.patient?.organization || "Unknown Organization";

  // ---- Medication + MedicationStatement ----
  const medicationEntries = (ipsRecord.medication ?? []).flatMap((med) => {
    const medicationUUID = uuidv4();
    const statementUUID = uuidv4();
    const dose = parseDoseFromMedicationName(med.name);

    const medicationResource = {
      resourceType: "Medication",
      id: medicationUUID,
      meta: {
        profile: ["http://hl7.eu/fhir/base/StructureDefinition/medication-eu-core"],
      },
      code: makeCodeableConcept(med.system, med.code, med.name, med.name),
      form: med.form
        ? makeCodeableConcept(med.formSystem || "http://snomed.info/sct", med.formCode, med.form, med.form)
        : undefined,
      ingredient: Array.isArray(med.ingredients)
        ? med.ingredients.map((ing) => ({
            itemCodeableConcept: makeCodeableConcept(
              ing.system || "http://snomed.info/sct",
              ing.code,
              ing.name,
              ing.name
            ),
            isActive: ing.isActive !== false,
          }))
        : undefined,
    };

    if (includeResourceNarrative) {
      medicationResource.text = {
        status: "generated",
        div: narrativeFromRows("Medication", [
          ["Medication", med.name],
          ...(med.form ? [["Form", med.form]] : []),
        ]),
      };
    }

    const statementResource = {
      resourceType: "MedicationStatement",
      id: statementUUID,
      meta: {
        profile: ["http://hl7.eu/fhir/eps/StructureDefinition/MedicationStatement-eu-eps"],
      },
      status: med.status || "active",
      medicationReference: makeReference(medicationUUID, med.name),
      subject: makeReference(patientUUID, patientDisplay),
      effectivePeriod: {
        start: asIsoDate(med.date),
      },
      reasonCode: med.reason
        ? [
            makeCodeableConcept(
              med.reasonSystem || "http://snomed.info/sct",
              med.reasonCode,
              med.reason,
              med.reason
            ),
          ]
        : undefined,
      dosage: [
        pruneNulls({
          text: med.dosage,
          ...(dose
            ? {
                doseAndRate: [
                  {
                    doseQuantity: {
                      value: dose.value,
                      unit: dose.ucum === "ug" ? "microgram" : dose.unitText,
                      system: "http://unitsofmeasure.org",
                      code: dose.ucum,
                    },
                  },
                ],
              }
            : {}),
        }),
      ],
    };

    if (includeResourceNarrative) {
      statementResource.text = {
        status: "generated",
        div: narrativeFromRows("Medication Statement", [
          ["Medication", med.name],
          ...(med.date ? [["Since", asIsoDate(med.date)]] : []),
          ...(med.form ? [["Form", med.form]] : []),
          ...(med.dosage ? [["Dosage", med.dosage]] : []),
          ...(med.reason ? [["Reason", med.reason]] : []),
        ]),
      };
    }

    return [
      { fullUrl: `urn:uuid:${medicationUUID}`, resource: medicationResource },
      { fullUrl: `urn:uuid:${statementUUID}`, resource: statementResource },
    ];
  });

  const medicationStatementEntries = medicationEntries.filter(
    (e) => e.resource?.resourceType === "MedicationStatement"
  );

  // ---- AllergyIntolerance ----
  const allergyEntries = (ipsRecord.allergies ?? []).map((allergy) => {
    const allergyUUID = uuidv4();

    const resource = {
      resourceType: "AllergyIntolerance",
      id: allergyUUID,
      meta: {
        profile: ["http://hl7.eu/fhir/base/StructureDefinition/allergyIntolerance-eu-core"],
      },
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
            code: allergy.status || "active",
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
            code: allergy.verificationStatus || "confirmed",
          },
        ],
      },
      type: allergy.type || "allergy",
      category: allergy.category
        ? [allergy.category]
        : allergy.isMedication === true
          ? ["medication"]
          : undefined,
      code: makeCodeableConcept(allergy.system, allergy.code, allergy.name, allergy.name),
      patient: makeReference(patientUUID, patientDisplay),
      onsetDateTime: asIsoDate(allergy.date) || asIsoDateTime(allergy.date),
    };

    if (includeResourceNarrative) {
      resource.text = {
        status: "generated",
        div: narrativeFromRows("Allergy / Intolerance", [
          ["Substance", allergy.name],
          ...(allergy.date ? [["Onset", asIsoDate(allergy.date) || asIsoDateTime(allergy.date)]] : []),
          ...(allergy.category ? [["Type", allergy.category]] : []),
        ]),
      };
    }

    return { fullUrl: `urn:uuid:${allergyUUID}`, resource };
  });

  // ---- Condition ----
  const conditionEntries = (ipsRecord.conditions ?? []).map((condition) => {
    const conditionUUID = uuidv4();

    const resource = {
      resourceType: "Condition",
      id: conditionUUID,
      meta: {
        profile: ["http://hl7.eu/fhir/base/StructureDefinition/condition-eu-core"],
      },
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: condition.status || "active",
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: "problem-list-item",
              display: "Problem List Item",
            },
          ],
        },
      ],
      code: makeCodeableConcept(condition.system, condition.code, condition.name, condition.name),
      subject: makeReference(patientUUID, patientDisplay),
      onsetDateTime: asIsoDate(condition.date) || asIsoDateTime(condition.date),
      asserter: practitionerUUID ? makeReference(practitionerUUID, practitionerDisplay) : undefined,
    };

    if (includeResourceNarrative) {
      resource.text = {
        status: "generated",
        div: narrativeFromRows("Condition", [
          ["Condition", condition.name],
          ...(condition.date ? [["Onset", asIsoDate(condition.date) || asIsoDateTime(condition.date)]] : []),
          ["Status", condition.status || "active"],
        ]),
      };
    }

    return { fullUrl: `urn:uuid:${conditionUUID}`, resource };
  });

  // ---- Observation ----
  const observationEntries = (ipsRecord.observations ?? []).map((observation) => {
    const observationUUID = uuidv4();
    const obsValue = String(observation.value ?? "").trim();

    const resource = {
      resourceType: "Observation",
      id: observationUUID,
      meta: {
        profile: [inferObservationProfile(observation)],
      },
      status: observation.status || "final",
      category: [
        {
          coding: [
            pruneNulls({
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: inferObservationCategory(observation),
              display: titleCase(inferObservationCategory(observation).replace("-", " ")),
            }),
          ],
        },
      ],
      code: makeCodeableConcept(observation.system, observation.code, observation.name, observation.name),
      subject: makeReference(patientUUID, patientDisplay),
      effectiveDateTime: asIsoDate(observation.date) || asIsoDateTime(observation.date),
    };

    if (obsValue && containsNumber(obsValue)) {
      const bpMatch = obsValue.match(/^\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(mmHg|mm\[Hg\])\s*$/i);
      if (bpMatch) {
        resource.component = [
          {
            code: makeCodeableConcept("http://loinc.org", "8480-6", "Systolic Blood Pressure", "Systolic Blood Pressure"),
            valueQuantity: {
              value: parseFloat(bpMatch[1]),
              unit: "mm[Hg]",
              system: "http://unitsofmeasure.org",
              code: "mm[Hg]",
            },
          },
          {
            code: makeCodeableConcept("http://loinc.org", "8462-4", "Diastolic Blood Pressure", "Diastolic Blood Pressure"),
            valueQuantity: {
              value: parseFloat(bpMatch[2]),
              unit: "mm[Hg]",
              system: "http://unitsofmeasure.org",
              code: "mm[Hg]",
            },
          },
        ];
      } else {
        const q = parseObservationQuantity(obsValue);
        if (q) resource.valueQuantity = q;
      }
    }

    if (observation.performer) {
      resource.performer = [{ display: observation.performer }];
    }

    if (observation.interpretation) {
      resource.interpretation = [
        makeCodeableConcept(
          observation.interpretationSystem || "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
          observation.interpretationCode || observation.interpretation,
          observation.interpretationDisplay || observation.interpretation,
          observation.interpretationDisplay || observation.interpretation
        ),
      ];
    }

    if (observation.referenceLow || observation.referenceHigh) {
      resource.referenceRange = [
        pruneNulls({
          low: observation.referenceLow
            ? {
                value: parseFloat(observation.referenceLow),
                system: "http://unitsofmeasure.org",
                code: observation.referenceUnit || resource.valueQuantity?.code,
              }
            : undefined,
          high: observation.referenceHigh
            ? {
                value: parseFloat(observation.referenceHigh),
                system: "http://unitsofmeasure.org",
                code: observation.referenceUnit || resource.valueQuantity?.code,
              }
            : undefined,
        }),
      ];
    }

    if (includeResourceNarrative) {
      resource.text = {
        status: "generated",
        div: resource.component
          ? narrativeFromRows("Observation", [
              ["Observation", observation.name],
              ["Value", obsValue],
              ...(observation.date ? [["Date", asIsoDate(observation.date) || asIsoDateTime(observation.date)]] : []),
            ])
          : narrativeFromRows("Observation", [
              ["Observation", observation.name],
              ["Value", obsValue],
              ...(observation.date ? [["Date", asIsoDate(observation.date) || asIsoDateTime(observation.date)]] : []),
            ]),
      };
    }

    return { fullUrl: `urn:uuid:${observationUUID}`, resource };
  });

  // ---- Immunization ----
  const immunizationEntries = (ipsRecord.immunizations ?? []).map((immunization) => {
    const immunizationUUID = uuidv4();

    const resource = {
      resourceType: "Immunization",
      id: immunizationUUID,
      meta: {
        profile: ["http://hl7.eu/fhir/base/StructureDefinition/immunization-eu-core"],
      },
      status: immunization.status || "completed",
      vaccineCode: pruneNulls({
        coding: [
          pruneNulls({
            system: immunization.system,
            code: immunization.code,
            display: immunization.name,
          }),
          ...(immunization.altSystem && immunization.altCode
            ? [
                pruneNulls({
                  system: immunization.altSystem,
                  code: immunization.altCode,
                  display: immunization.altDisplay,
                }),
              ]
            : []),
        ],
        text: immunization.name,
      }),
      patient: makeReference(patientUUID, patientDisplay),
      occurrenceDateTime: asIsoDate(immunization.date) || asIsoDateTime(immunization.date),
      lotNumber: immunization.lotNumber,
      expirationDate: asIsoDate(immunization.expirationDate),
      site: immunization.site
        ? makeCodeableConcept(
            immunization.siteSystem || "http://snomed.info/sct",
            immunization.siteCode,
            immunization.site,
            immunization.site
          )
        : undefined,
      route: immunization.route
        ? makeCodeableConcept(
            immunization.routeSystem || "http://snomed.info/sct",
            immunization.routeCode,
            immunization.route,
            immunization.route
          )
        : undefined,
    };

    if (includeResourceNarrative) {
      resource.text = {
        status: "generated",
        div: narrativeFromRows("Immunization", [
          ["Vaccine", immunization.name],
          ...(immunization.date ? [["Date", asIsoDate(immunization.date) || asIsoDateTime(immunization.date)]] : []),
        ]),
      };
    }

    return { fullUrl: `urn:uuid:${immunizationUUID}`, resource };
  });

  // ---- Procedure ----
  const procedureEntries = (ipsRecord.procedures ?? []).map((procedure) => {
    const procedureUUID = uuidv4();

    const resource = {
      resourceType: "Procedure",
      id: procedureUUID,
      meta: {
        profile: ["http://hl7.eu/fhir/base/StructureDefinition/procedure-eu-core"],
      },
      status: procedure.status || "completed",
      code: makeCodeableConcept(procedure.system, procedure.code, procedure.name, procedure.name),
      subject: makeReference(patientUUID, patientDisplay),
      performedDateTime: asIsoDate(procedure.date) || asIsoDateTime(procedure.date),
      performer: [
        pruneNulls({
          actor: makeReference(practitionerUUID, practitionerDisplay),
          onBehalfOf: makeReference(organizationUUID, organizationDisplay),
        }),
      ],
      reasonCode: procedure.reason
        ? [
            makeCodeableConcept(
              procedure.reasonSystem || "http://snomed.info/sct",
              procedure.reasonCode,
              procedure.reason,
              procedure.reason
            ),
          ]
        : undefined,
      bodySite: procedure.bodySite
        ? [
            makeCodeableConcept(
              procedure.bodySiteSystem || "http://snomed.info/sct",
              procedure.bodySiteCode,
              procedure.bodySite,
              procedure.bodySite
            ),
          ]
        : undefined,
      outcome: procedure.outcome
        ? makeCodeableConcept(
            procedure.outcomeSystem || "http://snomed.info/sct",
            procedure.outcomeCode,
            procedure.outcome,
            procedure.outcome
          )
        : undefined,
    };

    if (includeResourceNarrative) {
      resource.text = {
        status: "generated",
        div: narrativeFromRows("Procedure", [
          ["Procedure", procedure.name],
          ...(procedure.date ? [["Date", asIsoDate(procedure.date) || asIsoDateTime(procedure.date)]] : []),
        ]),
      };
    }

    return { fullUrl: `urn:uuid:${procedureUUID}`, resource };
  });

  // ---- Devices + DeviceUseStatement ----
  const deviceEntries = (ipsRecord.devices ?? []).flatMap((device) => {
    const deviceUUID = uuidv4();
    const useUUID = uuidv4();

    const deviceResource = {
      resourceType: "Device",
      id: deviceUUID,
      meta: {
        profile: ["http://hl7.eu/fhir/eps/StructureDefinition/device-eu-eps"],
      },
      udiCarrier: device.udi
        ? [
            {
              id: device.udi,
            },
          ]
        : undefined,
      status: device.status || "active",
      type: makeCodeableConcept(device.system, device.code, device.name, device.name),
      patient: makeReference(patientUUID, patientDisplay),
    };

    if (includeResourceNarrative) {
      deviceResource.text = {
        status: "generated",
        div: narrativeFromRows("Device", [
          ["Device", device.name],
          ["Status", device.status || "active"],
        ]),
      };
    }

    const useResource = {
      resourceType: "DeviceUseStatement",
      id: useUUID,
      meta: {
        profile: ["http://hl7.eu/fhir/eps/StructureDefinition/deviceUseStatement-eu-eps"],
      },
      status: device.useStatus || "active",
      subject: makeReference(patientUUID, patientDisplay),
      timingPeriod: {
        start: asIsoDate(device.date) || asIsoDateTime(device.date),
      },
      device: makeReference(deviceUUID, device.name),
    };

    if (includeResourceNarrative) {
      useResource.text = {
        status: "generated",
        div: narrativeFromRows("Device Use", [
          ["Device", device.name],
          ...(device.date ? [["Since", asIsoDate(device.date) || asIsoDateTime(device.date)]] : []),
        ]),
      };
    }

    return [
      { fullUrl: `urn:uuid:${deviceUUID}`, resource: deviceResource },
      { fullUrl: `urn:uuid:${useUUID}`, resource: useResource },
    ];
  });

  const deviceUseEntries = deviceEntries.filter(
    (e) => e.resource?.resourceType === "DeviceUseStatement"
  );

  // ---- CarePlan ----
  const carePlanEntries = (ipsRecord.carePlans ?? []).map((plan) => {
    const carePlanUUID = uuidv4();

    const resource = {
      resourceType: "CarePlan",
      id: carePlanUUID,
      status: plan.status || "active",
      intent: plan.intent || "plan",
      category: [
        makeCodeableConcept(
          plan.categorySystem || "http://snomed.info/sct",
          plan.categoryCode || "734163000",
          plan.category || "Care plan",
          plan.category || "Care plan"
        ),
      ],
      subject: makeReference(patientUUID, patientDisplay),
      period: {
        start: asIsoDate(plan.date) || asIsoDateTime(plan.date),
      },
      activity: [
        {
          detail: pruneNulls({
            kind: plan.kind || "Appointment",
            code: makeCodeableConcept(
              plan.system,
              plan.code,
              plan.name,
              plan.name
            ),
            reasonCode: plan.reason
              ? [
                  makeCodeableConcept(
                    plan.reasonSystem || "http://snomed.info/sct",
                    plan.reasonCode,
                    plan.reason,
                    plan.reason
                  ),
                ]
              : undefined,
            status: plan.activityStatus || "unknown",
            description: plan.name,
          }),
        },
      ],
    };

    if (includeResourceNarrative) {
      resource.text = {
        status: "generated",
        div: narrativeFromRows("Care Plan", [
          ["Plan", plan.name],
          ...(plan.date ? [["Start", asIsoDate(plan.date) || asIsoDateTime(plan.date)]] : []),
          ...(plan.reason ? [["Reason", plan.reason]] : []),
        ]),
      };
    }

    return { fullUrl: `urn:uuid:${carePlanUUID}`, resource };
  });

  // ---- Composition section refs ----
  const medicationSectionEntryRefs = medicationStatementEntries.map((e) => `urn:uuid:${e.resource.id}`);
  const allergySectionEntryRefs = allergyEntries.map((e) => `urn:uuid:${e.resource.id}`);
  const problemSectionEntryRefs = conditionEntries.map((e) => `urn:uuid:${e.resource.id}`);
  const procedureSectionEntryRefs = procedureEntries.map((e) => `urn:uuid:${e.resource.id}`);
  const deviceSectionEntryRefs = deviceUseEntries.map((e) => `urn:uuid:${e.resource.id}`);

  const immunizationSectionEntryRefs = immunizationEntries.map((e) => `urn:uuid:${e.resource.id}`);
  const observationSectionEntryRefs = observationEntries.map((e) => `urn:uuid:${e.resource.id}`);
  const carePlanSectionEntryRefs = carePlanEntries.map((e) => `urn:uuid:${e.resource.id}`);

  const medicationSectionText =
    includeNarrative && medicationSectionEntryRefs.length
      ? {
          status: "generated",
          div: narrativeFromList(
            "Medication list",
            (ipsRecord.medication ?? []).map(
              (m) => `${m.name}${m.dosage ? ` — ${m.dosage}` : ""}${m.reason ? ` — ${m.reason}` : ""}`
            )
          ),
        }
      : undefined;

  const allergySectionText =
    includeNarrative && allergySectionEntryRefs.length
      ? {
          status: "generated",
          div: narrativeFromList(
            "Allergies and Intolerances",
            (ipsRecord.allergies ?? []).map((a) => a.name)
          ),
        }
      : undefined;

  const problemSectionText =
    includeNarrative && problemSectionEntryRefs.length
      ? {
          status: "generated",
          div: narrativeFromList(
            "Problem list",
            (ipsRecord.conditions ?? []).map((c) => `${c.name}${c.date ? ` (${asIsoDate(c.date) || asIsoDateTime(c.date)})` : ""}`)
          ),
        }
      : undefined;

  const procedureSectionText =
    includeNarrative && procedureSectionEntryRefs.length
      ? {
          status: "generated",
          div: narrativeFromList(
            "History of Procedures",
            (ipsRecord.procedures ?? []).map((p) => `${p.name}${p.date ? ` (${asIsoDate(p.date) || asIsoDateTime(p.date)})` : ""}`)
          ),
        }
      : undefined;

  const deviceSectionText =
    includeNarrative && deviceSectionEntryRefs.length
      ? {
          status: "generated",
          div: narrativeFromList(
            "Device Use",
            (ipsRecord.devices ?? []).map((d) => `${d.name}${d.date ? ` (${asIsoDate(d.date) || asIsoDateTime(d.date)})` : ""}`)
          ),
        }
      : undefined;

  const immunizationSectionText =
    includeNarrative && immunizationSectionEntryRefs.length
      ? {
          status: "generated",
          div: narrativeFromList(
            "Immunizations list",
            (ipsRecord.immunizations ?? []).map((i) => `${i.name}${i.date ? ` (${asIsoDate(i.date) || asIsoDateTime(i.date)})` : ""}`)
          ),
        }
      : undefined;

  const observationSectionText =
    includeNarrative && observationSectionEntryRefs.length
      ? {
          status: "generated",
          div: narrativeFromRows("Relevant diagnostic tests / observations", [
            ["Name", "Value", "Date"],
            ...(ipsRecord.observations ?? []).map((o) => [
              o.name,
              o.value ?? "",
              asIsoDate(o.date) || asIsoDateTime(o.date) || "",
            ]),
          ]),
        }
      : undefined;

  const carePlanSectionText =
    includeNarrative && carePlanSectionEntryRefs.length
      ? {
          status: "generated",
          div: narrativeFromList(
            "Care Plan",
            (ipsRecord.carePlans ?? []).map((p) => `${p.name}${p.reason ? ` — ${p.reason}` : ""}`)
          ),
        }
      : undefined;

  const composition = {
    fullUrl: `urn:uuid:${compositionUUID}`,
    resource: {
      resourceType: "Composition",
      id: compositionUUID,
      meta: {
        profile: ["http://hl7.eu/fhir/eps/StructureDefinition/composition-eu-eps"],
      },
      ...(includeResourceNarrative
        ? {
            text: {
              status: "generated",
              div: narrativeFromRows("Composition", [
                ["Title", "European Patient Summary"],
                ["Date", now],
                ["Author", practitionerDisplay],
                ["Custodian", organizationDisplay],
              ]),
            },
          }
        : {}),
      identifier: {
        system: "urn:ietf:rfc:9562",
        value: uuidv4(),
        assigner: {
          display: "HL7 Europe",
        },
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
      subject: makeReference(patientUUID, patientDisplay),
      date: now,
      author: [makeReference(practitionerRoleUUID)],
      title: "European Patient Summary",
      confidentiality: "N",
      custodian: makeReference(organizationUUID, organizationDisplay),
      section: [
        makeSection({
          title: "Medication list",
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
          entryRefs: medicationSectionEntryRefs,
          mandated: true,
          emptyReasonText: "No known medications",
          emptyNarrativeSentence: "No known medications.",
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
          text: allergySectionText,
          entryRefs: allergySectionEntryRefs,
          mandated: true,
          emptyReasonText: "No known allergies",
          emptyNarrativeSentence: "No known allergies or intolerances.",
        }),

        makeSection({
          title: "Problem list",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "11450-4",
                display: "Problem list - Reported",
              },
            ],
          },
          text: problemSectionText,
          entryRefs: problemSectionEntryRefs,
          mandated: true,
          emptyReasonText: "No known conditions",
          emptyNarrativeSentence: "No known health problems or risks.",
        }),

        makeSection({
          title: "History of Procedures",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "47519-4",
                display: "History of Procedures Document",
              },
            ],
          },
          text: procedureSectionText,
          entryRefs: procedureSectionEntryRefs,
          mandated: true,
          emptyReasonText: "No known procedures",
          emptyNarrativeSentence: "No known procedures.",
        }),

        makeSection({
          title: "Device Use",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "46264-8",
                display: "History of medical device use",
              },
            ],
          },
          text: deviceSectionText,
          entryRefs: deviceSectionEntryRefs,
          mandated: true,
          emptyReasonText: "No known devices",
          emptyNarrativeSentence: "No known medical devices in use.",
        }),

        makeSection({
          title: "Immunizations list",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "11369-6",
                display: "History of Immunization note",
              },
            ],
          },
          text: immunizationSectionText,
          entryRefs: immunizationSectionEntryRefs,
        }),

        makeSection({
          title: "Relevant diagnostic tests/laboratory data",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "30954-2",
                display: "Relevant diagnostic tests/laboratory data note",
              },
            ],
          },
          text: observationSectionText,
          entryRefs: observationSectionEntryRefs,
        }),

        makeSection({
          title: "Care Plan",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "18776-5",
                display: "Plan of care note",
              },
            ],
          },
          text: carePlanSectionText,
          entryRefs: carePlanSectionEntryRefs,
        }),
      ].filter(Boolean),
    },
  };

  const patientResource = {
    resourceType: "Patient",
    id: patientUUID,
    meta: {
      profile: ["http://hl7.eu/fhir/eps/StructureDefinition/patient-eu-eps"],
    },
    identifier: [
      {
        type: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0203",
              code: "JHN",
            },
          ],
        },
        system: ipsRecord?.patient?.identifierSystem || "http://example.org/identifier-1",
        value: ipsRecord?.patient?.identifierValue || "1234567890",
      },
    ],
    name: [
      {
        text: patientDisplay,
        family: ipsRecord?.patient?.name,
        given: ipsRecord?.patient?.given ? [ipsRecord.patient.given] : undefined,
      },
    ],
    telecom: ipsRecord?.patient?.phone
      ? [
          {
            system: "phone",
            value: ipsRecord.patient.phone,
          },
        ]
      : undefined,
    gender: ipsRecord?.patient?.gender,
    birthDate: asIsoDate(ipsRecord?.patient?.dob),
    address: [
      pruneNulls({
        use: "home",
        type: "physical",
        line: ipsRecord?.patient?.addressLine ? [ipsRecord.patient.addressLine] : undefined,
        city: ipsRecord?.patient?.city,
        postalCode: ipsRecord?.patient?.postalCode,
        country: ipsRecord?.patient?.nation,
      }),
    ],
  };

  if (includeResourceNarrative) {
    patientResource.text = {
      status: "generated",
      div: narrativeFromRows("Patient", [
        ["Name", patientDisplay],
        ...(patientResource.birthDate ? [["Birth date", patientResource.birthDate]] : []),
        ...(ipsRecord?.patient?.gender ? [["Gender", ipsRecord.patient.gender]] : []),
      ]),
    };
  }

  const practitionerResource = {
    resourceType: "Practitioner",
    id: practitionerUUID,
    meta: {
      profile: ["http://hl7.eu/fhir/base/StructureDefinition/practitioner-eu"],
    },
    name: [
      pruneNulls({
        family: ipsRecord?.patient?.practitionerName || practitionerDisplay.split(" ").slice(-1)[0],
        given: ipsRecord?.patient?.practitionerGiven
          ? [ipsRecord.patient.practitionerGiven]
          : practitionerDisplay && practitionerDisplay !== "Unknown Practitioner"
            ? [practitionerDisplay.split(" ")[0]]
            : undefined,
        prefix: inferGenderDisplay(ipsRecord?.patient?.practitionerGender)
          ? [inferGenderDisplay(ipsRecord.patient.practitionerGender)]
          : practitionerDisplay.startsWith("Dr")
            ? ["Dr."]
            : undefined,
        text: practitionerDisplay === "Unknown Practitioner" ? practitionerDisplay : undefined,
      }),
    ],
  };

  if (includeResourceNarrative) {
    practitionerResource.text = {
      status: "generated",
      div: narrativeFromRows("Practitioner", [["Name", practitionerDisplay]]),
    };
  }

  const organizationResource = {
    resourceType: "Organization",
    id: organizationUUID,
    meta: {
      profile: ["http://hl7.eu/fhir/base/StructureDefinition/organization-eu"],
    },
    identifier: ipsRecord?.patient?.odsCode
      ? [
          {
            system: "urn:ietf:rfc:9562",
            value: ipsRecord.patient.odsCode,
            assigner: { display: "HL7 Europe" },
          },
        ]
      : undefined,
    name: organizationDisplay,
    address: [
      pruneNulls({
        city: ipsRecord?.patient?.city,
        postalCode: ipsRecord?.patient?.postalCode,
        country: ipsRecord?.patient?.nation,
      }),
    ],
  };

  if (includeResourceNarrative) {
    organizationResource.text = {
      status: "generated",
      div: narrativeFromRows("Organization", [["Name", organizationDisplay]]),
    };
  }

  const practitionerRoleResource = {
    resourceType: "PractitionerRole",
    id: practitionerRoleUUID,
    meta: {
      profile: ["http://hl7.eu/fhir/base/StructureDefinition/practitionerRole-eu"],
    },
    practitioner: makeReference(practitionerUUID),
    organization: makeReference(organizationUUID),
  };

  if (includeResourceNarrative) {
    practitionerRoleResource.text = {
      status: "generated",
      div: narrativeFromRows("PractitionerRole", [
        ["Practitioner", practitionerDisplay],
        ["Organization", organizationDisplay],
      ]),
    };
  }

  const ipsBundle = {
    resourceType: "Bundle",
    id: bundleUUID,
    meta: {
      profile: ["http://hl7.eu/fhir/eps/StructureDefinition/bundle-eu-eps"],
    },
    identifier: {
      system: "urn:ietf:rfc:9562",
      value: uuidv4(),
      assigner: {
        display: "HL7 Europe",
      },
    },
    type: "document",
    timestamp: now,
    entry: [
      composition,
      {
        fullUrl: `urn:uuid:${patientUUID}`,
        resource: patientResource,
      },
      {
        fullUrl: `urn:uuid:${organizationUUID}`,
        resource: organizationResource,
      },
      {
        fullUrl: `urn:uuid:${practitionerRoleUUID}`,
        resource: practitionerRoleResource,
      },
      {
        fullUrl: `urn:uuid:${practitionerUUID}`,
        resource: practitionerResource,
      },
      ...medicationEntries,
      ...allergyEntries,
      ...conditionEntries,
      ...observationEntries,
      ...immunizationEntries,
      ...procedureEntries,
      ...deviceEntries,
      ...carePlanEntries,
    ],
  };

  return pruneNulls(ipsBundle);
}

module.exports = { generateIPSBundleEPS };