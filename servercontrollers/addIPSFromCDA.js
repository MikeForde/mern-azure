// servercontrollers/addIPSFromCDA.js
const { IPSModel } = require('../models/IPSModel');
const { convertCDAToSchema } = require('./servercontrollerfuncs/convertCDAToSchema');

async function addIPSFromCDA(req, res) {
    try {
        // Extract parsed CDA JSON from request body
        const cdaJSON = req.body;

        // Convert CDA JSON to IPS schema
        const ipsRecord = convertCDAToSchema(cdaJSON);

        // Create a new IPS record using the converted schema
        const newIPS = new IPSModel(ipsRecord);

        // Save the new IPS record to the database
        await newIPS.save();

        res.status(201).json(newIPS);

    } catch (err) {
        console.error('Error processing CDA:', err);
        res.status(400).send('Error processing CDA XML');
    }
}

module.exports = { addIPSFromCDA };
