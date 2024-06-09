const { IPSModel } = require('../models/IPSModel');
const { ReadPreference } = require('mongodb');

function updateIPSByUUID(req, res) {
    const { uuid } = req.params;
    const updatedData = req.body;


    if (uuid) {
        IPSModel.findOne({ packageUUID: uuid })
            .read(ReadPreference.NEAREST)
            .exec()
            .then((ips) => {
                if (!ips) {
                    return res.status(404).send("IPS not found.");
                }

                // Update patient data
                if (updatedData.patient) {
                    Object.assign(ips.patient, updatedData.patient);
                }

                // Append new medication, allergies, conditions, and observations
                if (updatedData.medication) {
                    ips.medication = ips.medication.concat(updatedData.medication);
                }
                if (updatedData.allergies) {
                    ips.allergies = ips.allergies.concat(updatedData.allergies);
                }
                if (updatedData.conditions) {
                    ips.conditions = ips.conditions.concat(updatedData.conditions);
                }
                if (updatedData.observations) {
                    ips.observations = ips.observations.concat(updatedData.observations);
                }

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

module.exports = { updateIPSByUUID };
