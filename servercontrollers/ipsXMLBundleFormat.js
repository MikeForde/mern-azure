// Desc: Controller for generating XML bundle format for IPS records
const { js2xml } = require('xml-js');
const { IPSModel } = require('../models/IPSModel');
const { generateXMLBundle } = require('./generateXMLBundle');

function getIPSXMLBundle(req, res) {
    const id = req.params.id;
    IPSModel.findById(id)
        .exec()
        .then((ips) => {
            if (!ips) {
                return res.status(404).json({ message: "IPS record not found" });
            }

            // Constructing the XML structure
            const genXML = generateXMLBundle(ips);

            res.set('Content-Type', 'application/xml');
            res.send(genXML);
        })
        .catch((err) => {
            res.status(400).send(err);
        });
}

module.exports = { getIPSXMLBundle };
