const express = require('express');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Load JSON Schema files
const schemaDir = path.join(__dirname, '..', 'client', 'build', 'ipsdef');
const schemaFiles = [
  'Bundle.schema.json',
  'Extension.schema.json',
  'Patient.schema.json',
  'Organization.schema.json',
  'MedicationRequest.schema.json',
  'Medication.schema.json',
  'AllergyIntolerance.schema.json',
  'Condition.schema.json',
  'Observation.schema.json',
  'Procedure.schema.json',
  'Coverage.schema.json'
];

const FHIR_SCHEMA_KEY = "fhirR4";

// Load single-file FHIR R4 schema (draft-06)
const fhirSchemaPath = path.join(__dirname, 'fhir.schema.json');
const fhirSchemaRaw = fs.readFileSync(fhirSchemaPath, 'utf8');
const fhirSchema = JSON.parse(fhirSchemaRaw);

convertSchemaIdKeyword(fhirSchema);

if (!fhirSchema.$id && typeof fhirSchema.id === 'string') {
  fhirSchema.$id = fhirSchema.id;
}

// Remove unsupported OpenAPI-style discriminator
if (fhirSchema && typeof fhirSchema === 'object') {
  delete fhirSchema.discriminator;
}


const schemas = {};
schemaFiles.forEach(file => {
  const name = file.replace('.schema.json', '');
  const raw = fs.readFileSync(path.join(schemaDir, file), 'utf8');
  schemas[name] = JSON.parse(raw);
});

function fhirDefRef(resourceType) {
  return `${FHIR_SCHEMA_KEY}#/definitions/${resourceType}`;
}


function convertSchemaIdKeyword(node) {
  if (Array.isArray(node)) {
    node.forEach(convertSchemaIdKeyword);
    return;
  }
  if (!node || typeof node !== "object") return;

  // If this object uses draft-06 "id" as a schema identifier, convert it.
  // Heuristic: it's a string that looks like an absolute URI.
  if (typeof node.id === "string" && /^https?:\/\//i.test(node.id)) {
    if (typeof node.$id !== "string") node.$id = node.id;
    delete node.id;
  }

  // Recurse
  for (const v of Object.values(node)) convertSchemaIdKeyword(v);
}


function prettyAjvError(e, prefix = '') {
  let message = e.message;

  if (e.keyword === 'additionalProperties') {
    message = `Unexpected property "${e.params.additionalProperty}"`;
  } else if (e.keyword === 'required') {
    message = `Missing required property "${e.params.missingProperty}"`;
  } else if (e.keyword === 'enum' && Array.isArray(e.params?.allowedValues)) {
    message = `Must be one of: ${e.params.allowedValues.join(', ')}`;
  } else if (e.keyword === 'type' && e.params?.type) {
    message = `Invalid type: expected ${e.params.type}`;
  } else if (e.keyword === 'bundleRefsResolve') {
    const idx = e.params?.entryIdx;
    const ref = e.params?.ref;
    message = `Unresolved reference${idx !== undefined ? ` in entry[${idx}]` : ''}${ref ? `: "${ref}"` : ''}. ${e.message}`;
  }

  return {
    path: `${prefix}${e.instancePath || ''}`,
    message
  };
}

// POST /ipsUniVal
router.post('/', (req, res) => {
  const ajv = new Ajv({ allErrors: true, strict: false });

  // FHIR Ajv (draft-06 schema)
  const ajvFhir = new Ajv({ allErrors: true, strict: false, schemaId: 'auto', validateSchema: false });
  addFormats(ajvFhir);

  // Ajv prefers $id; draft-06 commonly uses "id". Add both to be safe.
  ajvFhir.addSchema(fhirSchema, FHIR_SCHEMA_KEY);


  ajv.addKeyword({
    keyword: 'medReqForEachMed',
    type: 'array',
    validate: function medReqForEachMed(schema, entries) {
      // collect all medication IDs
      const meds = entries
        .filter(e => e.resource?.resourceType === 'Medication')
        .map(e => e.resource.id);
      // collect all request references
      const reqRefs = entries
        .filter(e => e.resource?.resourceType === 'MedicationRequest')
        .map(e => {
          const ref = e.resource.medicationReference?.reference || '';
          return ref.split('/')[1];
        });
      // every med ID must appear in reqRefs
      const missing = meds.filter(id => !reqRefs.includes(id));
      if (missing.length) {
        medReqForEachMed.errors = missing.map(id => ({
          keyword: 'medReqForEachMed',
          message: `No MedicationRequest for Medication/${id}`,
          params: { missingMedication: id }
        }));
        return false;
      }
      return true;
    },
    errors: true
  });

  ajv.addKeyword({
    keyword: 'bundleRefsResolve',
    type: 'array', // entry array
    errors: true,
    validate: function bundleRefsResolve(schema, entries) {
      // Build index: byTypeId and byId
      const byTypeId = new Map(); // "Patient/pt1" -> true
      const byId = new Map();     // "pt1" -> Set(["Patient", "Medication", ...])

      (entries || []).forEach(en => {
        const r = en && en.resource;
        const rt = r && r.resourceType;
        const id = r && r.id;
        if (!rt || !id) return;

        byTypeId.set(`${rt}/${id}`, true);

        if (!byId.has(id)) byId.set(id, new Set());
        byId.get(id).add(rt);
      });

      function isSkippableReference(ref) {
        if (!ref || typeof ref !== 'string') return true;
        // external/contained/logical refs - skip
        if (ref.startsWith('#')) return true;
        if (/^https?:\/\//i.test(ref)) return true;
        if (/^urn:(uuid|oid):/i.test(ref)) return true;
        return false;
      }

      function parseReference(ref) {
        // returns { type, id } where either may be null
        // allow "Resource/id", "Resource/id/_history/1", "id"
        const trimmed = ref.trim();
        if (!trimmed) return { type: null, id: null };

        const parts = trimmed.split('/').filter(Boolean);
        if (parts.length >= 2) {
          return { type: parts[0], id: parts[1] };
        }
        // id-only
        return { type: null, id: trimmed };
      }

      function walk(obj, visitor) {
        if (Array.isArray(obj)) {
          obj.forEach(v => walk(v, visitor));
          return;
        }
        if (!obj || typeof obj !== 'object') return;

        visitor(obj);

        for (const v of Object.values(obj)) walk(v, visitor);
      }

      const errs = [];

      (entries || []).forEach((en, entryIdx) => {
        const resObj = en && en.resource;
        if (!resObj || typeof resObj !== 'object') return;

        walk(resObj, (node) => {
          // Detect FHIR Reference-ish object
          if (!node || typeof node !== 'object') return;
          if (typeof node.reference !== 'string') return;

          const refStr = node.reference;
          if (isSkippableReference(refStr)) return;

          const { type, id } = parseReference(refStr);
          if (!id) return;

          if (type) {
            // strict typed
            if (!byTypeId.has(`${type}/${id}`)) {
              errs.push({
                entryIdx,
                ref: refStr,
                message: `Reference not found in bundle: ${type}/${id}`
              });
            }
          } else {
            // id-only: resolve if unique
            const types = byId.get(id);
            if (!types) {
              errs.push({
                entryIdx,
                ref: refStr,
                message: `Reference id not found in bundle: ${id}`
              });
            } else if (types.size > 1) {
              errs.push({
                entryIdx,
                ref: refStr,
                message: `Ambiguous reference id "${id}" matches multiple resourceTypes: ${Array.from(types).join(', ')}`
              });
            }
          }
        });
      });

      if (errs.length) {
        bundleRefsResolve.errors = errs.map(e => ({
          keyword: 'bundleRefsResolve',
          message: e.message,
          params: { entryIdx: e.entryIdx, ref: e.ref }
        }));
        return false;
      }

      return true;
    }
  });


  addFormats(ajv);
  // Register schemas under their resourceType name
  Object.entries(schemas).forEach(([name, schema]) => ajv.addSchema(schema, name));

  let obj = req.body;
  // unwrap entry-wrapper
  if (!obj.resourceType && obj.resource?.resourceType) {
    obj = obj.resource;
  }

  const topType = obj.resourceType;
  if (!topType || !schemas[topType]) {
    return res.status(400).json({
      valid: false,
      errors: [{ path: '', message: `Unknown or missing resourceType "${topType}"` }]
    });
  }

  const errorsNps = [];
  const errorsFhir = [];


  if (topType === 'Bundle') {
    // 1) Envelope validation
    const bundleSchema = schemas.Bundle;
    const envelopeSchema = JSON.parse(JSON.stringify(bundleSchema));
    delete envelopeSchema.$id;
    envelopeSchema.properties.entry.items.properties.resource = { type: 'object' };

    // Add cross-resource reference check (format agnostic)
    envelopeSchema.properties.entry.bundleRefsResolve = true;

    if (!ajv.validate(envelopeSchema, obj)) {
      (ajv.errors || []).forEach(e => errorsNps.push(prettyAjvError(e)));
    }
    // 2) Validate each entry.resource
    obj.entry?.forEach((en, idx) => {
      const resObj = en.resource;
      const schemaName = resObj?.resourceType;
      if (!schemaName || !schemas[schemaName]) {
        errorsNps.push({
          path: `/entry/${idx}/resource/${schemaName}`,
          message: `Unknown or missing resourceType`
        });
      } else if (!ajv.validate(schemaName, resObj)) {
        (ajv.errors || []).forEach(e =>
          errorsNps.push(prettyAjvError(e, `/entry/${idx}/resource/${schemaName}`))
        );
      }
    });

    // --- FHIR validation (structural) ---
    // const bundleRef = fhirDefRef('Bundle');
    // if (!ajvFhir.validate(bundleRef, obj)) {
    //   (ajvFhir.errors || []).forEach(e => errorsFhir.push(prettyAjvError(e)));
    // }

    obj.entry?.forEach((en, idx) => {
      const resObj = en.resource;
      const rt = resObj?.resourceType;
      if (!rt) {
        errorsFhir.push({ path: `/entry/${idx}/resource`, message: 'Missing resourceType' });
        return;
      }

      const ref = fhirDefRef(rt);
      if (!ajvFhir.validate(ref, resObj)) {
        (ajvFhir.errors || []).forEach(e =>
          errorsFhir.push(prettyAjvError(e, `/entry/${idx}/resource/${rt}`))
        );
      }
    });

  } else {
    // Single resource validation
    ajv.validate(topType, obj);
    (ajv.errors || []).forEach(e => errorsNps.push(prettyAjvError(e)));

    // --- FHIR validation (structural) ---
    const ref = fhirDefRef(topType);
    if (!ajvFhir.validate(ref, obj)) {
      (ajvFhir.errors || []).forEach(e => errorsFhir.push(prettyAjvError(e)));
    }
  }

  res.json({
    valid: errorsNps.length === 0 && errorsFhir.length === 0,
    errors: [...errorsNps, ...errorsFhir],

    validNps: errorsNps.length === 0,
    errorsNps,
    validFhirR4: errorsFhir.length === 0,
    errorsFhirR4: errorsFhir
  });

});

module.exports = router;
