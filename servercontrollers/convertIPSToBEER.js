// Desc: Controller for converting IPS JSON to BEER format
const { convertIPSBundleToSchema } = require('./servercontrollerfuncs/convertIPSBundleToSchema');
const { generateIPSBEER } = require('./servercontrollerfuncs/generateIPSBEER');

function convertIPSToBEER(req, res) {
    const { data } = req.body;

    try {
        const ipsBundle = JSON.parse(data); // Parse IPS JSON
        const ipsRecord = convertIPSBundleToSchema(ipsBundle); // Convert IPS JSON to internal schema
        const beerData = generateIPSBEER(ipsRecord, '\n'); // Convert schema to BEER format
        res.json(beerData); // Return BEER data
    } catch (error) {
        console.error('Error converting IPS JSON to IPS BEER format:', error);
        res.status(500).send('Error converting IPS JSON to IPS BEER format');
    }
};

module.exports = { convertIPSToBEER };
