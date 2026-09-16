const axios = require('axios');

// Fixed allowlist of push targets. The client may only select a key here —
// never supply a URL directly — to prevent SSRF via arbitrary endpoints.
const TARGET_URLS = {
  'ips-sern': 'https://ips-d2s-uksc-medsnomed-medsno.apps.ocp1.azure.dso.digital.mod.uk/ipsbundle',
  'nld': 'https://medicalcloud-test-int.orange-synapse.nl/api/fhir/1',
  'vitalsiq': 'https://4202xiwc.offroadapps.dev:62444/Fhir/ips/json',
};

async function postIPSBundleUnified(req, res) {
  const { ipsBundle, target, dataFormat, hl7Wrapper } = req.body;

  const endpoint = TARGET_URLS[target];
  if (!endpoint) {
    return res.status(400).json({ error: 'Unrecognized push target' });
  }

  // Optionally, transform ipsBundle based on dataFormat if needed.
  // For now, we simply pass ipsBundle to the resolved endpoint.

  try {
    const response = await axios.post(endpoint, ipsBundle, {
      maxRedirects: 0,
      timeout: 10000,
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { postIPSBundleUnified, TARGET_URLS };
