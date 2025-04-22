// server/controllers/updateIPSRecordByUUID.js
const { IPSModel } = require('../models/IPSModel');
const { ReadPreference } = require('mongodb');
const { mergeIPS } = require('./servercontrollerfuncs/ipsService');

async function updateIPSByUUID(req, res) {
  const { uuid } = req.params;
  if (!uuid) return res.status(404).send("IPS not found.");

  try {
    const ips = await IPSModel.findOne({ packageUUID: uuid })
                              .read(ReadPreference.NEAREST)
                              .exec();
    if (!ips) {
      return res.status(404).send("IPS not found.");
    }

    // merge in everything (including immunizations)
    mergeIPS(ips, req.body);

    const updated = await ips.save();
    res.json(updated);

  } catch (err) {
    res.status(400).send(err);
  }
}

module.exports = { updateIPSByUUID };

