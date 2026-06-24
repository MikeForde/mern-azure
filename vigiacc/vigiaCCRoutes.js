// vigiacc/vigiaCCRoutes.js

const express = require('express');
const axios = require('axios');

const { generateIPSBundleUnified } = require('../servercontrollers/servercontrollerfuncs/generateIPSBundleUnified');
const { convertIPSBundleToSchema } = require('../servercontrollers/servercontrollerfuncs/convertIPSBundleToSchema');
const { resolveId } = require('../utils/resolveId');

const vigiaRouter = express.Router();
const vigiaIpsMernRouter = express.Router();

const VIGIA_PATIENT_CLOUD_SYSTEM = 'ID_PATIENT_CLOUD';

function getVigiaEndpoint() {
    const endpoint = process.env.VIGIA_ENDPOINT;

    if (!endpoint) {
        throw new Error('VIGIA_ENDPOINT is not defined in .env');
    }

    return endpoint.replace(/\/+$/, '');
}

function normaliseProxyPath(path = '') {
    if (!path || path === '/') return '';
    return path.startsWith('/') ? path : `/${path}`;
}

function passthroughHeaders(req, overrides = {}) {
    const headers = {
        ...req.headers,
        ...overrides
    };

    delete headers.host;
    delete headers.connection;
    delete headers['content-length'];

    return headers;
}

async function requestVigia({
    method = 'GET',
    path = '',
    params,
    data,
    headers = {}
}) {
    const url = `${getVigiaEndpoint()}${normaliseProxyPath(path)}`;

    return axios({
        method,
        url,
        params,
        data,
        headers,
        validateStatus: () => true
    });
}

function relayAxiosResponse(res, response) {
    const contentType = response.headers?.['content-type'];

    if (contentType) {
        res.set('content-type', contentType);
    }

    return res.status(response.status).send(response.data);
}

function cloneJson(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function getBundleFromRequestBody(body) {
    if (body?.resourceType === 'Bundle') {
        return body;
    }

    if (body?.bundle?.resourceType === 'Bundle') {
        return body.bundle;
    }

    throw new Error('Expected a FHIR Bundle in the request body, or in body.bundle');
}

function findPatientEntry(bundle) {
    return bundle?.entry?.find(
        entry => entry?.resource?.resourceType === 'Patient'
    );
}

function getVigiaCloudPatientId(patient) {
    return patient?.identifier?.find(
        identifier => identifier?.system === VIGIA_PATIENT_CLOUD_SYSTEM
    )?.value;
}

function rewritePatientReferences(node, oldPatientId, newPatientId) {
    if (!node || typeof node !== 'object' || !oldPatientId || !newPatientId) {
        return;
    }

    if (Array.isArray(node)) {
        node.forEach(item => rewritePatientReferences(item, oldPatientId, newPatientId));
        return;
    }

    if (typeof node.reference === 'string') {
        const oldRefs = new Set([
            oldPatientId,
            `Patient/${oldPatientId}`,
            `urn:uuid:${oldPatientId}`
        ]);

        if (oldRefs.has(node.reference)) {
            node.reference = `Patient/${newPatientId}`;
        }
    }

    Object.values(node).forEach(value =>
        rewritePatientReferences(value, oldPatientId, newPatientId)
    );
}

function prepareVigiaBundleForSchema(rawBundle, retainAberrantOrganization = false) {
    const bundle = cloneJson(rawBundle);

    // VigiaCC currently returns a non-FHIR top-level Organization.
    // Keep the real Organization entry, but remove the invalid duplicate
    // unless explicitly asked to retain it for demonstration/debugging.
    if (!retainAberrantOrganization) {
        delete bundle.organization;
    }

    const patientEntry = findPatientEntry(bundle);
    const patient = patientEntry?.resource;

    if (!patient) {
        return {
            bundle,
            cloudPatientId: null,
            oldPatientId: null
        };
    }

    const oldPatientId = patient.id;
    const cloudPatientId = getVigiaCloudPatientId(patient);

    if (cloudPatientId) {
        patient.id = cloudPatientId;
        patientEntry.fullUrl = `urn:uuid:${cloudPatientId}`;

        // Future-proofing in case VigiaCC later returns meds, observations, etc.
        rewritePatientReferences(bundle, oldPatientId, cloudPatientId);
    }

    return {
        bundle,
        cloudPatientId,
        oldPatientId
    };
}

function convertVigiaBundleToIpsSchema(rawBundle, options = {}) {

    const {
        retainAberrantOrganization = false
    } = options;

    const {
        bundle,
        cloudPatientId,
        oldPatientId
    } = prepareVigiaBundleForSchema(rawBundle, retainAberrantOrganization);

    const ipsRecord = convertIPSBundleToSchema(bundle);

    // Belt and braces: if the converter uses Patient.id this should already
    // happen, but force it here so Patient.resourceId retains ID_PATIENT_CLOUD.
    if (cloudPatientId && ipsRecord?.patient) {
        ipsRecord.patient.resourceId = cloudPatientId;
    }

    return {
        ipsRecord,
        cleanedBundle: bundle,
        cloudPatientId,
        oldPatientId
    };
}

async function submitNpsBundleToVigia(bundle) {
    if (!bundle || bundle.resourceType !== 'Bundle') {
        throw new Error('submitNpsBundleToVigia expected a FHIR Bundle');
    }

    return requestVigia({
        method: 'POST',
        path: '',
        data: bundle,
        headers: {
            Accept: 'application/fhir+json, application/json',
            'Content-Type': 'application/fhir+json'
        }
    });
}

function wantsCorrectedVigiaBundleOnly(req) {
    const returnMode = String(req.query.return || '').toLowerCase();
    const mode = String(req.query.mode || '').toLowerCase();

    return (
        returnMode === 'vigia' ||
        returnMode === 'bundle' ||
        returnMode === 'cleaned' ||
        mode === 'vigia' ||
        mode === 'bundle' ||
        mode === 'cleaned' ||
        req.query.correctedBundle === 'true'
    );
}

function sendCorrectedVigiaBundle(res, bundle) {
    return res
        .type('application/fhir+json')
        .json(bundle);
}

function retainAberrantOrganization(req) {
    return (
        req.query.retainOrganization === 'true' ||
        req.query.retainAberrantOrganization === 'true' ||
        req.query.showAberrantOrganization === 'true'
    );
}

/**
 * Transparent pass-through.
 *
 * Mounted as:
 *   app.use('/vigia', vigiaRouter)
 *
 * Examples:
 *   GET  /vigia/some/proprietary/path
 *   POST /vigia/
 */
vigiaRouter.use(async (req, res) => {
    try {
        const response = await requestVigia({
            method: req.method,
            path: req.path,
            params: req.query,
            data: ['GET', 'HEAD'].includes(req.method.toUpperCase())
                ? undefined
                : req.body,
            headers: passthroughHeaders(req)
        });

        return relayAxiosResponse(res, response);
    } catch (err) {
        console.error('VigiaCC passthrough error:', err);
        return res.status(500).json({
            error: 'VigiaCC passthrough failed',
            detail: err.message
        });
    }
});

/**
 * POST already-generated NPS FHIR Bundle directly to VigiaCC base endpoint.
 *
 * Body can be either:
 *   { resourceType: "Bundle", ... }
 *
 * or:
 *   { bundle: { resourceType: "Bundle", ... } }
 */
vigiaIpsMernRouter.post('/pushipsvigia', async (req, res) => {
    try {
        const bundle = getBundleFromRequestBody(req.body);
        const response = await submitNpsBundleToVigia(bundle);

        return relayAxiosResponse(res, response);
    } catch (err) {
        console.error('VigiaCC push error:', err);
        return res.status(500).json({
            error: 'Failed to push IPS bundle to VigiaCC',
            detail: err.message
        });
    }
});

async function fetchAndPushIpsVigia(req, res) {
    try {
        const id =
            req.params.packageUUID ||
            req.body?.packageUUID ||
            req.body?.id ||
            req.query?.packageUUID ||
            req.query?.id;

        if (!id) {
            return res.status(400).json({
                error: 'Missing packageUUID or id'
            });
        }

        const ipsRecord = await resolveId(id);
        const bundle = await generateIPSBundleUnified(ipsRecord);

        const response = await submitNpsBundleToVigia(bundle);

        return relayAxiosResponse(res, response);
    } catch (err) {
        console.error('VigiaCC fetch-and-push error:', err);
        return res.status(500).json({
            error: 'Failed to generate and push IPS bundle to VigiaCC',
            detail: err.message
        });
    }
}

vigiaIpsMernRouter.post('/fetchandpushipsvigia', fetchAndPushIpsVigia);
vigiaIpsMernRouter.post('/fetchandpushipsvigia/:packageUUID', fetchAndPushIpsVigia);

/**
 * Convert a VigiaCC-returned NPS bundle into the IPS MERN schema.
 *
 * This:
 *   1. Removes the invalid top-level "organization"
 *   2. Finds Patient.identifier where system === "ID_PATIENT_CLOUD"
 *   3. Copies that value into Patient.id
 *   4. Updates Patient fullUrl
 *   5. Converts using convertIPSBundleToSchema
 *   6. Forces ipsRecord.patient.resourceId to the cloud patient id
 */
vigiaIpsMernRouter.post('/convertvigianps', async (req, res) => {
    try {
        const rawBundle = getBundleFromRequestBody(req.body);
        const result = convertVigiaBundleToIpsSchema(rawBundle, {
            retainAberrantOrganization: retainAberrantOrganization(req)
        });

        if (wantsCorrectedVigiaBundleOnly(req)) {
            return sendCorrectedVigiaBundle(res, result.cleanedBundle);
        }

        if (req.query.debug === 'true') {
            return res.json(result);
        }

        return res.json(result.ipsRecord);
    } catch (err) {
        console.error('VigiaCC conversion error:', err);
        return res.status(500).json({
            error: 'Failed to convert VigiaCC NPS bundle',
            detail: err.message
        });
    }
});

/**
 * Optional helper for proprietary VigiaCC fetch + convert.
 *
 * Body example:
 * {
 *   "path": "/whatever/vigia/uses",
 *   "params": {
 *     "someId": "123"
 *   }
 * }
 */
vigiaIpsMernRouter.post('/fetchvigianps', async (req, res) => {
    try {
        const {
            path = '',
            params,
            body,
            method = 'GET'
        } = req.body || {};

        const response = await requestVigia({
            method,
            path,
            params,
            data: body,
            headers: {
                Accept: 'application/fhir+json, application/json'
            }
        });

        if (response.status >= 400) {
            return relayAxiosResponse(res, response);
        }

        const result = convertVigiaBundleToIpsSchema(response.data, {
            retainAberrantOrganization: retainAberrantOrganization(req)
        });

        if (wantsCorrectedVigiaBundleOnly(req)) {
            return sendCorrectedVigiaBundle(res, result.cleanedBundle);
        }

        if (req.query.debug === 'true') {
            return res.json(result);
        }

        return res.json(result.ipsRecord);
    } catch (err) {
        console.error('VigiaCC fetch/convert error:', err);
        return res.status(500).json({
            error: 'Failed to fetch and convert VigiaCC NPS bundle',
            detail: err.message
        });
    }
});

module.exports = {
    vigiaRouter,
    vigiaIpsMernRouter,
    prepareVigiaBundleForSchema,
    convertVigiaBundleToIpsSchema,
    submitNpsBundleToVigia
};