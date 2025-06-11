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
  'Observation.schema.json'
];

const schemas = {};
schemaFiles.forEach(file => {
  const name = file.replace('.schema.json', '');
  const raw = fs.readFileSync(path.join(schemaDir, file), 'utf8');
  schemas[name] = JSON.parse(raw);
});

// POST /ipsUniVal
router.post('/', (req, res) => {
  const ajv = new Ajv({ allErrors: true, strict: false });
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
      (ajv.errors || []).forEach(e =>
        errors.push({ path: e.instancePath, message: e.message })
      );
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
          errors.push({
            path: `/entry/${idx}/resource/${schemaName}${e.instancePath}`,
            message: e.message
          })
        );
      }
    });
  } else {
    // Single resource validation
    ajv.validate(topType, obj);
    (ajv.errors || []).forEach(e =>
      errors.push({ path: e.instancePath, message: e.message })
    );
  }

  res.json({ valid: errors.length === 0, errors });
});

module.exports = router;
