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

const schemas = {};
schemaFiles.forEach(file => {
  const name = file.replace('.schema.json', '');
  const raw = fs.readFileSync(path.join(schemaDir, file), 'utf8');
  schemas[name] = JSON.parse(raw);
});

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
  }

  return {
    path: `${prefix}${e.instancePath || ''}`,
    message
  };
}

// POST /ipsUniVal
router.post('/', (req, res) => {
  const ajv = new Ajv({ allErrors: true, strict: false });
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

  const errors = [];

  if (topType === 'Bundle') {
    // 1) Envelope validation
    const bundleSchema = schemas.Bundle;
    const envelopeSchema = JSON.parse(JSON.stringify(bundleSchema));
    delete envelopeSchema.$id;
    envelopeSchema.properties.entry.items.properties.resource = { type: 'object' };
    if (!ajv.validate(envelopeSchema, obj)) {
      (ajv.errors || []).forEach(e => errors.push(prettyAjvError(e)));
    }
    // 2) Validate each entry.resource
    obj.entry?.forEach((en, idx) => {
      const resObj = en.resource;
      const schemaName = resObj?.resourceType;
      if (!schemaName || !schemas[schemaName]) {
        errors.push({
          path: `/entry/${idx}/resource/${schemaName}`,
          message: `Unknown or missing resourceType`
        });
      } else if (!ajv.validate(schemaName, resObj)) {
        (ajv.errors || []).forEach(e =>
          errors.push(prettyAjvError(e, `/entry/${idx}/resource/${schemaName}`))
        );
      }
    });
  } else {
    // Single resource validation
    ajv.validate(topType, obj);
    (ajv.errors || []).forEach(e => errors.push(prettyAjvError(e)));
  }

  res.json({ valid: errors.length === 0, errors });
});

module.exports = router;
