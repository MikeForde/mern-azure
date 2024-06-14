const { IPSModel } = require('../models/IPSModel');
const { convertCDAToSchema } = require('./servercontrollerfuncs/convertCDAToSchema');
const { generateIPSBundle } = require('./servercontrollerfuncs/generateIPSBundle');

async function convertCDAToIPS(req, res) {
    try {
        // Extract parsed CDA JSON from request body
        const cdaJSON = req.body;

        // Convert CDA JSON to IPS schema
        const ipsRecord = convertCDAToSchema(cdaJSON);
        const ipsBundle = generateIPSBundle(ipsRecord);
        res.json(ipsBundle);
    } catch (error) {
        console.error('Error converting CDA to IPS JSON format:', error);
        res.status(500).send('Error converting CDA to IPS JSON format');
    }
}

module.exports = { convertCDAToIPS };