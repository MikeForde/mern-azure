const axios = require('axios');

async function postIPSBundleUnified(req, res) {
  const { ipsBundle, endpoint, dataFormat, hl7Wrapper } = req.body;
  // Optionally, transform ipsBundle based on dataFormat if needed.
  // For now, we simply pass ipsBundle to the user-specified endpoint.

  try {
    const response = await axios.post(endpoint, ipsBundle);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { postIPSBundleUnified };
