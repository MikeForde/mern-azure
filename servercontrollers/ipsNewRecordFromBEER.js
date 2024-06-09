// servercontrollers/ipsNewRecord.js
const { IPSModel } = require('../models/IPSModel');
const { parseBEER } = require('./servercontrollerfuncs/convertIPSBEERToSchema');

function addIPSFromBEER(req, res) {
    // Extract IPS Bundle from request body
    const ipsBEER = req.body;

    console.log(req.body);

    const delimiter = req.query.delim || 'newline';

    // Convert IPS BEER to desired schema
    try {
        const ipsRecord = parseBEER(ipsBEER, delimiter);

        console.log(ipsRecord);

        // Create a new IPS record using the converted schema
        const newIPS = new IPSModel(ipsRecord);

        // Save the new IPS record to the database
        newIPS
            .save()
            .then((newIPS) => {
                res.json(newIPS);
            })
            .catch((err) => {
                res.status(400).send(err);
            });
    } catch (error) {
        res.status(400).send(error.message);
    }
}

module.exports = { addIPSFromBEER };
