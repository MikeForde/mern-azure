// servercontrollers/ipsNewRecord.js
const { IPSModel } = require('../models/IPSModel');
const { convertIPSBundleToSchema } = require('./servercontrollerfuncs/convertIPSBundleToSchema');

function addIPSFromBundle(req, res) {
    // Extract IPS Bundle from request body
    const ipsBundle = req.body;

    // Convert IPS Bundle to desired schema
    const ipsRecord = convertIPSBundleToSchema(ipsBundle);

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
}

module.exports = { addIPSFromBundle };
