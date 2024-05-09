
const { IPSModel } = require('../models/IPSModel');
const { generateIPSBundle } = require('./generateIPSBundle');


function getIPSBundle(req, res) {
    const id = req.params.id;
    IPSModel.findById(id)
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

module.exports = { getIPSBundle };
