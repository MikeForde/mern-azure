const express = require('express');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// ---- EPS schema set ----
const schemaDir = path.join(__dirname, '..', 'client', 'build', 'epsDef');
const schemaFiles = [
  'Bundle.schema.json',
  'Extension.schema.json',
  'Patient.schema.json',
  'Organization.schema.json',
  'Practitioner.schema.json',
  'PractitionerRole.schema.json',
  'Composition.schema.json',
  'AllergyIntolerance.schema.json',
  'Condition.schema.json',
  'Medication.schema.json',
  'MedicationStatement.schema.json',
  'Immunization.schema.json',
  'Observation.schema.json',
  'Procedure.schema.json',
  'Device.schema.json',
  'DeviceUseStatement.schema.json',
  'CarePlan.schema.json'
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
if (fhirSchema && typeof fhirSchema === 'object') {
  delete fhirSchema.discriminator;
}

const strictSchemas = {};
schemaFiles.forEach(file => {
  const name = file.replace('.schema.json', '');
  const raw = fs.readFileSync(path.join(schemaDir, file), 'utf8');
  strictSchemas[name] = JSON.parse(raw);
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

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function makeSchemaLenient(node) {
  if (Array.isArray(node)) {
    node.forEach(makeSchemaLenient);
    return;
  }
  if (!node || typeof node !== 'object') return;

  if (Object.prototype.hasOwnProperty.call(node, 'additionalProperties')) {
    node.additionalProperties = true;
  }

  if (
    (node.type === 'object' || node.properties || node.patternProperties) &&
    !Object.prototype.hasOwnProperty.call(node, 'additionalProperties')
  ) {
    node.additionalProperties = true;
  }

  for (const v of Object.values(node)) {
    makeSchemaLenient(v);
  }
}

function buildRuntimeSchemas(lenient = false) {
  const runtimeSchemas = deepClone(strictSchemas);

  if (lenient) {
    Object.values(runtimeSchemas).forEach(schema => makeSchemaLenient(schema));
  }

  return runtimeSchemas;
}

function parseBooleanFlag(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;

  const v = value.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y' || v === 'on';
}

function isLenientRequest(req) {
  return (
    parseBooleanFlag(req.query?.lenient) ||
    parseBooleanFlag(req.headers['x-validator-lenient'])
  );
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

// POST /ipsEpsVal
router.post('/', (req, res) => {
  const lenient = isLenientRequest(req);
  const schemas = buildRuntimeSchemas(lenient);

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
  ajv.addKeyword({
    keyword: 'bundleRefsResolve',
    type: 'array',
    errors: true,
    validate: function bundleRefsResolve(schema, entries) {
      const byTypeId = new Map();
      const byId = new Map();
      const byFullUrl = new Map();

      (entries || []).forEach(en => {
        const r = en && en.resource;
        const rt = r && r.resourceType;
        const id = r && r.id;
        const fullUrl = en && en.fullUrl;

        if (fullUrl && typeof fullUrl === 'string') {
          byFullUrl.set(fullUrl, true);
        }

        if (!rt || !id) return;

        byTypeId.set(`${rt}/${id}`, true);

        if (!byId.has(id)) byId.set(id, new Set());
        byId.get(id).add(rt);

        const urnUuid = `urn:uuid:${id}`;
        byFullUrl.set(urnUuid, true);
      });

      function isSkippableReference(ref) {
        if (!ref || typeof ref !== 'string') return true;
        if (ref.startsWith('#')) return true;
        if (/^https?:\/\//i.test(ref)) return true;
        if (/^urn:oid:/i.test(ref)) return true;
        return false;
      }

      function parseReference(ref) {
        const trimmed = ref.trim();
        if (!trimmed) return { type: null, id: null };

        if (/^urn:uuid:/i.test(trimmed)) {
          return { type: null, id: trimmed.replace(/^urn:uuid:/i, '') };
        }

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

          const refStr = node.reference.trim();
          if (!refStr) return;

          if (refStr.startsWith('#')) return;

          if (/^urn:uuid:/i.test(refStr)) {
            if (!byFullUrl.has(refStr)) {
              errs.push({
                entryIdx,
                ref: refStr,
                message: `Reference not found in bundle fullUrl set: ${refStr}`
              });
            }
            return;
          }

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

  Object.entries(schemas).forEach(([name, schema]) => ajv.addSchema(schema, name));

  let obj = req.body;
  if (!obj.resourceType && obj.resource?.resourceType) {
    obj = obj.resource;
  }

  const topType = obj?.resourceType;
  if (!topType || !schemas[topType]) {
    return res.status(400).json({
      valid: false,
      errors: [{ path: '', message: `Unknown or missing resourceType "${topType}"` }]
    });
  }

  const errorsEps = [];
  const errorsFhir = [];

  if (topType === 'Bundle') {
    const bundleSchema = schemas.Bundle;
    const envelopeSchema = deepClone(bundleSchema);
    delete envelopeSchema.$id;

    if (envelopeSchema.definitions?.BundleEntry?.properties?.resource) {
      envelopeSchema.definitions.BundleEntry.properties.resource = { type: 'object' };
    }

    envelopeSchema.properties.entry.bundleRefsResolve = true;

    if (!ajv.validate(envelopeSchema, obj)) {
      (ajv.errors || []).forEach(e => errorsEps.push(prettyAjvError(e)));
    }

    const bundleRef = fhirDefRef('Bundle');
    if (!ajvFhir.validate(bundleRef, obj)) {
      (ajvFhir.errors || []).forEach(e => errorsFhir.push(prettyAjvError(e)));
    }

    obj.entry?.forEach((en, idx) => {
      const resObj = en?.resource;
      const rt = resObj?.resourceType;

      if (!rt) {
        errorsEps.push({ path: `/entry/${idx}/resource`, message: 'Missing resourceType' });
        return;
      }

      if (schemas[rt]) {
        if (!ajv.validate(rt, resObj)) {
          (ajv.errors || []).forEach(e =>
            errorsEps.push(prettyAjvError(e, `/entry/${idx}/resource/${rt}`))
          );
        }
      }

      const ref = fhirDefRef(rt);
      if (!ajvFhir.validate(ref, resObj)) {
        (ajvFhir.errors || []).forEach(e =>
          errorsFhir.push(prettyAjvError(e, `/entry/${idx}/resource/${rt}`))
        );
      }
    });
  } else {
    ajv.validate(topType, obj);
    (ajv.errors || []).forEach(e => errorsEps.push(prettyAjvError(e)));

    const ref = fhirDefRef(topType);
    if (!ajvFhir.validate(ref, obj)) {
      (ajvFhir.errors || []).forEach(e => errorsFhir.push(prettyAjvError(e)));
    }
  }

  res.json({
    valid: errorsEps.length === 0 && errorsFhir.length === 0,
    errors: [...errorsEps, ...errorsFhir],

    validEps: errorsEps.length === 0,
    errorsEps,

    validFhirR4: errorsFhir.length === 0,
    errorsFhirR4: errorsFhir,

    validationMode: lenient ? 'lenient' : 'strict'
  });
});

module.exports = router;