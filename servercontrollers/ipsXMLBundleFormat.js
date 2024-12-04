const { generateXMLBundle } = require('./servercontrollerfuncs/generateXMLBundle');
const { resolveId } = require('../utils/resolveId');

async function getIPSXMLBundle(req, res) {
    const {id} = req.params;

    try {
        // Resolve the ID to find the appropriate IPS record
        const ips = await resolveId(id);

        if (!ips) {
            return res.status(404).json({ message: 'IPS record not found' });
        }

        // Generate the XML bundle
        const genXML = generateXMLBundle(ips);

        res.set('Content-Type', 'application/xml');
        res.send(genXML);
    } catch (err) {
        console.error('Error fetching IPS XML bundle:', err);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = { getIPSXMLBundle };
