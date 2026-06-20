// healthstaq/healthstaqRoutes.js

const express = require('express');
require("dotenv").config();
const axios = require('axios');
const { URLSearchParams } = require('url');
const {
    buildHealthStaqTransaction,
} = require('../servercontrollers/convertIPSToHealthStaq');

const { resolveId } = require('../utils/resolveId');

const {
    generateIPSBundleUnified,
} = require(
    '../servercontrollers/servercontrollerfuncs/generateIPSBundleUnified'
);

const healthStaqRouter = express.Router();
const ipsMernRouter = express.Router();

const HEALTHSTAQ_BASE_URL = process.env.STAQ_ENDPOINT;
const HEALTHSTAQ_TOKEN_URL =
    `${HEALTHSTAQ_BASE_URL}/realms/healthstaq/protocol/openid-connect/token`;

const HEALTHSTAQ_UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


const HEALTHSTAQ_DELETE_ORDER = [
    'DiagnosticReport',
    'Procedure',
    'Immunization',
    'Observation',
    'MedicationStatement',
    'MedicationRequest',
    'AllergyIntolerance',
    'Condition',
    'Composition',
    'Device',
    'Patient',
    'Organization',
];

const TOKEN_EXPIRY_BUFFER_MS = 30_000;

const healthStaqApi = axios.create({
    baseURL: HEALTHSTAQ_BASE_URL,
    timeout: 30_000,
});

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
 * Convert an IPS Bundle to a transaction Bundle when necessary,
 * then submit it to the HealthStaq FHIR transaction endpoint.
 */
async function submitBundleToHealthStaq(sourceBundle) {
    if (
        !sourceBundle ||
        sourceBundle.resourceType !== 'Bundle'
    ) {
        const error = new Error(
            'The supplied data must be a FHIR Bundle.'
        );

        error.statusCode = 400;
        throw error;
    }

    const transactionBundle = buildHealthStaqTransaction(sourceBundle);

    return requestHealthStaq({
        method: 'POST',
        url: '/',
        headers: {
            'Content-Type': 'application/fhir+json',
            Accept: 'application/fhir+json',
        },
        data: transactionBundle,
    });
}

/**
 * Forward useful upstream response headers.
 *
 * Content-Length is deliberately not forwarded because Express may
 * re-encode the response body.
 */
function copyResponseHeaders(res, headers = {}) {
    const forwardedHeaders = [
        'content-type',
        'content-location',
        'location',
        'etag',
        'last-modified',
        'retry-after',
        'www-authenticate',
    ];

    for (const headerName of forwardedHeaders) {
        const value = headers[headerName];

        if (value !== undefined) {
            res.set(headerName, value);
        }
    }
}

/**
 * Relay a HealthStaq response without changing the HTTP status or body.
 */
function relayResponse(res, response) {
    copyResponseHeaders(res, response.headers);
    setNoCacheHeaders(res);

    if (!response.headers?.['content-type']) {
        res.type('application/fhir+json');
    }

    return res
        .status(response.status)
        .send(response.data);
}

/**
 * Relay HealthStaq errors, including FHIR OperationOutcome resources.
 */
function relayError(res, error) {
    if (error.statusCode) {
        return res.status(error.statusCode).json({
            error: error.message,
        });
    }

    if (error.response) {
        return relayResponse(res, error.response);
    }

    console.error('HealthStaq request failed:', error.message);

    return res.status(502).json({
        error: 'Unable to communicate with the HealthStaq API.',
    });
}

/**
 * Headers which must not be copied from the caller to HealthStaq.
 *
 * Authorization is always generated by this backend.
 * Content-Length is recalculated by Axios.
 */
const blockedRequestHeaders = new Set([
    'authorization',
    'host',
    'content-length',
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'accept-encoding',
    'cookie',
    'origin',
    'referer',
]);

function buildUpstreamHeaders(req) {
    const headers = {};

    for (const [name, value] of Object.entries(req.headers)) {
        const lowerName = name.toLowerCase();

        if (blockedRequestHeaders.has(lowerName)) {
            continue;
        }

        if (lowerName.startsWith('x-forwarded-')) {
            continue;
        }

        if (lowerName.startsWith('sec-')) {
            continue;
        }

        if (value !== undefined) {
            headers[name] = value;
        }
    }

    /*
     * Supply a sensible default, while allowing callers to request
     * another representation through their own Accept header.
     */
    if (!headers.accept) {
        headers.accept = 'application/fhir+json';
    }

    return headers;
}

const HEALTHSTAQ_DELETE_ORDER_INDEX = new Map(
    HEALTHSTAQ_DELETE_ORDER.map((resourceType, index) => [
        resourceType,
        index,
    ])
);

const HEALTHSTAQ_DELETABLE_TYPES = new Set(
    HEALTHSTAQ_DELETE_ORDER
);

function collectHealthStaqResourcesForDelete(bundle) {
    const resourcesByKey = new Map();

    if (
        !bundle ||
        bundle.resourceType !== 'Bundle' ||
        !Array.isArray(bundle.entry)
    ) {
        throw new Error(
            'Generated IPS data is not a valid FHIR Bundle.'
        );
    }

    for (const entry of bundle.entry) {
        const resource = entry?.resource;

        if (!resource?.resourceType || !resource.id) {
            continue;
        }

        if (!HEALTHSTAQ_DELETABLE_TYPES.has(resource.resourceType)) {
            continue;
        }

        /*
         * Important:
         * Only delete resources whose actual FHIR logical id is a UUID.
         * Do not try to delete pt1, org1, packageUUIDs, MRNs, etc.
         */
        if (!HEALTHSTAQ_UUID_REGEX.test(resource.id)) {
            continue;
        }

        const key = `${resource.resourceType}/${resource.id}`;

        resourcesByKey.set(key, {
            resourceType: resource.resourceType,
            id: resource.id,
            path: key,
        });
    }

    return [...resourcesByKey.values()].sort((a, b) => {
        const aIndex =
            HEALTHSTAQ_DELETE_ORDER_INDEX.get(a.resourceType) ?? 999;

        const bIndex =
            HEALTHSTAQ_DELETE_ORDER_INDEX.get(b.resourceType) ?? 999;

        return aIndex - bIndex;
    });
}

async function deleteHealthStaqResource(resourceToDelete) {
    return requestHealthStaq({
        method: 'DELETE',
        url:
            `/${resourceToDelete.resourceType}/` +
            encodeURIComponent(resourceToDelete.id),
        headers: {
            Accept: 'application/fhir+json',
        },
    });
}

/**
 * POST /healthstaq
 *
 * Accept an IPS FHIR Bundle, convert it into a transaction Bundle,
 * and immediately submit it to HealthStaq.
 *
 * If the supplied Bundle is already a transaction Bundle, it is
 * forwarded unchanged.
 */
ipsMernRouter.post('/pushipshealthstaq', async (req, res) => {
    try {
        const response = await submitBundleToHealthStaq(req.body);

        return relayResponse(res, response);
    } catch (error) {
        return relayError(res, error);
    }
});

/**
 * POST /ipsmern/fetchandpushipshealthstaq
 *
 * Expected body:
 *
 * {
 *   "packageUUID": "..."
 * }
 *
 * Finds the IPS database record, generates the unified/NPS FHIR Bundle,
 * converts it to a transaction Bundle, and submits it to HealthStaq.
 */
ipsMernRouter.post(
    '/fetchandpushipshealthstaq',
    async (req, res) => {
        const packageUUID =
            typeof req.body?.packageUUID === 'string'
                ? req.body.packageUUID.trim()
                : '';

        if (!packageUUID) {
            return res.status(400).json({
                error: 'A packageUUID is required.',
            });
        }

        let ips;

        try {
            ips = await resolveId(packageUUID);
        } catch (error) {
            console.error(
                'HealthStaq database lookup failed:',
                error
            );

            return res.status(500).json({
                error: 'Unable to retrieve the IPS record.',
                details: error.message,
            });
        }

        if (!ips) {
            return res.status(404).json({
                error: 'IPS record not found.',
                packageUUID,
            });
        }

        try {
            /*
             * Generate the same unified/NPS Bundle returned by:
             *
             * GET /ipsunified/:id
             * GET /nps/:id
             *
             * Field protection is deliberately not applied because this
             * Bundle is being submitted to the authorised FHIR server.
             */
            const sourceBundle =
                await generateIPSBundleUnified(ips);

            const response =
                await submitBundleToHealthStaq(sourceBundle);

            return relayResponse(res, response);
        } catch (error) {
            return relayError(res, error);
        }
    }
);

async function deleteIPSFromHealthStaq(req, res) {
    const packageUUID =
        typeof req.params?.packageUUID === 'string'
            ? req.params.packageUUID.trim()
            : typeof req.query?.packageUUID === 'string'
                ? req.query.packageUUID.trim()
                : typeof req.body?.packageUUID === 'string'
                    ? req.body.packageUUID.trim()
                    : '';

    if (!packageUUID) {
        return res.status(400).json({
            error:
                'A packageUUID is required. Supply it in the URL, query string, or JSON body.',
        });
    }

    let ips;

    try {
        ips = await resolveId(packageUUID);
    } catch (error) {
        console.error(
            'HealthStaq delete database lookup failed:',
            error
        );

        return res.status(500).json({
            error: 'Unable to retrieve the IPS record.',
            details: error.message,
        });
    }

    if (!ips) {
        return res.status(404).json({
            error: 'IPS record not found.',
            packageUUID,
        });
    }

    let bundle;
    let resourcesToDelete;

    try {
        bundle = await generateIPSBundleUnified(ips);
        resourcesToDelete =
            collectHealthStaqResourcesForDelete(bundle);
    } catch (error) {
        return res.status(400).json({
            error: error.message,
        });
    }

    if (resourcesToDelete.length === 0) {
        return res.status(400).json({
            error:
                'No deletable HealthStaq resources were found. ' +
                'Only resources with valid UUID logical IDs are deleted.',
            packageUUID,
        });
    }

    const results = [];

    for (const resourceToDelete of resourcesToDelete) {
        try {
            const response =
                await deleteHealthStaqResource(resourceToDelete);

            results.push({
                resource: resourceToDelete.path,
                ok: true,
                status: response.status,
                statusText: response.statusText,
            });
        } catch (error) {
            const upstreamStatus = error.response?.status;

            /*
             * For demo/XP cleanup, already-deleted resources should not
             * stop the rest of the delete sequence.
             */
            results.push({
                resource: resourceToDelete.path,
                ok: upstreamStatus === 404,
                alreadyMissing: upstreamStatus === 404,
                status: upstreamStatus || 502,
                response: error.response?.data || error.message,
            });
        }
    }

    const deleted = results.filter(
        (item) => item.ok && !item.alreadyMissing
    ).length;

    const alreadyMissing = results.filter(
        (item) => item.alreadyMissing
    ).length;

    const failed = results.filter((item) => !item.ok);

    return res.status(failed.length > 0 ? 207 : 200).json({
        ok: failed.length === 0,
        packageUUID,
        attempted: results.length,
        deleted,
        alreadyMissing,
        failed: failed.length,
        results,
    });
}

ipsMernRouter.delete(
    '/deleteipshealthstaq',
    deleteIPSFromHealthStaq
);

ipsMernRouter.delete(
    '/deleteipshealthstaq/:packageUUID',
    deleteIPSFromHealthStaq
);

/**
 * Transparent HealthStaq proxy.
 *
 * Everything after /healthstaq is forwarded to HealthStaq unchanged:
 *
 *   GET  /healthstaq/Condition?patient=123
 *        -> GET /Condition?patient=123
 *
 *   GET  /healthstaq/Patient/123/$summary
 *        -> GET /Patient/123/$summary
 *
 *   POST /healthstaq/Patient/$summary
 *        -> POST /Patient/$summary
 *
 *   POST /healthstaq/
 *        -> POST /
 *
 * The backend adds the HealthStaq Bearer token automatically.
 * 
 * 
 */

function setNoCacheHeaders(res) {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Surrogate-Control': 'no-store',
    });
}

healthStaqRouter.use(async (req, res) => {
    try {
        /*
         * Within a mounted Express router, req.url contains everything
         * after /healthstaq, including the original query string.
         */
        const upstreamPath = req.url || '/';

        /*
         * Prevent an absolute or protocol-relative URL from overriding
         * the fixed Axios baseURL.
         */
        if (
            !upstreamPath.startsWith('/') ||
            upstreamPath.startsWith('//')
        ) {
            return res.status(400).json({
                error: 'Invalid HealthStaq request path.',
            });
        }

        const requestConfig = {
            method: req.method,
            url: upstreamPath,
            headers: buildUpstreamHeaders(req),
        };

        /*
         * Forward the parsed request body for methods which may carry one.
         */
        if (
            req.method !== 'GET' &&
            req.method !== 'HEAD' &&
            req.body !== undefined
        ) {
            requestConfig.data = req.body;
        }

        const response = await requestHealthStaq(requestConfig);

        return relayResponse(res, response);
    } catch (error) {
        return relayError(res, error);
    }
});

module.exports = {
    healthStaqRouter,
    ipsMernRouter,
};