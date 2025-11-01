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

        const useJwe =
            String(req.query.protect || '').trim() === '1' ||
            (req.get('X-Field-Enc') || '').toLowerCase() === 'jwe';

        const useOmit =
            String(req.query.protect || '').trim() === '2' ||
            (req.get('X-Field-Enc') || '').toLowerCase() === 'omit';

        let protectMethod = "none";
        if (useJwe) {
            protectMethod = "jwe";
        } else if (useOmit) {
            protectMethod = "omit";
        }

        // Constructing the JSON structure
        const bundle = await generateIPSBundleUnified(ips, protectMethod);

        res.json(bundle);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

module.exports = { getIPSUnifiedBundle };
