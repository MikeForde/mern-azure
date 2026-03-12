const axios = require('axios');

const { getIPSBundle } = require('../servercontrollers/ipsBundleFormat');
const { getIPSBundleNHSSCR } = require('../servercontrollers/ipsBundleFormatNHSSCR');
const { getIPSBundleEPS } = require('../servercontrollers/ipsBundleFormatEPS');
const { getIPSBundleByName } = require('../servercontrollers/ipsBundleByName');
const { getORABundleByName } = require('../servercontrollers/oraBundleByName');
const { getIPSLegacyBundle } = require('../servercontrollers/ipsBundleFormat_old');
const { getIPSUnifiedBundle } = require('../servercontrollers/ipsBundleFormatUnified');
const { getIPSUnifiedBundleSplit } = require('../servercontrollers/ipsBundleFormatUnifiedSplit');
const { getIPSDataSplitPOC } = require('../servercontrollers/ipsDataSplitPOC');
const { getIPSXMLBundle } = require('../servercontrollers/ipsXMLBundleFormat');
const { getIPSRaw, getAllIPS, getAllIPSList } = require('../servercontrollers/ipsDatabaseFormats');
const { getMongoFormatted } = require('../servercontrollers/ipsMongoDisplayFormat');
const { getIPSBasic } = require('../servercontrollers/ipsBasicFormat');
const { getIPSBEER } = require('../servercontrollers/ipsBEERFormat');
const { getIPSHL72_x } = require('../servercontrollers/ipsHL72xFormat');
const { getIPSPlainText } = require('../servercontrollers/ipsPlainTextFormat');
const { addIPS, addIPSMany } = require('../servercontrollers/ipsNewRecord');
const { addIPSFromBundle } = require('../servercontrollers/ipsNewRecordFromBundle');
const { addIPSFromBEER } = require('../servercontrollers/ipsNewRecordFromBEER');
const { addIPSFromCDA } = require('../servercontrollers/addIPSFromCDA');
const { addIPSFromHL72x } = require('../servercontrollers/ipsNewRecordFromHL72x');
const { postIPSBundle } = require('../servercontrollers/postIPSBundle');
const { postIPSBundleNLD } = require('../servercontrollers/postIPSBundleNLD');
const { postIPSBundleUnified } = require('../servercontrollers/puships');
const { updateIPS, deleteIPS, deleteIPSbyPractitioner } = require('../servercontrollers/ipsCRUD_UD');
const { getIPSSearch } = require('../servercontrollers/ipsRecordSearch');
const { convertMongoToBEER } = require('../servercontrollers/convertMongoToBEER');
const { convertMongoToHL72_x } = require('../servercontrollers/convertMongoToHL72_x');
const { convertBEERToMongo } = require('../servercontrollers/convertBEERToMongo');
const { convertBEERToIPS } = require('../servercontrollers/convertBEERToIPS');
const { convertIPSToBEER } = require('../servercontrollers/convertIPSToBEER');
const { convertIPSToPlainText } = require('../servercontrollers/convertIPSToPlainText');
const { convertIPSToMongo } = require('../servercontrollers/convertIPSToMongo');
const { updateIPSByUUID } = require('../servercontrollers/updateIPSRecordByUUID');
const { convertCDAToIPS } = require('../servercontrollers/convertCDAToIPS');
const { convertCDAToBEER } = require('../servercontrollers/convertCDAToBEER');
const { convertCDAToMongo } = require('../servercontrollers/convertCDAToMongo');
const { convertHL72_xToMongo } = require('../servercontrollers/convertHL72_xToMongo');
const { convertHL72_xToIPS } = require('../servercontrollers/convertHL72_xToIPS');
const { convertXmlEndpoint } = require('../servercontrollers/convertXmlEndpoint');
const { convertFhirXmlEndpoint } = require('../servercontrollers/convertFhirXmlEndpoint');
const { get } = require('mongoose');

const PORT = process.env.PORT || 5049;
const INTERNAL_BASE_URL =
  process.env.INTERNAL_GRAPHQL_REST_BASE_URL || `http://127.0.0.1:${PORT}`;

function parseJsonInput(jsonText) {
  try {
    return JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Invalid JSON string supplied to GraphQL mutation: ${err.message}`);
  }
}

function stringifyContent(data) {
  if (data === null || data === undefined) return '';
  if (typeof data === 'string') return data;
  return JSON.stringify(data);
}

function toApiResult(result, fallbackId = null) {
  return {
    id: result.id || fallbackId || null,
    status: result.status || 200,
    contentType: result.contentType || 'application/json',
    content: stringifyContent(result.body),
    message: result.message || null,
  };
}

function toMutationResult(result, fallbackId = null) {
  const status = result.status || 200;
  return {
    ok: status >= 200 && status < 300,
    id: result.id || fallbackId || null,
    status,
    contentType: result.contentType || 'application/json',
    content: stringifyContent(result.body),
    message: result.message || null,
  };
}

async function callController(controller, req = {}) {
  return new Promise((resolve, reject) => {
    let finished = false;

    const finish = (payload) => {
      if (!finished) {
        finished = true;
        resolve(payload);
      }
    };

    const res = {
      statusCode: 200,
      headers: {},
      locals: {},

      status(code) {
        this.statusCode = code;
        return this;
      },

      set(field, value) {
        if (typeof field === 'string') {
          this.headers[field.toLowerCase()] = value;
        } else if (field && typeof field === 'object') {
          Object.keys(field).forEach((k) => {
            this.headers[k.toLowerCase()] = field[k];
          });
        }
        return this;
      },

      header(field, value) {
        this.headers[field.toLowerCase()] = value;
        return this;
      },

      type(value) {
        this.headers['content-type'] = value;
        return this;
      },

      json(data) {
        finish({
          status: this.statusCode,
          contentType: this.headers['content-type'] || 'application/json',
          body: data,
        });
        return this;
      },

      send(data) {
        finish({
          status: this.statusCode,
          contentType:
            this.headers['content-type'] ||
            (typeof data === 'string' ? 'text/plain' : 'application/json'),
          body: data,
        });
        return this;
      },

      end(data) {
        finish({
          status: this.statusCode,
          contentType: this.headers['content-type'] || 'text/plain',
          body: data || '',
        });
        return this;
      }
    };

    try {
      const maybePromise = controller(req, res);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

async function callInternalREST(method, url, data, headers = {}) {
  const response = await axios({
    method,
    url: `${INTERNAL_BASE_URL}${url}`,
    data,
    headers,
    validateStatus: () => true,
  });

  return {
    status: response.status,
    contentType: response.headers['content-type'] || 'application/json',
    body: response.data,
    message: typeof response.data === 'string' ? response.data : null,
  };
}

function mapArrayToApiResults(arr) {
  return (arr || []).map((item, index) => ({
    id: item?._id || item?.id || item?.packageUUID || String(index),
    status: 200,
    contentType: 'application/json',
    content: stringifyContent(item),
    message: null,
  }));
}

const resolvers = {
  Query: {
    getAllIPS: async () => {
      const result = await callController(getAllIPS, {});
      const data = Array.isArray(result.body) ? result.body : [];
      return mapArrayToApiResults(data);
    },

    getAllIPSList: async () => {
      const result = await callController(getAllIPSList, {});
      const data = Array.isArray(result.body) ? result.body : [];
      return mapArrayToApiResults(data);
    },

    getIPSRaw: async (_, { id }) => {
      const result = await callController(getIPSRaw, {
        params: { id },
        query: {},
        headers: {},
      });
      return toApiResult(result, id);
    },

    getIPSMongo: async (_, { id }) => {
      const result = await callController(getMongoFormatted, {
        params: { id },
        query: {},
        headers: {},
      });
      return toApiResult(result, id);
    },

    getIPSExpanded: async (_, { id, narrative, resourceNarrative }) => {
      const result = await callController(getIPSBundle, {
        params: { id },
        query: {
          narrative: String(narrative ?? 0),
          resourceNarrative: String(resourceNarrative ?? 0),
        },
        headers: {},
      });
      return toApiResult(result, id);
    },

    getIPSNhsScr: async (_, { id, narrative, resourceNarrative }) => {
      const result = await callController(getIPSBundleNHSSCR, {
        params: { id },
        query: {
          narrative: String(narrative ?? 0),
          resourceNarrative: String(resourceNarrative ?? 0),
        },
        headers: {},
      });
      return toApiResult(result, id);
    },

    getIPSEPS: async (_, { id, narrative, resourceNarrative }) => {
      const result = await callController(getIPSBundleEPS, {
        params: { id },
        query: {
          narrative: String(narrative ?? 0),
          resourceNarrative: String(resourceNarrative ?? 0),
        },
        headers: {},
      });
      return toApiResult(result, id);
    },

    getIPSUnified: async (_, { id }) => {
      const result = await callController(getIPSUnifiedBundle, {
        params: { id },
        query: {},
        headers: {},
      });
      return toApiResult(result, id);
    },

    getIPSLegacy: async (_, { id }) => {
      const result = await callController(getIPSLegacyBundle, {
        params: { id },
        query: {},
        headers: {},
      });
      return toApiResult(result, id);
    },

    getIPSXML: async (_, { id }) => {
      const result = await callController(getIPSXMLBundle, {
        params: { id },
        query: {},
        headers: {},
      });
      return toApiResult(result, id);
    },

    getIPSBasic: async (_, { id }) => {
      const result = await callController(getIPSBasic, {
        params: { id },
        query: {},
        headers: {},
      });
      return toApiResult(result, id);
    },

    getIPSPlainText: async (_, { id }) => {
      const result = await callController(getIPSPlainText, {
        params: { id },
        query: {},
        headers: {},
      });
      return toApiResult(result, id);
    },

    getIPSBeer: async (_, { id, delim }) => {
      const result = await callController(getIPSBEER, {
        params: { id, delim: delim || '' },
        query: {},
        headers: {},
      });
      return toApiResult(result, id);
    },

    getIPSHL72_x: async (_, { id }) => {
      const result = await callController(getIPSHL72_x, {
        params: { id },
        query: {},
        headers: {},
      });
      return toApiResult(result, id);
    },

    getNPS: async (_, { id, protect }) => {
      const result = await callController(getIPSUnifiedBundle, {
        params: { id },
        query: { protect: String(protect ?? 0) },
        headers: {},
      });
      return toApiResult(result, id);
    },

    getNPSNFC: async (_, { id, protect }) => {
      const result = await callController(getIPSUnifiedBundleSplit, {
        params: { id },
        query: { protect: String(protect ?? 0) },
        headers: {},
      });
      return toApiResult(result, id);
    },

    getIPSDataSplitPOC: async (_, { id }) => {
      const result = await callController(getIPSDataSplitPOC, {
        params: { id },
        query: {},
        headers: {},
      });
      return toApiResult(result, id);
    },

    getIPSByName: async (_, { name, given, format }) => {
      const result = await callController(getIPSBundleByName, {
        params: { name, given },
        query: {},
        headers: { 'x-ips-format': format || 'unified' },
      });

      let parsed = result.body;
      let fallbackId = null;

      if (parsed && typeof parsed === 'object') {
        fallbackId = parsed.id || parsed.packageUUID || null;
      }

      return toApiResult(result, fallbackId);
    },

    searchIPS: async (_, { name }) => {
      const result = await callController(getIPSSearch, {
        params: { name },
        query: {},
        headers: {},
      });
      const data = Array.isArray(result.body) ? result.body : [];
      return mapArrayToApiResults(data);
    },

    fetchIPSORA: async (_, { name, givenName }) => {
      const result = await callController(getORABundleByName, {
        params: { name, givenName },
        query: {},
        headers: {},
      });
      return toApiResult(result);
    },

    xmppTestSendMessage: async (_, { msg }) => {
      const query = msg ? `?msg=${encodeURIComponent(msg)}` : '';
      const result = await callInternalREST('get', `/xmpp/test-send-message${query}`);
      return toApiResult(result);
    },

    takBrowser: async (_, { id }) => {
      const result = await callInternalREST('get', `/tak/browser/${encodeURIComponent(id)}`);
      return toApiResult(result, id);
    },
  },

  Mutation: {
    addIPS: async (_, { json }) => {
      const result = await callController(addIPS, {
        body: parseJsonInput(json),
        params: {},
        query: {},
        headers: { 'content-type': 'application/json' },
      });
      return toMutationResult(result);
    },

    addIPSMany: async (_, { json }) => {
      const result = await callController(addIPSMany, {
        body: parseJsonInput(json),
        params: {},
        query: {},
        headers: { 'content-type': 'application/json' },
      });
      return toMutationResult(result);
    },

    addIPSFromBundle: async (_, { json }) => {
      const result = await callController(addIPSFromBundle, {
        body: parseJsonInput(json),
        params: {},
        query: {},
        headers: { 'content-type': 'application/json' },
      });
      return toMutationResult(result);
    },

    pushIPSORA: async (_, { json }) => {
      const result = await callController(postIPSBundle, {
        body: parseJsonInput(json),
        params: {},
        query: {},
        headers: { 'content-type': 'application/json' },
      });
      return toMutationResult(result);
    },

    pushIPSNLD: async (_, { json }) => {
      const result = await callController(postIPSBundleNLD, {
        body: parseJsonInput(json),
        params: {},
        query: {},
        headers: { 'content-type': 'application/json' },
      });
      return toMutationResult(result);
    },

    pushIPS: async (_, { json }) => {
      const result = await callController(postIPSBundleUnified, {
        body: parseJsonInput(json),
        params: {},
        query: {},
        headers: { 'content-type': 'application/json' },
      });
      return toMutationResult(result);
    },

    addIPSFromBEER: async (_, { text }) => {
      const result = await callController(addIPSFromBEER, {
        body: text,
        params: {},
        query: {},
        headers: { 'content-type': 'text/plain' },
      });
      return toMutationResult(result);
    },

    addIPSFromCDA: async (_, { xml }) => {
      const result = await callController(addIPSFromCDA, {
        body: xml,
        params: {},
        query: {},
        headers: { 'content-type': 'application/xml' },
      });
      return toMutationResult(result);
    },

    addIPSFromHL72x: async (_, { text }) => {
      const result = await callController(addIPSFromHL72x, {
        body: text,
        params: {},
        query: {},
        headers: { 'content-type': 'text/plain' },
      });
      return toMutationResult(result);
    },

    convertMongoToBEER: async (_, { json }) => {
      const result = await callController(convertMongoToBEER, {
        body: parseJsonInput(json),
        params: {},
        query: {},
        headers: { 'content-type': 'application/json' },
      });
      return toMutationResult(result);
    },

    convertMongoToHL72x: async (_, { json }) => {
      const result = await callController(convertMongoToHL72_x, {
        body: parseJsonInput(json),
        params: {},
        query: {},
        headers: { 'content-type': 'application/json' },
      });
      return toMutationResult(result);
    },

    convertBEERToMongo: async (_, { text }) => {
      const result = await callController(convertBEERToMongo, {
        body: text,
        params: {},
        query: {},
        headers: { 'content-type': 'text/plain' },
      });
      return toMutationResult(result);
    },

    convertBEERToIPS: async (_, { text, format }) => {
      const result = await callController(convertBEERToIPS, {
        body: text,
        params: {},
        query: {},
        headers: {
          'content-type': 'text/plain',
          'x-ips-format': format || 'unified',
        },
      });
      return toMutationResult(result);
    },

    convertIPSToBEER: async (_, { json }) => {
      const result = await callController(convertIPSToBEER, {
        body: parseJsonInput(json),
        params: {},
        query: {},
        headers: { 'content-type': 'application/json' },
      });
      return toMutationResult(result);
    },

    convertIPSToPlainText: async (_, { json }) => {
      const result = await callController(convertIPSToPlainText, {
        body: parseJsonInput(json),
        params: {},
        query: {},
        headers: { 'content-type': 'application/json' },
      });
      return toMutationResult(result);
    },

    convertIPSToMongo: async (_, { json }) => {
      const result = await callController(convertIPSToMongo, {
        body: parseJsonInput(json),
        params: {},
        query: {},
        headers: { 'content-type': 'application/json' },
      });
      return toMutationResult(result);
    },

    convertCDAToIPS: async (_, { xml, format }) => {
      const result = await callController(convertCDAToIPS, {
        body: xml,
        params: {},
        query: {},
        headers: {
          'content-type': 'application/xml',
          'x-ips-format': format || 'unified',
        },
      });
      return toMutationResult(result);
    },

    convertCDAToBEER: async (_, { xml }) => {
      const result = await callController(convertCDAToBEER, {
        body: xml,
        params: {},
        query: {},
        headers: { 'content-type': 'application/xml' },
      });
      return toMutationResult(result);
    },

    convertCDAToMongo: async (_, { xml }) => {
      const result = await callController(convertCDAToMongo, {
        body: xml,
        params: {},
        query: {},
        headers: { 'content-type': 'application/xml' },
      });
      return toMutationResult(result);
    },

    convertHL72xToMongo: async (_, { text }) => {
      const result = await callController(convertHL72_xToMongo, {
        body: text,
        params: {},
        query: {},
        headers: { 'content-type': 'text/plain' },
      });
      return toMutationResult(result);
    },

    convertHL72xToIPS: async (_, { text, format }) => {
      const result = await callController(convertHL72_xToIPS, {
        body: text,
        params: {},
        query: {},
        headers: {
          'content-type': 'text/plain',
          'x-ips-format': format || 'unified',
        },
      });
      return toMutationResult(result);
    },

    convertXML: async (_, { xml }) => {
      const result = await callController(convertXmlEndpoint, {
        body: xml,
        params: {},
        query: {},
        headers: { 'content-type': 'application/xml' },
      });
      return toMutationResult(result);
    },

    convertFHIRXML: async (_, { xml }) => {
      const result = await callController(convertFhirXmlEndpoint, {
        body: xml,
        params: {},
        query: {},
        headers: { 'content-type': 'application/xml' },
      });
      return toMutationResult(result);
    },

    validateNPS: async (_, { json }) => {
      const result = await callInternalREST('post', '/npsVal', parseJsonInput(json), {
        'content-type': 'application/json',
      });
      return toMutationResult(result);
    },

    validateNhsScr: async (_, { json }) => {
      const result = await callInternalREST('post', '/ipsNhsScrVal', parseJsonInput(json), {
        'content-type': 'application/json',
      });
      return toMutationResult(result);
    },

    validateEps: async (_, { json }) => {
      const result = await callInternalREST('post', '/epsVal', parseJsonInput(json), {
        'content-type': 'application/json',
      });
      return toMutationResult(result);
    },

    updateIPS: async (_, { id, json }) => {
      const result = await callController(updateIPS, {
        body: parseJsonInput(json),
        params: { id },
        query: {},
        headers: { 'content-type': 'application/json' },
      });
      return toMutationResult(result, id);
    },

    updateIPSByUUID: async (_, { uuid, json }) => {
      const result = await callController(updateIPSByUUID, {
        body: parseJsonInput(json),
        params: { uuid },
        query: {},
        headers: { 'content-type': 'application/json' },
      });
      return toMutationResult(result, uuid);
    },

    deleteIPS: async (_, { id }) => {
      const result = await callController(deleteIPS, {
        body: {},
        params: { id },
        query: {},
        headers: {},
      });
      return toMutationResult(result, id);
    },

    deleteIPSByPractitioner: async (_, { practitioner }) => {
      const result = await callController(deleteIPSbyPractitioner, {
        body: {},
        params: { practitioner },
        query: {},
        headers: {},
      });
      return toMutationResult(result);
    },

    xmppPost: async (_, { msg, room }) => {
      const payload = room ? { msg, room } : { msg };
      const result = await callInternalREST('post', '/xmpp/xmpp-post', payload, {
        'content-type': 'application/json',
      });
      return toMutationResult(result);
    },

    xmppSendIPS: async (_, { id }) => {
      const result = await callInternalREST('post', '/xmpp/xmpp-ips', { id }, {
        'content-type': 'application/json',
      });
      return toMutationResult(result, id);
    },

    xmppSendIPSPrivate: async (_, { id, from }) => {
      const result = await callInternalREST(
        'post',
        '/xmpp/xmpp-ips-private',
        { id, from },
        { 'content-type': 'application/json' }
      );
      return toMutationResult(result, id);
    },

    takTest: async (_, { cot }) => {
      const payload = cot ? { cot } : {};
      const result = await callInternalREST('post', '/tak/test', payload, {
        'content-type': 'application/json',
      });
      return toMutationResult(result);
    },

    takIPS: async (_, { id }) => {
      const result = await callInternalREST('post', '/tak/ips', { id }, {
        'content-type': 'application/json',
      });
      return toMutationResult(result, id);
    },
  },
};

module.exports = resolvers;