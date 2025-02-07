const axios = require('axios');

const getIPSBundleGeneric = async (req, res) => {
  const { endpoint, name, givenName } = req.query;
  if (!endpoint || !name || !givenName) {
    return res.status(400).json({ error: 'Missing required query parameters' });
  }
  const fullUrl = `${endpoint}/${name}/${givenName}`;
  try {
    const response = await axios.get(fullUrl);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data from external API:', error.message);
    if (error.response) {
      res.status(error.response.status).json({ error: error.response.data });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = { getIPSBundleGeneric };
