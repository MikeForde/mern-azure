// Desc: Controller for generating XML bundle format for IPS records
// const { js2xml } = require('xml-js');
const { IPSModel } = require('../models/IPSModel');
const { generateXMLBundle } = require('./servercontrollerfuncs/generateXMLBundle');
const { validate: isValidUUID } = require('uuid');

function getIPSXMLBundle(req, res) {
    const id = req.params.id;
    let query;

    // Check if the provided ID is a valid UUID
    if (isValidUUID(id)) {
        // Search using packageUUID if it is a valid UUID
        query = IPSModel.findOne({ packageUUID: id });
    } else {
        // Otherwise, assume it is a MongoDB ObjectId
        query = IPSModel.findById(id);
    }

    // Execute the query
    query.exec()
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
