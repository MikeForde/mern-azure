const { resolveId } = require('../utils/resolveId');
const { generateIPSBundleLegacy } = require('./servercontrollerfuncs/generateIPSBundleLegacy');


async function getIPSLegacyBundle(req, res) {
    const id = req.params.id;

    try {
        const ips = await resolveId(id);

        if (!ips) {
            return res.status(404).json({ message: "IPS record not found" });
        }

        // Constructing the JSON structure
        const bundle = generateIPSBundleLegacy(ips);

        res.json(bundle);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

module.exports = { getIPSLegacyBundle };
