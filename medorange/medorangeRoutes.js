// medorange/medorangeRoutes.js

const express = require('express');
require('dotenv').config();
const axios = require('axios');
const {
    buildHealthStaqTransaction: buildMedOrangeTransaction,
} = require('../servercontrollers/convertIPSToHealthStaq');

const { resolveId } = require('../utils/resolveId');

const {
    generateIPSBundleUV,
} = require(
    '../servercontrollers/servercontrollerfuncs/generateIPSBundleUV'
);

const medOrangeRouter = express.Router();
const medOrangeIpsMernRouter = express.Router();

const MEDORANGE_BASE_URL = process.env.MEDORANGE_ENDPOINT;

const MEDORANGE_DELETE_ORDER = [
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

const medOrangeApi = axios.create({
    baseURL: MEDORANGE_BASE_URL,
    timeout: 30_000,
});

function assertMedOrangeConfigured() {
    if (!MEDORANGE_BASE_URL) {
        const error = new Error(
            'MEDORANGE_ENDPOINT is not configured in the environment.'
        );

        error.statusCode = 500;
        throw error;
    }
}

/**
 * Make an unauthenticated request to the MedOrange FHIR API.
 */
async function requestMedOrange(config) {
    console.log("asserting...");
    assertMedOrangeConfigured();

    return medOrangeApi.request({
        ...config,
        headers: {
            Accept: 'application/fhir+json',
            ...(config.headers || {}),
        },
    });
}

/**
 * Convert an IPS Bundle to a transaction Bundle when necessary,
 * then submit it to the MedOrange FHIR transaction endpoint.
 */
async function submitBundleToMedOrange(sourceBundle) {
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

    const transactionBundle = buildMedOrangeTransaction(sourceBundle);

    return requestMedOrange({
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

function setNoCacheHeaders(res) {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'Surrogate-Control': 'no-store',
    });
}

/**
 * Relay a MedOrange response without changing the HTTP status or body.
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
 * Relay MedOrange errors, including FHIR OperationOutcome resources.
 */
function relayError(res, error) {
    if (error.statusCode) {
        return res.status(error.statusCode).json({
            error: error.message,
        });
    }

    if (error.response) {
        console.error(
            "MedOrange upstream error:",
            error.response.status,
            JSON.stringify(error.response.data, null, 2)
        );

        return relayResponse(res, error.response);
    }

    console.error('MedOrange request failed:', error.message);

    return res.status(502).json({
        error: 'Unable to communicate with the MedOrange FHIR API.',
    });
}

/**
 * Headers which must not be copied from the caller to MedOrange.
 *
 * Authorization and Cookie are deliberately not forwarded, even though
 * MedOrange currently does not require tokens.
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

const MEDORANGE_DELETE_ORDER_INDEX = new Map(
    MEDORANGE_DELETE_ORDER.map((resourceType, index) => [
        resourceType,
        index,
    ])
);

const MEDORANGE_DELETABLE_TYPES = new Set(
    MEDORANGE_DELETE_ORDER
);

function collectMedOrangeResourcesForDelete(bundle) {
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

        if (!MEDORANGE_DELETABLE_TYPES.has(resource.resourceType)) {
            continue;
        }

        /*
         * MedOrange does not require UUID logical IDs, so delete any
         * supported resource that has a FHIR logical id.
         */
        const key = `${resource.resourceType}/${resource.id}`;

        resourcesByKey.set(key, {
            resourceType: resource.resourceType,
            id: resource.id,
            path: key,
        });
    }

    return [...resourcesByKey.values()].sort((a, b) => {
        const aIndex =
            MEDORANGE_DELETE_ORDER_INDEX.get(a.resourceType) ?? 999;

        const bIndex =
            MEDORANGE_DELETE_ORDER_INDEX.get(b.resourceType) ?? 999;

        return aIndex - bIndex;
    });
}

async function deleteMedOrangeResource(resourceToDelete) {
    return requestMedOrange({
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
 * POST /ipsmern/pushipsmedorange
 *
 * Accept an IPS FHIR Bundle, convert it into a transaction Bundle,
 * and immediately submit it to MedOrange.
 *
 * If the supplied Bundle is already a transaction Bundle, it is
 * forwarded unchanged by the transaction builder.
 */
medOrangeIpsMernRouter.post('/pushipsmedorange', async (req, res) => {
    try {
        const response = await submitBundleToMedOrange(req.body);

        return relayResponse(res, response);
    } catch (error) {
        return relayError(res, error);
    }
});

/**
 * POST /ipsmern/fetchandpushipsmedorange
 *
 * Expected body:
 *
 * {
 *   "packageUUID": "..."
 * }
 *
 * Finds the IPS database record, generates the unified/NPS FHIR Bundle,
 * converts it to a transaction Bundle, and submits it to MedOrange.
 */
medOrangeIpsMernRouter.post(
    '/fetchandpushipsmedorange',
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
                'MedOrange database lookup failed:',
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
             * Bundle is being submitted to the configured FHIR server.
             */
            const sourceBundle =
                await generateIPSBundleUV(ips);

            console.log(sourceBundle);

            const response =
                await submitBundleToMedOrange(sourceBundle);

            console.log("response = " + response);

            return relayResponse(res, response);
        } catch (error) {
            return relayError(res, error);
        }
    }
);

async function deleteIPSFromMedOrange(req, res) {
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
            'MedOrange delete database lookup failed:',
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
        bundle = await generateIPSBundleUV(ips);
        resourcesToDelete =
            collectMedOrangeResourcesForDelete(bundle);
    } catch (error) {
        return res.status(400).json({
            error: error.message,
        });
    }

    if (resourcesToDelete.length === 0) {
        return res.status(400).json({
            error:
                'No deletable MedOrange resources were found. ' +
                'Only supported resources with FHIR logical IDs can be deleted.',
            packageUUID,
        });
    }

    const results = [];

    for (const resourceToDelete of resourcesToDelete) {
        try {
            const response =
                await deleteMedOrangeResource(resourceToDelete);

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

medOrangeIpsMernRouter.delete(
    '/deleteipsmedorange',
    deleteIPSFromMedOrange
);

medOrangeIpsMernRouter.delete(
    '/deleteipsmedorange/:packageUUID',
    deleteIPSFromMedOrange
);

/**
 * Transparent MedOrange proxy.
 *
 * Everything after /medorange is forwarded to MedOrange unchanged:
 *
 *   GET  /medorange/Condition?patient=123
 *        -> GET /Condition?patient=123
 *
 *   GET  /medorange/Patient/123/$summary
 *        -> GET /Patient/123/$summary
 *
 *   POST /medorange/Patient/$summary
 *        -> POST /Patient/$summary
 *
 *   POST /medorange/
 *        -> POST /
 *
 * The backend does not add a Bearer token.
 */
medOrangeRouter.use(async (req, res) => {
    try {
        /*
         * Within a mounted Express router, req.url contains everything
         * after /medorange, including the original query string.
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
                error: 'Invalid MedOrange request path.',
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

        const response = await requestMedOrange(requestConfig);

        return relayResponse(res, response);
    } catch (error) {
        return relayError(res, error);
    }
});

module.exports = {
    medOrangeRouter,
    medOrangeIpsMernRouter,
};