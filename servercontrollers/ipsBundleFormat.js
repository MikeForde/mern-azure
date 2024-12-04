const { generateIPSBundle } = require('./servercontrollerfuncs/generateIPSBundle');
const { resolveId } = require('../utils/resolveId');


async function getIPSBundle(req, res) {
    const id = req.params.id;

    try {
        const ips = await resolveId(id);

        if (!ips) {
            return res.status(404).json({ message: "IPS record not found" });
        }

        // Constructing the JSON structure
        const bundle = generateIPSBundle(ips);

        res.json(bundle);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

module.exports = { getIPSBundle };
