// server/controllers/servercontrollerfuncs/ipsService.js

const { IPSModel } = require('../../models/IPSModel');
const { ReadPreference } = require('mongodb');

const FHIR_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Extract the HealthStaq Patient logical resource id from converted IPS data.
 *
 * This deliberately does not use packageUUID.
 *
 * Keep the candidate list broad while the converter/model naming is settling.
 * Once you know the exact stored field, this can be reduced.
 */
function getPatientResourceUuid(ipsData) {
  const value = ipsData?.patient?.resourceId;

  if (
    typeof value === 'string' &&
    FHIR_UUID_REGEX.test(value.trim())
  ) {
    return value.trim();
  }

  return '';
}

/**
 * Find an existing IPS record by the HealthStaq Patient resource UUID.
 *
 * This is a secondary match only. packageUUID remains the primary match.
 */
async function findByPatientResourceUuid(patientResourceUuid) {
  if (!patientResourceUuid) {
    return null;
  }

  return IPSModel
    .findOne({ 'patient.resourceId': patientResourceUuid })
    .read(ReadPreference.NEAREST)
    .exec();
}

/**
 * Merge updateData into an existing IPS document in place.
 */
function mergeIPS(ipsDoc, updateData) {
  // 1) Merge patient sub-object
  if (updateData.patient) {
    ipsDoc.patient = ipsDoc.patient || {};
    Object.assign(ipsDoc.patient, updateData.patient);
  }

  // 2) Define which fields to dedupe on [name, date]
  const arrayFields = [
    'medication',
    'allergies',
    'conditions',
    'observations',
    'immunizations',
    'procedures',
  ];

  arrayFields.forEach((field) => {
    const incoming = updateData[field];

    if (!Array.isArray(incoming)) return;

    // ensure the target array exists
    ipsDoc[field] = ipsDoc[field] || [];

    incoming.forEach((newItem) => {
      // parse dates to milliseconds for reliable comparison
      const newTime = new Date(newItem.date).getTime();

      // look for an existing item with same name+date
      const existing = ipsDoc[field].find((oldItem) => {
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
 * Create a new IPS record, or update an existing one.
 *
 * Match order:
 *   1. packageUUID
 *   2. HealthStaq Patient resource UUID
 *   3. create new
 *
 * When matching by HealthStaq Patient UUID, preserve the existing packageUUID.
 *
 * @param {Object} ipsData full JSON payload
 * @returns {Promise<IPSModel>}
 */
async function upsertIPS(ipsData) {
  const incomingPackageUUID =
    typeof ipsData?.packageUUID === 'string'
      ? ipsData.packageUUID.trim()
      : '';

  const incomingPatientResourceUuid =
    getPatientResourceUuid(ipsData);

  let ips = null;
  let matchType = '';

  if (incomingPackageUUID) {
    ips = await IPSModel
      .findOne({ packageUUID: incomingPackageUUID })
      .read(ReadPreference.NEAREST)
      .exec();

    if (ips) {
      matchType = 'packageUUID';
    }
  }

  if (!ips && incomingPatientResourceUuid) {
    ips = await findByPatientResourceUuid(
      incomingPatientResourceUuid
    );

    if (ips) {
      matchType = 'patientResourceUuid';
    }
  }

  if (!ips) {
    console.log(
      'No existing IPS record found, creating new one',
      {
        incomingPackageUUID: incomingPackageUUID || null,
        incomingPatientResourceUuid:
          incomingPatientResourceUuid || null,
      }
    );

    return new IPSModel(ipsData).save();
  }

  console.log(
    'Existing IPS record found, merging data',
    {
      matchType,
      existingPackageUUID: ips.packageUUID,
      incomingPackageUUID: incomingPackageUUID || null,
      incomingPatientResourceUuid:
        incomingPatientResourceUuid || null,
    }
  );

  const existingPackageUUID = ips.packageUUID;

  mergeIPS(ips, ipsData);

  /*
   * Critical:
   * If the incoming HealthStaq import had a generated/made-up packageUUID,
   * do not allow it to replace the existing local packageUUID.
   */
  ips.packageUUID = existingPackageUUID;

  return ips.save();
}

module.exports = {
  upsertIPS,
  mergeIPS,
  getPatientResourceUuid,
};