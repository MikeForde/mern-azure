// Description: Controller for converting BEER data to IPS JSON format.
const { parseBEER } = require('./servercontrollerfuncs/convertIPSBEERToSchema');
const { pickIPSFormat } = require('../utils/ipsFormatPicker');


function convertBEERToIPS(req, res) {
  let beerMessage;

  // Check if 'data' is provided in the body, otherwise assume entire body is the HL7 message
  if (req.body.data) {
    beerMessage = req.body.data;
  } else {
    beerMessage = req.body;
  }

  console.log(beerMessage);

  try {
    const delimiter = '\n'; // Assuming newline delimiter
    const mongoData = parseBEER(beerMessage, delimiter);
    const generateBundleFunction = pickIPSFormat(req.headers['x-ips-format']);
    const ipsBundle = generateBundleFunction(mongoData);
    res.json(ipsBundle);
  } catch (error) {
    console.error('Error converting IPS BEER to IPS JSON format:', error);
    res.status(500).send('Error converting IPS BEER to IPS JSON format');
  }
};

module.exports = { convertBEERToIPS };
