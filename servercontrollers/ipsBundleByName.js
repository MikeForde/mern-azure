const { IPSModel } = require('../models/IPSModel');
const { generateIPSBundle } = require('./servercontrollerfuncs/generateIPSBundle');

function getIPSBundleByName(req, res) {
    const { name, given } = req.params;

    // Search for IPS records based on patient's name and given name
    IPSModel.findOne({ "patient.name": name, "patient.given": given })
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
