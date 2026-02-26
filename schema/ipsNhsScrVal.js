// server/ipsNhsScrVal.js
const express = require('express');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// ---- NHS SCR IPS schema set ----
const schemaDir = path.join(__dirname, '..', 'client', 'build', 'ipsNhsScrDef');
const schemaFiles = [
  'Bundle.schema.json',
  'Extension.schema.json',
  'Patient.schema.json',
  'Organization.schema.json',
  'Practitioner.schema.json',
  'Composition.schema.json',
  'AllergyIntolerance.schema.json',
  'Condition.schema.json',
  'MedicationStatement.schema.json',
  'Immunization.schema.json',
  'Observation.schema.json',
  'Procedure.schema.json'
];

const FHIR_SCHEMA_KEY = 'fhirR4';

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
  if (!node || typeof node !== 'object') return;

  if (typeof node.id === 'string' && /^https?:\/\//i.test(node.id)) {
    if (typeof node.$id !== 'string') node.$id = node.id;
    delete node.id;
  }

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

// POST /ipsNhsScrVal
router.post('/', (req, res) => {
  const ajv = new Ajv({ allErrors: true, strict: false });

  // FHIR Ajv (draft-06 schema)
  const ajvFhir = new Ajv({
    allErrors: true,
    strict: false,
    schemaId: 'auto',
    validateSchema: false
  });
  addFormats(ajvFhir);
  ajvFhir.addSchema(fhirSchema, FHIR_SCHEMA_KEY);

  // ---- Bundle cross-resource reference resolution ----
  // NOTE: for NHS SCR we *do not* enforce "req per med" like NPS did.
  ajv.addKeyword({
    keyword: 'bundleRefsResolve',
    type: 'array', // entry array
    errors: true,
    validate: function bundleRefsResolve(schema, entries) {
      const byTypeId = new Map(); // "Patient/pt1" -> true
      const byId = new Map();     // "pt1" -> Set(["Patient", ...])

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
        if (ref.startsWith('#')) return true;                 // contained
        if (/^https?:\/\//i.test(ref)) return true;           // external
        if (/^urn:(uuid|oid):/i.test(ref)) return true;       // logical/URN (common in SCR)
        return false;
      }

      function parseReference(ref) {
        const trimmed = ref.trim();
        if (!trimmed) return { type: null, id: null };

        const parts = trimmed.split('/').filter(Boolean);
        if (parts.length >= 2) return { type: parts[0], id: parts[1] };

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
          if (!node || typeof node !== 'object') return;
          if (typeof node.reference !== 'string') return;

          const refStr = node.reference;
          if (isSkippableReference(refStr)) return;

          const { type, id } = parseReference(refStr);
          if (!id) return;

          if (type) {
            if (!byTypeId.has(`${type}/${id}`)) {
              errs.push({
                entryIdx,
                ref: refStr,
                message: `Reference not found in bundle: ${type}/${id}`
              });
            }
          } else {
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

  // Register SCR schemas under their resourceType name (Bundle, Patient, etc.)
  Object.entries(schemas).forEach(([name, schema]) => ajv.addSchema(schema, name));

  let obj = req.body;
  // unwrap entry-wrapper (if caller posted {fullUrl, resource})
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

  const errorsScr = [];
  const errorsFhir = [];

  if (topType === 'Bundle') {
    // 1) Envelope validation (allow unknown entry resource types at this stage)
    const bundleSchema = schemas.Bundle;
    const envelopeSchema = JSON.parse(JSON.stringify(bundleSchema));
    delete envelopeSchema.$id;

    // Force the envelope phase to not care about per-resource shape
    if (envelopeSchema.definitions?.BundleEntry?.properties?.resource) {
      envelopeSchema.definitions.BundleEntry.properties.resource = { type: 'object' };
    }

    // Add cross-resource reference check (but skip URN + contained + external refs)
    envelopeSchema.properties.entry.bundleRefsResolve = true;

    if (!ajv.validate(envelopeSchema, obj)) {
      (ajv.errors || []).forEach(e => errorsScr.push(prettyAjvError(e)));
    }

    // 2) Validate each entry.resource:
    //    - if we have a SCR schema for it, validate strictly with that schema
    //    - otherwise, validate structurally against FHIR R4 only
    obj.entry?.forEach((en, idx) => {
      const resObj = en.resource;
      const rt = resObj?.resourceType;

      if (!rt) {
        errorsScr.push({ path: `/entry/${idx}/resource`, message: 'Missing resourceType' });
        return;
      }

      if (schemas[rt]) {
        if (!ajv.validate(rt, resObj)) {
          (ajv.errors || []).forEach(e =>
            errorsScr.push(prettyAjvError(e, `/entry/${idx}/resource/${rt}`))
          );
        }
      }

      // Always do FHIR structural validation for any resourceType (defined or not)
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
    (ajv.errors || []).forEach(e => errorsScr.push(prettyAjvError(e)));

    // FHIR structural validation
    const ref = fhirDefRef(topType);
    if (!ajvFhir.validate(ref, obj)) {
      (ajvFhir.errors || []).forEach(e => errorsFhir.push(prettyAjvError(e)));
    }
  }

  res.json({
    valid: errorsScr.length === 0 && errorsFhir.length === 0,
    errors: [...errorsScr, ...errorsFhir],

    validNhsScr: errorsScr.length === 0,
    errorsNhsScr: errorsScr,

    validFhirR4: errorsFhir.length === 0,
    errorsFhirR4: errorsFhir
  });
});

module.exports = router;