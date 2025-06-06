const { resolveId } = require('../utils/resolveId');
const { generateXMPPPlainText } = require('../servercontrollers/servercontrollerfuncs/generateXMPPPlainText');

/**
 * Fetch an IPS record by ID and convert it to plain text
 */
async function getIPSPlainText(id) {
  const ipsRecord = await resolveId(id);
  if (!ipsRecord) {
    return null;
  }

  return generateXMPPPlainText(ipsRecord);
}

module.exports = {
  getIPSPlainText,
};
