// xmpp/xmppIPSPlainText.js

const { resolveId } = require('../utils/resolveId');

/**
 * Helper to format a Date object as "yyyy-mm-dd HH:MM:SS"
 * (e.g. 2024-08-05 06:33:26)
 */
function formatTimestamp(dateObj) {
  // Convert to ISO string, then parse out date/time
  // Return blank if dateObj is null, undefined or not a Date
  if (!dateObj || !(dateObj instanceof Date)) {
    return '';
  }
  const iso = dateObj.toISOString();         // e.g. "2024-08-05T06:33:26.123Z"
  const datePart = iso.substring(0, 10);     // "2024-08-05"
  const timePart = iso.substring(11, 19);    // "06:33:26"
  return `${datePart} ${timePart}`;
}

/**
 * Fetch an IPS record by ID and convert it to a plain text string
 * in your desired format.
 */
async function getIPSPlainText(id) {
  // 1) Resolve the ID and fetch the IPS record
  const ipsRecord = await resolveId(id);
  if (!ipsRecord) {
    return null; // Not found
  }

  //console.log('IPS Record - getIPSPlainText:', ipsRecord);

  // 2) Construct a plain text output
  let output = '';

  // Main header info
  output += `IPS UUID: ${ipsRecord.packageUUID}\n`;
  output += `Timestamp: ${formatTimestamp(ipsRecord.timeStamp)}\n`;

  // Patient details
  output += `Patient Details:\n`;
  output += `Name: ${ipsRecord.patient.name}\n`;
  output += `Given Name: ${ipsRecord.patient.given}\n`;
  output += `DOB: ${formatTimestamp(ipsRecord.patient.dob)}\n`;
  output += `Gender: ${ipsRecord.patient.gender}\n`;
  output += `Country: ${ipsRecord.patient.nation}\n`;
  output += `Practitioner: ${ipsRecord.patient.practitioner}\n`;
  output += `Organization: ${ipsRecord.patient.organization}\n\n`;

  // Medications
  output += `Medications:\n`;
  output += `Name\tCode\tSystem\tDate\tDosage\n`;
  ipsRecord.medication.forEach((med) => {
    output += `${med.name}\t${med.code}\t${med.system}\t${formatTimestamp(med.date)}\t${med.dosage}\n`;
  });
  output += `\n`;

  // Allergies
  output += `Allergies:\n`;
  output += `Name\tCode\tSystem\tCriticality\tDate\n`;
  ipsRecord.allergies.forEach((allergy) => {
    output += `${allergy.name}\t${allergy.code}\t${allergy.system}\t${allergy.criticality}\t${formatTimestamp(allergy.date)}\n`;
  });
  output += `\n`;

  // Conditions
  output += `Conditions:\n`;
  output += `Name\tCode\tSystem\tDate\n`;
  ipsRecord.conditions.forEach((condition) => {
    output += `${condition.name}\t${condition.code}\t${condition.system}\t${formatTimestamp(condition.date)}\n`;
  });
  output += `\n`;

  // Observations
  output += `Observations:\n`;
  output += `Name\tCode\tSystem\tDate\tValue\n`;
  ipsRecord.observations.forEach((obs) => {
    output += `${obs.name}\t${obs.code}\t${obs.system}\t${formatTimestamp(obs.date)}\t${obs.value}\n`;
  });
  output += `\n`;

  // Immunizations
  output += `Immunizations:\n`;
  output += `Name\tSystem\tDate\n`;
  ipsRecord.immunizations.forEach((imm) => {
    output += `${imm.name}\t${imm.system}\t${formatTimestamp(imm.date)}\n`;
  });

  return output;
}

module.exports = {
  getIPSPlainText,
};
