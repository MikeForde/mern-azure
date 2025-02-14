const { convertIPSBundleToSchema } = require('./servercontrollerfuncs/convertIPSBundleToSchema');
const { generateIPSBEER } = require('./servercontrollerfuncs/generateIPSBEER');
const { convertFhirXmlToJson } = require('./servercontrollerfuncs/convertFHIRXMLtoJSON');

function convertIPSToBEER(req, res) {
  try {
    let ipsBundle;
    // If the header "fhirxml" is set to "true", assume the payload is FHIR XML.
    if (
      req.body &&
      typeof req.body === 'object' &&
      !req.body.resourceType &&
      Object.keys(req.body).length === 1
    ) {
      req.body = convertFhirXmlToJson(req.body);
      console.log("Converted incoming FHIR XML to IPS JSON");
      ipsBundle = req.body;
    }
    else {
      // Otherwise, assume req.body.data contains a JSON string.
      const { data } = req.body;
      ipsBundle = JSON.parse(data);
    }
    const ipsRecord = convertIPSBundleToSchema(ipsBundle); // Convert IPS JSON to internal schema
    const beerData = generateIPSBEER(ipsRecord, '\n');      // Convert schema to BEER format
    res.json(beerData); // Return BEER data
  } catch (error) {
    console.error('Error converting IPS JSON to IPS BEER format:', error);
    res.status(500).send('Error converting IPS JSON to IPS BEER format');
  }
}

module.exports = { convertIPSToBEER };
