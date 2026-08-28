const express = require('express');
const axios = require('axios');

const router = express.Router();

const EXTERNAL_VALIDATORS = [
  {
    name: 'hl7',
    url: 'https://hl7-ips-server.hl7.org/fhir/Bundle/$validate'
  },
  {
    name: 'tx',
    url: 'https://tx.ontoserver.csiro.au/fhir/Bundle/$validate'
  }
];

function isErrorIssue(issue) {
  const severity = String(issue?.severity || '').toLowerCase();
  return severity === 'error' || severity === 'fatal';
}

function getIssuePath(issue) {
  return issue?.expression?.[0] || issue?.location?.[0] || '';
}

function getIssueMessage(issue) {
  return issue?.diagnostics || issue?.details?.text || issue?.code || 'Validation error';
}

function normalizePath(path) {
  return String(path || '')
    .replace(/\/\*[A-Za-z]+\/[^*]*\*\//g, (match) => {
      const resourceType = match.match(/^\/\*([A-Za-z]+)\//)?.[1];
      return resourceType ? `/*${resourceType}*/` : match;
    })
    .replace(/\/null\*\//g, '*/')
    .trim();
}

function normalizeMessage(message) {
  return String(message || '')
    .replace(/^Details for .*? matching against profile .*? - /i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildIssueKey(issue) {
  const path = normalizePath(getIssuePath(issue));
  const message = normalizeMessage(getIssueMessage(issue));
  return `${path}::${message.toLowerCase()}`;
}

function simplifyIssue(issue, sourceNames) {
  return {
    severity: issue.severity,
    path: getIssuePath(issue),
    message: getIssueMessage(issue),
    sources: sourceNames
  };
}

function mergeExternalIssues(results) {
  const merged = new Map();

  for (const result of results) {
    const issues = Array.isArray(result?.data?.issue) ? result.data.issue : [];

    for (const issue of issues) {
      if (!isErrorIssue(issue)) continue;

      const key = buildIssueKey(issue);
      const existing = merged.get(key);

      if (existing) {
        if (!existing.sources.includes(result.name)) {
          existing.sources.push(result.name);
        }
        continue;
      }

      merged.set(key, simplifyIssue(issue, [result.name]));
    }
  }

  return Array.from(merged.values());
}

async function callExternalValidator(validator, payload) {
  const response = await axios.post(validator.url, payload, {
    headers: {
      Accept: 'application/fhir+json, application/json',
      'Content-Type': 'application/fhir+json'
    },
    timeout: 30000,
    validateStatus: () => true
  });

  if (response.status >= 200 && response.status < 300) {
    return { name: validator.name, data: response.data };
  }

  const message = response.data?.issue?.[0]?.diagnostics
    || response.data?.message
    || `Validator returned HTTP ${response.status}`;
  const error = new Error(`${validator.name} validator failed: ${message}`);
  error.status = response.status;
  throw error;
}

router.post('/', async (req, res) => {
  try {
    const results = await Promise.all(
      EXTERNAL_VALIDATORS.map((validator) => callExternalValidator(validator, req.body))
    );

    const errors = mergeExternalIssues(results);

    res.json({
      valid: errors.length === 0,
      errors,
      warnings: [],
      validNps: errors.length === 0,
      errorsNps: errors,
      warningsNps: [],
      validFhirR4: true,
      errorsFhirR4: []
    });
  } catch (error) {
    res.status(502).json({
      valid: false,
      errors: [
        {
          path: '',
          message: error.message || 'External validation failed'
        }
      ],
      warnings: []
    });
  }
});

module.exports = router;
module.exports.mergeExternalIssues = mergeExternalIssues;
