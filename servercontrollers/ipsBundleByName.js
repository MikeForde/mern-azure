const { IPSModel } = require('../models/IPSModel');
const { pickIPSFormat } = require('../utils/ipsFormatPicker');

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

        
            const generateBundleFunction = pickIPSFormat(req.headers['x-ips-format']);
            const bundle = generateBundleFunction(ips);
            if (!bundle) {
                return res.status(500).json({ message: "Error generating IPS bundle" });
            }
            // Send the generated bundle as a JSON response

            res.json(bundle);
        })
        .catch((err) => {
            res.status(400).send(err);
        });
}

module.exports = { getIPSBundleByName };

