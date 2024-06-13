const axios = require('axios');

async function postIPSBundleNLD(req, res) {
  const ipsBundle = req.body;

  try {
    const response = await axios.post('https://medicalcloud.orange-synapse.nl/api/fhir/1', ipsBundle);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { postIPSBundleNLD };
