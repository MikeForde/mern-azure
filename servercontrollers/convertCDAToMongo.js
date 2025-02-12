const { IPSModel } = require('../models/IPSModel');
const { convertCDAToSchema } = require('./servercontrollerfuncs/convertCDAToSchema');

async function convertCDAToMongo(req, res) {
    try {
        // Extract parsed CDA JSON from request body
        const cdaJSON = req.body;

        // Convert CDA JSON to IPS schema
        const ipsRecord = convertCDAToSchema(cdaJSON);
        
        res.json(ipsRecord);
    } catch (error) {
        console.error('Error converting CDA to MongoDb format:', error);
        res.status(500).send('Error converting CDA to MongoDb format');
    }
}

module.exports = { convertCDAToMongo };