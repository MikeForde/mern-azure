// servercontrollers/ipsCRUD_UD.js
const {IPSModel} = require('../models/IPSModel');
const { ReadPreference } = require('mongodb');

function updateIPS(req, res) {
    const { id } = req.params;
    const updatedData = req.body;

    if (id) {
        IPSModel.findById(id)
            .read(ReadPreference.NEAREST)
            .exec()
            .then((ips) => {
                if (!ips) {
                    return res.status(404).send("IPS not found.");
                }
                
                // Update IPS with new data
                Object.assign(ips, updatedData);
                
                // Save the updated IPS
                return ips.save();
            })
            .then((updatedIPS) => {
                res.json(updatedIPS);
            })
            .catch((err) => {
                res.status(400).send(err);
            });
    } else {
        res.status(404).send("IPS not found.");
    }
}

function deleteIPS(req, res) {
    const { id } = req.params;

    if (id) {
        IPSModel.findByIdAndRemove(id)
            .then((ips) => {
                res.json(ips._id);
            })
            .catch((err) => {
                res.status(400).send(err);
            });
    }
}

function deleteIPSbyPractitioner(req, res) {
    const { practitioner } = req.params;

    if (practitioner) {
        // Perform case-insensitive deletion of records matching the practitioner's name
        IPSModel.deleteMany({ "patient.practitioner": { $regex: new RegExp(`^${practitioner}$`, 'i') } })
            .then((result) => {
                res.json({ message: `${result.deletedCount} IPS record(s) deleted.` });
            })
            .catch((err) => {
                res.status(400).send(err);
            });
    } else {
        res.status(400).send("Practitioner parameter is missing.");
    }
}

module.exports = { updateIPS, deleteIPS, deleteIPSbyPractitioner };
