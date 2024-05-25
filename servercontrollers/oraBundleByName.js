// oraBundleByName.js
const axios = require('axios');

const getORABundleByName = async (req, res) => {
  const { name, givenName } = req.params;
  console.log('name:', name, 'givenName:', givenName);

  try {
    const response = await axios.get(`https://4202xiwc.offroadapps.dev:62444/Fhir/ips/json/${name}/${givenName}`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data from external API:', error.message);
    if (error.response) {
      console.error('Status code:', error.response.status);
      console.error('Response data:', error.response.data);
      res.status(error.response.status).json({ error: error.response.data });
    } else if (error.request) {
      console.error('No response received:', error.request);
      res.status(500).json({ error: 'No response received from external API' });
    } else {
      console.error('Error setting up request:', error.message);
      res.status(500).json({ error: 'Error setting up request to external API' });
    }
  }
};

module.exports = { getORABundleByName };
