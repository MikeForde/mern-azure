const axios = require('axios');

const endpointMap = {
  'ips-sern': 'https://ips-d2s-uksc-medsnomed-medsno.apps.ocp1.azure.dso.digital.mod.uk/ipsbyname',
  'ips-mern-azure': 'https://ipsmern-dep.azurewebsites.net/ipsbyname',
  'vitalsiq': 'https://4202xiwc.offroadapps.dev:62444/Fhir/ips/json',
};

const getIPSBundleGeneric = async (req, res) => {
  const { target, name, givenName } = req.query;

  if (!target || !name || !givenName) {
    return res.status(400).json({
      error: 'Missing required query parameters',
    });
  }

  const endpoint = endpointMap[target];

  if (!endpoint) {
    return res.status(400).json({
      error: 'Invalid target endpoint',
    });
  }

  const safeName = encodeURIComponent(name);
  const safeGivenName = encodeURIComponent(givenName);

  const fullUrl = `${endpoint}/${safeName}/${safeGivenName}`;

  try {
    const response = await axios.get(fullUrl, {
      timeout: 10000,
      maxRedirects: 0,
    });

    return res.json(response.data);
  } catch (error) {
    console.error(
      `Error fetching data from external API target ${target}:`,
      error.message
    );

    if (error.response) {
      return res.status(error.response.status).json({
        error: error.response.data,
      });
    }

    return res.status(500).json({
      error: error.message,
    });
  }
};

module.exports = { getIPSBundleGeneric };