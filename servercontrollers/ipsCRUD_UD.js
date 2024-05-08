// servercontrollers/ipsCRUD_UD.js
const {IPSModel} = require('../models/IPSModel');

function updateIPS(req, res) {
    const { id } = req.params;

    if (id) {
        IPSModel.findById(id)
            .read(ReadPreference.NEAREST)
            .exec()
            .then((ips) => {
                ips.save().then((updatedIPS) => {
                    res.json(updatedIPS);
                });
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

module.exports = { updateIPS, deleteIPS };
