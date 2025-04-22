// server/controllers/servercontrollerfuncs/ipsService.js
const { IPSModel } = require('../../models/IPSModel');
const { ReadPreference } = require('mongodb');

/**
 * Merge updateData into an existing IPS document in place.
 */
function mergeIPS(ipsDoc, updateData) {
  // 1) Merge patient sub‑object
  if (updateData.patient) {
    Object.assign(ipsDoc.patient, updateData.patient);
  }

  // 2) Define which fields to dedupe on [name, date]
  const arrayFields = ['medication','allergies','conditions','observations','immunizations'];

  arrayFields.forEach(field => {
    const incoming = updateData[field];
    if (!Array.isArray(incoming)) return;

    // ensure the target array exists
    ipsDoc[field] = ipsDoc[field] || [];

    incoming.forEach(newItem => {
      // parse dates to milliseconds for reliable comparison
      const newTime = new Date(newItem.date).getTime();

      // look for an existing item with same name+date
      const existing = ipsDoc[field].find(oldItem => {
        return (
          oldItem.name === newItem.name &&
          new Date(oldItem.date).getTime() === newTime
        );
      });

      if (existing) {
        // update only the changed bits
        Object.assign(existing, newItem);
      } else {
        // totally new entry
        ipsDoc[field].push(newItem);
      }
    });
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
