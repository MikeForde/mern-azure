// servercontrollers/ipsNewRecord.js
const {IPSModel} = require('../models/IPSModel');

function addIPS(req, res) {
    console.log("req.body", req.body);

    const newIPS = new IPSModel(req.body);

    newIPS
        .save()
        .then((newIPS) => {
            res.json(newIPS);
        })
        .catch((err) => {
            res.status(400).send(err);
        });
}

function addIPSMany(req, res) {
    console.log("req.body", req.body);

    const ipsRecords = req.body; // Array of IPS records

    // Insert all IPS records into the database
    IPSModel.insertMany(ipsRecords)
        .then((newIPS) => {
            res.json(newIPS);
        })
        .catch((err) => {
            res.status(400).send(err);
        });
}

module.exports = { addIPS, addIPSMany };
