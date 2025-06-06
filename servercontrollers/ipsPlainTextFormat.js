const { generateXMPPPlainText} = require('./servercontrollerfuncs/generateXMPPPlainText');
const { resolveId } = require('../utils/resolveId');

async function getIPSPlainText(req, res) {
    const id = req.params.id;

    try {
        const ips = await resolveId(id);

        if (!ips) {
            return res.status(404).send('IPS record not found');
        }

        const basicText = generateXMPPPlainText(ips);

        res.set('Content-Type', 'text/plain');
        res.send(basicText);
    } catch (error) {
        console.error('Error fetching IPS record:', error);
        res.status(500).send('Internal Server Error');
    }
}

module.exports = { getIPSPlainText };