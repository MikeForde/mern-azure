const { IPSModel } = require('../models/IPSModel');
const { generateIPSBundle } = require('./servercontrollerfuncs/generateIPSBundle');

function getIPSBundleByName(req, res) {
    const { name, given } = req.params;

    // Use regular expressions for case-insensitive matching
    const nameRegex = new RegExp(`^${name}$`, 'i');
    const givenRegex = new RegExp(`^${given}$`, 'i');

    IPSModel.findOne({ "patient.name": nameRegex, "patient.given": givenRegex })
        .exec()
        .then((ips) => {
            if (!ips) {
                return res.status(404).json({ message: "IPS record not found" });
            }

            // Constructing the JSON structure
            const bundle = generateIPSBundle(ips);  

            res.json(bundle);
        })
        .catch((err) => {
            res.status(400).send(err);
        });
}

module.exports = { getIPSBundleByName };

