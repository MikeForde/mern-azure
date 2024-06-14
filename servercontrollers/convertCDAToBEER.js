const { IPSModel } = require('../models/IPSModel');
const { convertCDAToSchema } = require('./servercontrollerfuncs/convertCDAToSchema');
const { generateIPSBEER } = require('./servercontrollerfuncs/generateIPSBEER');

async function convertCDAToBEER(req, res) {
    try {
        // Extract parsed CDA JSON from request body
        const cdaJSON = req.body;

        // Convert CDA JSON to IPS schema
        const ipsRecord = convertCDAToSchema(cdaJSON);
        const ipsbeer = generateIPSBEER(ipsRecord, '|');
        res.json(ipsbeer);
    } catch (error) {
        console.error('Error converting CDA to IPS BEERformat:', error);
        res.status(500).send('Error converting CDA to IPS BEER format');
    }
}

module.exports = { convertCDAToBEER };