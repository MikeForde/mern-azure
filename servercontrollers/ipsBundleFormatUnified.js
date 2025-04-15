const { resolveId } = require('../utils/resolveId');
const { status } = require('@grpc/grpc-js');
const { generateIPSBundleUnified } = require('./servercontrollerfuncs/generateIPSBundleUnified');


async function getIPSUnifiedBundle(req, res) {
    const id = req.params.id;

    console.log("getIPSUnifiedBundle called with ID:", id);

    try {
        const ips = await resolveId(id);

        if (!ips) {
            return res.status(404).json({ message: "IPS record not found" });
        }

        // Constructing the JSON structure
        const bundle = generateIPSBundleUnified(ips);

        res.json(bundle);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

module.exports = { getIPSUnifiedBundle };
