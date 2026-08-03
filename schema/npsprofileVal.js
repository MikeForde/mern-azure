const express = require('express');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const router = express.Router();

const packagePath = path.join(__dirname, 'profile', 'package.r4.tgz');
const FHIR_SCHEMA_KEY = 'fhirR4';

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

function tarReadJson(innerPath) {
  const raw = execFileSync('tar', ['-xOf', packagePath, innerPath], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  return JSON.parse(raw);
}

function loadProfiles() {
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Missing profile package: ${packagePath}`);
  }

  const listing = execFileSync('tar', ['-tzf', packagePath], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });

  const profileFiles = listing
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => /^package\/StructureDefinition-.*\.json$/.test(line));

  const byCanonical = new Map();
  const byType = new Map();

  profileFiles.forEach(file => {
    const profile = tarReadJson(file);
    byCanonical.set(profile.url, profile);

    if (profile.kind === 'resource' && profile.type && !byType.has(profile.type)) {
      byType.set(profile.type, profile);
    }
  });

  return { byCanonical, byType };
}

const profiles = loadProfiles();

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

  for (const value of Object.values(node)) convertSchemaIdKeyword(value);
}

function fhirDefRef(resourceType) {
  return `${FHIR_SCHEMA_KEY}#/definitions/${resourceType}`;
}

function absolutizeDefinitionRefs(node, schemaKey) {
  if (Array.isArray(node)) {
    node.forEach(item => absolutizeDefinitionRefs(item, schemaKey));
    return;
  }
  if (!node || typeof node !== 'object') return;

  if (typeof node.$ref === 'string' && node.$ref.startsWith('#/definitions/')) {
    node.$ref = `${schemaKey}${node.$ref}`;
  }

  for (const value of Object.values(node)) {
    absolutizeDefinitionRefs(value, schemaKey);
  }
}

function buildFhirBundleEnvelopeSchema() {
  const bundleSchema = JSON.parse(JSON.stringify(fhirSchema.definitions.Bundle));
  const entrySchema = JSON.parse(JSON.stringify(fhirSchema.definitions.Bundle_Entry));

  absolutizeDefinitionRefs(bundleSchema, FHIR_SCHEMA_KEY);
  absolutizeDefinitionRefs(entrySchema, FHIR_SCHEMA_KEY);

  entrySchema.properties.resource = { type: 'object' };
  bundleSchema.properties.entry = {
    ...bundleSchema.properties.entry,
    items: entrySchema
  };

  return bundleSchema;
}

const fhirBundleEnvelopeSchema = buildFhirBundleEnvelopeSchema();

function prettyAjvError(error, prefix = '') {
  let message = error.message;

  if (error.keyword === 'additionalProperties') {
    message = `Unexpected property "${error.params.additionalProperty}"`;
  } else if (error.keyword === 'required') {
    message = `Missing required property "${error.params.missingProperty}"`;
  } else if (error.keyword === 'enum' && Array.isArray(error.params?.allowedValues)) {
    message = `Must be one of: ${error.params.allowedValues.join(', ')}`;
  } else if (error.keyword === 'type' && error.params?.type) {
    message = `Invalid type: expected ${error.params.type}`;
  }

  return {
    path: `${prefix}${error.instancePath || ''}`,
    message
  };
}

function buildFhirValidator() {
  const ajvFhir = new Ajv({
    allErrors: true,
    strict: false,
    schemaId: 'auto',
    validateSchema: false
  });
  addFormats(ajvFhir);
  ajvFhir.addSchema(fhirSchema, FHIR_SCHEMA_KEY);
  return ajvFhir;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function getExpectedProfile(resourceType) {
  return profiles.byType.get(resourceType) || null;
}

function isChoicePart(part) {
  return /\[x\]$/.test(part);
}

function choiceBase(part) {
  return String(part).replace(/\[x\]$/, '');
}

function typeCodeSuffix(code) {
  const raw = String(code || '').split('/').pop();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
}

function allowedChoiceNames(part, typeList = []) {
  const base = choiceBase(part);
  const names = typeList
    .map(type => typeCodeSuffix(type.code))
    .filter(Boolean)
    .map(suffix => `${base}${suffix}`);

  return [...new Set(names)];
}

function actualChoiceNames(obj, part, typeList = []) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];

  const base = choiceBase(part);
  const allowed = allowedChoiceNames(part, typeList);

  if (allowed.length > 0) {
    return allowed.filter(name => obj[name] !== undefined);
  }

  return Object.keys(obj).filter(key => key.startsWith(base) && key.length > base.length);
}

function resolvePartNames(obj, part, typeList = []) {
  if (!isChoicePart(part)) return [part];

  const actual = actualChoiceNames(obj, part, typeList);
  if (actual.length > 0) return actual;

  const allowed = allowedChoiceNames(part, typeList);
  if (allowed.length > 0) return allowed;

  return [part];
}

function getValuesAtPath(root, pathParts, typeList = []) {
  let current = [root];

  for (let idx = 0; idx < pathParts.length; idx += 1) {
    const part = pathParts[idx];
    const next = [];
    for (const value of current) {
      if (Array.isArray(value)) {
        value.forEach(item => {
          const resolvedNames = resolvePartNames(item, part, idx === 0 ? typeList : []);
          resolvedNames.forEach(name => {
            if (item && typeof item === 'object' && item[name] !== undefined) {
              next.push(item[name]);
            }
          });
        });
        continue;
      }

      const resolvedNames = resolvePartNames(value, part, idx === 0 ? typeList : []);
      resolvedNames.forEach(name => {
        if (value && typeof value === 'object' && value[name] !== undefined) {
          next.push(value[name]);
        }
      });
    }

    current = next.flatMap(item => Array.isArray(item) ? item : [item]);
  }

  return current.filter(value => value !== undefined);
}

function getContainerNodes(root, pathParts) {
  if (pathParts.length === 0) return [root];
  return getValuesAtPath(root, pathParts);
}

function getContainerNodesWithPaths(root, pathParts, basePath = '', typeList = []) {
  let current = [{ value: root, path: basePath }];

  for (let partIndex = 0; partIndex < pathParts.length; partIndex += 1) {
    const part = pathParts[partIndex];
    const next = [];

    for (const item of current) {
      const { value, path: itemPath } = item;

      if (Array.isArray(value)) {
        value.forEach((entry, idx) => {
          const resolvedNames = resolvePartNames(entry, part, partIndex === 0 ? typeList : []);
          resolvedNames.forEach(name => {
            if (entry && typeof entry === 'object' && entry[name] !== undefined) {
              next.push({
                value: entry[name],
                path: `${itemPath}/${idx}/${name}`
              });
            }
          });
        });
        continue;
      }

      const resolvedNames = resolvePartNames(value, part, partIndex === 0 ? typeList : []);
      resolvedNames.forEach(name => {
        if (value && typeof value === 'object' && value[name] !== undefined) {
          next.push({
            value: value[name],
            path: `${itemPath}/${name}`
          });
        }
      });
    }

    current = next.flatMap(item => {
      if (!Array.isArray(item.value)) return [item];

      return item.value.map((entry, idx) => ({
        value: entry,
        path: `${item.path}/${idx}`
      }));
    });
  }

  return current;
}

function primitiveValue(node) {
  if (node === null || node === undefined) return node;
  if (typeof node !== 'object') return node;
  return undefined;
}

function normalizeTargetProfiles(typeList = []) {
  return typeList
    .flatMap(type => asArray(type.targetProfile))
    .map(profileUrl => String(profileUrl).split('|')[0]);
}

function normalizeTypeProfiles(typeList = []) {
  return typeList
    .flatMap(type => asArray(type.profile))
    .map(profileUrl => String(profileUrl).split('|')[0]);
}

function parseCanonicalTail(canonical) {
  const bare = String(canonical || '').split('|')[0];
  const parts = bare.split('/').filter(Boolean);
  return parts[parts.length - 1] || bare;
}

function allowedReferenceTypes(targetProfiles = []) {
  return [...new Set(targetProfiles.map(profileUrl => {
    const canonical = String(profileUrl).split('|')[0];
    const profile = profiles.byCanonical.get(canonical);
    return profile?.type || parseCanonicalTail(canonical);
  }))];
}

function parseReferenceType(ref) {
  if (!ref || typeof ref !== 'string') return null;
  if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('#')) return null;
  const parts = ref.split('/').filter(Boolean);
  return parts.length >= 2 ? parts[0] : null;
}

function buildBundleIndex(bundle) {
  const byTypeAndId = new Map();

  asArray(bundle.entry).forEach(entry => {
    const resource = entry && entry.resource;
    const resourceType = resource && resource.resourceType;
    const id = resource && resource.id;

    if (!resourceType || !id) return;
    byTypeAndId.set(`${resourceType}/${id}`, resource);
  });

  return { byTypeAndId };
}

function addError(target, pathValue, message) {
  target.push({ path: pathValue, message });
}

function validateElementCardinality(resource, element, pathPrefix, errors) {
  const pathParts = String(element.path || '').split('.');
  if (pathParts.length <= 1) return;

  const relativeParts = pathParts.slice(1);
  const parentParts = relativeParts.slice(0, -1);
  const leafPart = relativeParts[relativeParts.length - 1];
  const parents = getContainerNodesWithPaths(resource, parentParts, pathPrefix, element.type || []);
  const min = Number.isInteger(element.min) ? element.min : Number(element.min || 0);
  const max = element.max;

  if (parents.length === 0) return;

  parents.forEach(({ value: parent, path: parentPath }) => {
    if (!parent || typeof parent !== 'object') return;

    const childNames = resolvePartNames(parent, leafPart, element.type || []);
    const presentNames = childNames.filter(name => parent[name] !== undefined);
    const count = presentNames.reduce((sum, name) => {
      const value = parent[name];
      return sum + (Array.isArray(value) ? value.length : 1);
    }, 0);
    const missingPath = childNames.length === 1
      ? `${parentPath}/${childNames[0]}`
      : `${parentPath}/${leafPart}`;
    const childPath = presentNames.length === 1
      ? `${parentPath}/${presentNames[0]}`
      : missingPath;

    if (min > 0 && count < min) {
      addError(errors, missingPath, `Minimum cardinality ${min} not met`);
    }

    if (max !== '*' && Number.isFinite(Number(max)) && count > Number(max)) {
      addError(errors, childPath, `Maximum cardinality ${max} exceeded`);
    }
  });
}

function validateFixedValue(resource, element, pathPrefix, errors) {
  const fixedKey = Object.keys(element).find(key => key.startsWith('fixed'));
  if (!fixedKey) return;

  const pathParts = String(element.path || '').split('.');
  if (pathParts.length <= 1) return;

  const values = getValuesAtPath(resource, pathParts.slice(1), element.type || []);
  const expected = element[fixedKey];

  values.forEach(value => {
    const actual = primitiveValue(value);
    if (actual !== undefined && actual !== expected) {
      addError(
        errors,
        `${pathPrefix}/${pathParts.slice(1).join('/')}`,
        `Expected fixed value "${expected}"`
      );
    }
  });
}

function validateReferenceTargets(resource, element, pathPrefix, bundleIndex, errors) {
  const allowedProfiles = normalizeTargetProfiles(element.type);
  if (allowedProfiles.length === 0) return;

  const allowedTypes = new Set(allowedReferenceTypes(allowedProfiles));
  const pathParts = String(element.path || '').split('.');
  if (pathParts.length <= 1) return;

  const values = getValuesAtPath(resource, pathParts.slice(1), element.type || []);

  values.forEach(value => {
    if (!value || typeof value !== 'object' || typeof value.reference !== 'string') return;

    const refType = parseReferenceType(value.reference);
    if (refType && !allowedTypes.has(refType)) {
      addError(
        errors,
        `${pathPrefix}/${pathParts.slice(1).join('/')}/reference`,
        `Reference type "${refType}" is not allowed; expected one of: ${Array.from(allowedTypes).join(', ')}`
      );
      return;
    }

  });
}

function getProfileRootType(expectedProfile, instance) {
  if (expectedProfile?.type) return expectedProfile.type;
  if (instance && typeof instance === 'object' && typeof instance.resourceType === 'string') {
    return instance.resourceType;
  }

  const firstPath = asArray(expectedProfile?.snapshot?.element)
    .map(element => element?.path)
    .find(value => typeof value === 'string' && value);

  return firstPath ? String(firstPath).split('.')[0] : null;
}

function validateNestedTypeProfiles(instance, expectedProfile, pathPrefix, bundleIndex, errors, warnings, profileTrail) {
  const snapshotElements = asArray(expectedProfile?.snapshot?.element)
    .filter(element => typeof element.path === 'string')
    .filter(element => !element.sliceName)
    .filter(element => !String(element.id || '').includes(':'));

  snapshotElements.forEach(element => {
    const nestedProfileUrls = normalizeTypeProfiles(element.type);
    if (nestedProfileUrls.length === 0) return;

    const pathParts = String(element.path || '').split('.');
    if (pathParts.length <= 1) return;

    const valuesWithPaths = getContainerNodesWithPaths(instance, pathParts.slice(1), pathPrefix, element.type || []);
    valuesWithPaths.forEach(({ value, path: valuePath }) => {
      if (!value || typeof value !== 'object') return;

      nestedProfileUrls.forEach(profileUrl => {
        if (profileTrail.has(profileUrl)) return;

        const nestedProfile = profiles.byCanonical.get(profileUrl);
        if (!nestedProfile) {
          warnings.push({
            path: valuePath,
            message: `Referenced datatype profile is not available: ${profileUrl}`
          });
          return;
        }

        const nestedResult = validateAgainstProfile(
          value,
          nestedProfile,
          valuePath,
          bundleIndex,
          new Set([...profileTrail, profileUrl])
        );

        errors.push(...nestedResult.errors);
        warnings.push(...nestedResult.warnings);
      });
    });
  });
}

function validateAgainstProfile(instance, expectedProfile, pathPrefix, bundleIndex, profileTrail = new Set()) {
  const errors = [];
  const warnings = [];
  const rootType = getProfileRootType(expectedProfile, instance);

  if (!rootType) {
    warnings.push({
      path: pathPrefix || '',
      message: 'Could not determine profile root type for validation'
    });
    return { errors, warnings };
  }

  const snapshotElements = asArray(expectedProfile?.snapshot?.element)
    .filter(element => typeof element.path === 'string')
    .filter(element => !element.sliceName)
    .filter(element => !String(element.id || '').includes(':'))
    .filter(element => element.path.startsWith(`${rootType}.`));

  snapshotElements.forEach(element => {
    validateElementCardinality(instance, element, pathPrefix, errors);
    validateFixedValue(instance, element, pathPrefix, errors);
    validateReferenceTargets(instance, element, pathPrefix, bundleIndex, errors);
  });

  validateNestedTypeProfiles(instance, expectedProfile, pathPrefix, bundleIndex, errors, warnings, profileTrail);

  return { errors, warnings };
}

function validateBundle(bundle) {
  const errorsProfile = [];
  const errorsFhir = [];
  const warnings = [];
  const ajvFhir = buildFhirValidator();

  if (!bundle || bundle.resourceType !== 'Bundle') {
    addError(errorsProfile, '', 'Expected a FHIR Bundle');
    return {
      valid: false,
      errors: errorsProfile,
      warnings,
      validProfile: false,
      errorsProfile,
      warningsProfile: warnings,
      validFhirR4: false,
      errorsFhirR4: errorsFhir,
      profilePackage: 'nato.nps.r4',
      profileVersion: '0.1.0'
    };
  }

  const bundleProfile = getExpectedProfile('Bundle');
  if (!bundleProfile) {
    addError(errorsProfile, '', 'NPS Bundle profile is not available');
    return {
      valid: false,
      errors: errorsProfile,
      warnings,
      validProfile: false,
      errorsProfile,
      warningsProfile: warnings,
      validFhirR4: false,
      errorsFhirR4: errorsFhir,
      profilePackage: 'nato.nps.r4',
      profileVersion: '0.1.0'
    };
  }

  const bundleIndex = buildBundleIndex(bundle);

  if (!ajvFhir.validate(fhirBundleEnvelopeSchema, bundle)) {
    (ajvFhir.errors || []).forEach(error => errorsFhir.push(prettyAjvError(error)));
  }

  const bundleValidation = validateAgainstProfile(bundle, bundleProfile, '', bundleIndex);
  errorsProfile.push(...bundleValidation.errors);
  warnings.push(...bundleValidation.warnings);

  asArray(bundle.entry).forEach((entry, idx) => {
    const resource = entry && entry.resource;
    if (!resource || typeof resource !== 'object') {
      addError(errorsProfile, `/entry/${idx}/resource`, 'Missing resource');
      return;
    }

    const ref = fhirDefRef(resource.resourceType);
    if (!ajvFhir.validate(ref, resource)) {
      (ajvFhir.errors || []).forEach(error =>
        errorsFhir.push(prettyAjvError(error, `/entry/${idx}/resource/${resource.resourceType}`))
      );
    }

    const expectedProfile = getExpectedProfile(resource.resourceType);
    if (!expectedProfile) {
      warnings.push({
        path: `/entry/${idx}/resource`,
        message: `No NPS profile loader configured for resourceType "${resource.resourceType}"`
      });
      return;
    }

    const result = validateAgainstProfile(
      resource,
      expectedProfile,
      `/entry/${idx}/resource/${resource.resourceType}`,
      bundleIndex
    );

    errorsProfile.push(...result.errors);
    warnings.push(...result.warnings);
  });

  const errors = [...errorsProfile, ...errorsFhir];

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    validProfile: errorsProfile.length === 0,
    errorsProfile,
    warningsProfile: warnings,
    validFhirR4: errorsFhir.length === 0,
    errorsFhirR4: errorsFhir,
    profilePackage: 'nato.nps.r4',
    profileVersion: '0.1.0'
  };
}

router.post('/', (req, res) => {
  try {
    res.json(validateBundle(req.body));
  } catch (error) {
    res.status(500).json({
      valid: false,
      errors: [{ path: '', message: error.message || 'Profile validation failed' }],
      warnings: []
    });
  }
});

module.exports = router;
