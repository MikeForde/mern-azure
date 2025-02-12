// servercontrollers/ipsNewRecord.js
const { IPSModel } = require('../models/IPSModel');
const { parseHL72_xToMongo} = require('./servercontrollerfuncs/convertHL72_xToSchema');

function addIPSFromHL72x(req, res) {
    // Extract IPS Bundle from request body
    const ipsHL72x = req.body;

    console.log(req.body);

    // Convert IPS BEER to desired schema
    try {
        const ipsRecord = parseHL72_xToMongo(ipsHL72x);

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

module.exports = { addIPSFromHL72x };
