// api/ipsBundleFormat.js (or wherever this file lives)

const { generateIPSBundle } = require('./servercontrollerfuncs/generateIPSBundle');
const { resolveId } = require('../utils/resolveId');

function parseBoolQuery(value) {
  if (value === undefined || value === null) return false;
  const v = String(value).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 'on';
}

async function getIPSBundle(req, res) {
  const id = req.params.id;

  try {
    const ips = await resolveId(id);

    if (!ips) {
      return res.status(404).json({ message: "IPS record not found" });
    }

    // Query flags:
    //   /ips/:id?narrative=1
    //   /ips/:id?narrative=1&resourceNarrative=1
    const includeNarrative = parseBoolQuery(req.query.narrative);
    const includeResourceNarrative = parseBoolQuery(req.query.resourceNarrative);

    const bundle = generateIPSBundle(ips, {
      includeNarrative,
      includeResourceNarrative,
    });

    res.json(bundle);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { getIPSBundle };