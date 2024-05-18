const { IPSModel } = require('../models/IPSModel');

function getIPSSearch(req, res) {
    const { name } = req.params;

    if (!name) {
        return res.status(400).json({ message: "Name query parameter is required" });
    }

    // Search for IPS records based on patient's name
    IPSModel.find({ "patient.name": { $regex: new RegExp(name, "i") } })
        .exec()
        .then((ipss) => {
            if (!ipss.length) {
                return res.status(404).json({ message: "No matching IPS records found" });
            }

            res.json(ipss);
        })
        .catch((err) => {
            res.status(400).send(err);
        });
}

module.exports = { getIPSSearch };
