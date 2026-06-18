// healthstaq/healthstaqRoutes.js

const express = require('express');
const axios = require('axios');
const { URLSearchParams } = require('url');

const router = express.Router();

const HEALTHSTAQ_BASE_URL = 'https://healthstaq.bluestaq.com';
const HEALTHSTAQ_TOKEN_URL =
    `${HEALTHSTAQ_BASE_URL}/realms/healthstaq/protocol/openid-connect/token`;

const TOKEN_EXPIRY_BUFFER_MS = 30_000;

const healthStaqApi = axios.create({
    baseURL: HEALTHSTAQ_BASE_URL,
    timeout: 30_000,
});

const allowedResourceTypes = new Set([
    'Patient',
    'Composition',
    'Organization',
    'Condition',
    'AllergyIntolerance',
    'MedicationRequest',
    'MedicationStatement',
    'Observation',
    'Immunization',
    'Procedure',
    'DiagnosticReport',
    'Device',
]);

let cachedToken = null;
let cachedTokenExpiresAt = 0;
let tokenRequestPromise = null;

/**
 * Clear the cached HealthStaq access token.
 */
function clearCachedToken() {
    cachedToken = null;
    cachedTokenExpiresAt = 0;
}

/**
 * Request a client-credentials access token from HealthStaq.
 *
 * The token remains on the backend and is never returned to the frontend.
 */
async function mintAccessToken() {
    const clientId = process.env.STAQ_CLIENT;
    const clientSecret = process.env.STAQ_SECRET;

    if (!clientId || !clientSecret) {
        const error = new Error(
            'HealthStaq credentials are not configured. ' +
            'STAQ_CLIENT and STAQ_SECRET must be present in the environment.'
        );

        error.statusCode = 500;
        throw error;
    }

    const formBody = new URLSearchParams({
        grant_type: 'client_credentials',
    });

    const response = await axios.post(
        HEALTHSTAQ_TOKEN_URL,
        formBody.toString(),
        {
            auth: {
                username: clientId,
                password: clientSecret,
            },
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 15_000,
        }
    );

    const accessToken = response.data?.access_token;

    if (!accessToken) {
        const error = new Error(
            'HealthStaq token response did not contain an access_token.'
        );

        error.statusCode = 502;
        throw error;
    }

    const expiresInSeconds = Number(response.data.expires_in) || 300;

    cachedToken = accessToken;
    cachedTokenExpiresAt =
        Date.now() +
        Math.max(
            (expiresInSeconds * 1000) - TOKEN_EXPIRY_BUFFER_MS,
            1_000
        );

    return cachedToken;
}

/**
 * Return the cached token when it is still valid.
 *
 * tokenRequestPromise prevents multiple simultaneous API requests from
 * minting several tokens at the same time.
 */
async function getAccessToken() {
    if (cachedToken && Date.now() < cachedTokenExpiresAt) {
        return cachedToken;
    }

    if (!tokenRequestPromise) {
        tokenRequestPromise = mintAccessToken()
            .finally(() => {
                tokenRequestPromise = null;
            });
    }

    return tokenRequestPromise;
}

/**
 * Make an authenticated request to HealthStaq.
 *
 * If HealthStaq returns 401, discard the cached token and retry once.
 */
async function requestHealthStaq(config, retryAfterUnauthorized = true) {
    const accessToken = await getAccessToken();

    try {
        return await healthStaqApi.request({
            ...config,
            headers: {
                Accept: 'application/fhir+json',
                ...(config.headers || {}),
                Authorization: `Bearer ${accessToken}`,
            },
        });
    } catch (error) {
        if (
            retryAfterUnauthorized &&
            error.response?.status === 401
        ) {
            clearCachedToken();

            return requestHealthStaq(config, false);
        }

        throw error;
    }
}

/**
 * Relay a successful HealthStaq response while retaining its FHIR
 * Content-Type and HTTP status.
 */
function relayResponse(res, response) {
    const contentType =
        response.headers?.['content-type'] ||
        'application/fhir+json';

    return res
        .status(response.status)
        .set('Content-Type', contentType)
        .send(response.data);
}

/**
 * Relay HealthStaq errors, including FHIR OperationOutcome responses.
 */
function relayError(res, error) {
    if (error.statusCode) {
        return res.status(error.statusCode).json({
            error: error.message,
        });
    }

    if (error.response) {
        const contentType =
            error.response.headers?.['content-type'] ||
            'application/fhir+json';

        return res
            .status(error.response.status)
            .set('Content-Type', contentType)
            .send(error.response.data);
    }

    console.error('HealthStaq request failed:', error.message);

    return res.status(502).json({
        error: 'Unable to communicate with the HealthStaq API.',
    });
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function isValidFhirId(value) {
    return (
        typeof value === 'string' &&
        /^[A-Za-z0-9\-.]{1,64}$/.test(value)
    );
}

function validateResourceType(res, resourceType) {
    if (!allowedResourceTypes.has(resourceType)) {
        res.status(400).json({
            error: `Unsupported HealthStaq resource type: ${resourceType}`,
            allowedResourceTypes: [...allowedResourceTypes],
        });

        return false;
    }

    return true;
}

/**
 * GET /healthstaq/patient?system=<system>&value=<value>
 *
 * Resolve a HealthStaq Patient using an identifier.
 */
router.get('/patient', async (req, res) => {
    const { system, value } = req.query;

    if (!isNonEmptyString(system) || !isNonEmptyString(value)) {
        return res.status(400).json({
            error: 'Query parameters system and value are required.',
        });
    }

    try {
        const response = await requestHealthStaq({
            method: 'GET',
            url: '/Patient',
            params: {
                identifier: `${system.trim()}|${value.trim()}`,
            },
        });

        return relayResponse(res, response);
    } catch (error) {
        return relayError(res, error);
    }
});

/**
 * POST /healthstaq/patient/summary
 *
 * Accept either:
 *
 * {
 *   "system": "...",
 *   "value": "..."
 * }
 *
 * or a complete FHIR Parameters resource.
 */
router.post('/patient/summary', async (req, res) => {
    let parameters;

    if (req.body?.resourceType === 'Parameters') {
        parameters = req.body;
    } else {
        const { system, value } = req.body || {};

        if (!isNonEmptyString(system) || !isNonEmptyString(value)) {
            return res.status(400).json({
                error:
                    'The request must contain system and value, ' +
                    'or be a FHIR Parameters resource.',
            });
        }

        parameters = {
            resourceType: 'Parameters',
            parameter: [
                {
                    name: 'identifier',
                    valueIdentifier: {
                        system: system.trim(),
                        value: value.trim(),
                    },
                },
            ],
        };
    }

    try {
        const response = await requestHealthStaq({
            method: 'POST',
            url: '/Patient/$summary',
            headers: {
                'Content-Type': 'application/fhir+json',
            },
            data: parameters,
        });

        return relayResponse(res, response);
    } catch (error) {
        return relayError(res, error);
    }
});

/**
 * GET /healthstaq/patient/:id/summary
 *
 * Retrieve an IPS document Bundle using the HealthStaq Patient UUID.
 */
router.get('/patient/:id/summary', async (req, res) => {
    const { id } = req.params;

    if (!isValidFhirId(id)) {
        return res.status(400).json({
            error: 'Invalid FHIR Patient id.',
        });
    }

    try {
        const response = await requestHealthStaq({
            method: 'GET',
            url: `/Patient/${encodeURIComponent(id)}/$summary`,
        });

        return relayResponse(res, response);
    } catch (error) {
        return relayError(res, error);
    }
});

/**
 * GET /healthstaq/patient/:id
 *
 * Retrieve the Patient resource itself.
 */
router.get('/patient/:id', async (req, res) => {
    const { id } = req.params;

    if (!isValidFhirId(id)) {
        return res.status(400).json({
            error: 'Invalid FHIR Patient id.',
        });
    }

    try {
        const response = await requestHealthStaq({
            method: 'GET',
            url: `/Patient/${encodeURIComponent(id)}`,
        });

        return relayResponse(res, response);
    } catch (error) {
        return relayError(res, error);
    }
});

/**
 * GET /healthstaq/resource/:resourceType
 *
 * Generic FHIR search.
 *
 * Examples:
 *   /healthstaq/resource/Condition?patient=<id>
 *   /healthstaq/resource/Observation?patient=<id>&_count=20&_offset=0
 */
router.get('/resource/:resourceType', async (req, res) => {
    const { resourceType } = req.params;

    if (!validateResourceType(res, resourceType)) {
        return;
    }

    try {
        const response = await requestHealthStaq({
            method: 'GET',
            url: `/${resourceType}`,
            params: req.query,
        });

        return relayResponse(res, response);
    } catch (error) {
        return relayError(res, error);
    }
});

/**
 * GET /healthstaq/patient/:patientId/resources/:resourceType
 *
 * Search for resources belonging to a HealthStaq Patient.
 *
 * Examples:
 *   /healthstaq/patient/<patient-id>/resources/Condition
 *   /healthstaq/patient/<patient-id>/resources/AllergyIntolerance
 *   /healthstaq/patient/<patient-id>/resources/MedicationRequest
 */
router.get(
    '/patient/:patientId/resources/:resourceType',
    async (req, res) => {
        const { patientId, resourceType } = req.params;

        if (!validateResourceType(res, resourceType)) {
            return;
        }

        if (!isValidFhirId(patientId)) {
            return res.status(400).json({
                error: 'Invalid HealthStaq Patient logical id.',
            });
        }

        try {
            const response = await requestHealthStaq({
                method: 'GET',
                url: `/${resourceType}`,
                params: {
                    patient: patientId,
                    ...req.query,
                },
            });

            return relayResponse(res, response);
        } catch (error) {
            return relayError(res, error);
        }
    }
);

/**
 * GET /healthstaq/resource/:resourceType/:id
 *
 * Generic FHIR instance read.
 */
router.get('/resource/:resourceType/:id', async (req, res) => {
    const { resourceType, id } = req.params;

    if (!validateResourceType(res, resourceType)) {
        return;
    }

    if (!isValidFhirId(id)) {
        return res.status(400).json({
            error: 'Invalid FHIR resource id.',
        });
    }

    try {
        const response = await requestHealthStaq({
            method: 'GET',
            url: `/${resourceType}/${encodeURIComponent(id)}`,
        });

        return relayResponse(res, response);
    } catch (error) {
        return relayError(res, error);
    }
});

/**
 * POST /healthstaq/transaction
 *
 * Send a FHIR transaction Bundle to HealthStaq.
 */
router.post('/transaction', async (req, res) => {
    const bundle = req.body;

    if (
        !bundle ||
        bundle.resourceType !== 'Bundle' ||
        bundle.type !== 'transaction'
    ) {
        return res.status(400).json({
            error:
                'The request body must be a FHIR Bundle with ' +
                'type set to transaction.',
        });
    }

    try {
        const response = await requestHealthStaq({
            method: 'POST',
            url: '/',
            headers: {
                'Content-Type': 'application/fhir+json',
            },
            data: bundle,
        });

        return relayResponse(res, response);
    } catch (error) {
        return relayError(res, error);
    }
});

module.exports = router;