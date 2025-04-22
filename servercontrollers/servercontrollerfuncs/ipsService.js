// server/controllers/servercontrollerfuncs/ipsService.js
const { IPSModel } = require('../../models/IPSModel');
const { ReadPreference } = require('mongodb');

/**
 * Merge updateData into an existing IPS document in place.
 */
function mergeIPS(ipsDoc, updateData) {
  if (updateData.patient) {
    Object.assign(ipsDoc.patient, updateData.patient);
  }

  // these fields all live at top‑level in your schema
  ['medication', 'allergies', 'conditions', 'observations', 'immunizations']
    .forEach(field => {
      if (Array.isArray(updateData[field])) {
        ipsDoc[field] = (ipsDoc[field] || []).concat(updateData[field]);
      }
    });
}

/**
 * Create a new IPS record, or update the existing one if packageUUID already exists.
 * @param {Object} ipsData: full JSON payload
 * @returns {Promise<IPSModel>}
 */
async function upsertIPS(ipsData) {
  if (!ipsData.packageUUID) {
    // no UUID? just create
    console.log('No packageUUID, creating new IPS record');
    return new IPSModel(ipsData).save();
  }

  // try to find an existing record
  let ips = await IPSModel
    .findOne({ packageUUID: ipsData.packageUUID })
    .read(ReadPreference.NEAREST)
    .exec();

  if (!ips) {
    // create new
    console.log('No existing IPS record found, creating new one');
    return new IPSModel(ipsData).save();
  } else {
    // merge in the new bits
    console.log('Existing IPS record found, merging data');
    mergeIPS(ips, ipsData);
    return ips.save();
  }
}

module.exports = { upsertIPS, mergeIPS };
