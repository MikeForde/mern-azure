const { IPSModel } = require('../models/IPSModel');
const { parseHL72_xToMongo } = require('./servercontrollerfuncs/convertHL72_xToSchema');
const { generateIPSBundle } = require('./servercontrollerfuncs/generateIPSBundle');

async function convertHL72_xToIPS(req, res) {
    try {
        // Check if 'data' is provided in the body, otherwise assume entire body is the HL7 message
        if (req.body.data) {
            hl7Message = req.body.data;
        } else {
            hl7Message = req.body;
        }

        console.log(hl7Message);

        // Ensure hl7Message is a valid string
        if (typeof hl7Message !== 'string' || !hl7Message.trim()) {
            return res.status(400).send('Invalid HL7 message format');
        }

        // Convert HL7 2.8 data to MongoDB schema format
        const ipsRecord = parseHL72_xToMongo(hl7Message);



        // Generate IPS JSON bundle from MongoDB schema format
        const ipsBundle = generateIPSBundle(ipsRecord);

        // Send the generated IPS JSON bundle as response
        res.json(ipsBundle);
    } catch (error) {
        console.error('Error converting HL7 2.x to IPS JSON format:', error);
        res.status(500).send('Error converting HL7 2.x to IPS JSON format');
    }
}

module.exports = { convertHL72_xToIPS };
