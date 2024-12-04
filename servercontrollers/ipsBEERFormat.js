const { resolveId } = require('../utils/resolveId');
const { generateIPSBEER } = require('./servercontrollerfuncs/generateIPSBEER');

// Define the getIPSBEER function
async function getIPSBEER(req, res) {
    const { id, delim } = req.params;

    // Determine the delimiter based on the parameter
    const delimiterMap = {
        'semi': ';',
        'colon': ':',
        'pipe': '|',
        'at': '@',
        'newline': '\n'
    };
    const delimiter = delimiterMap[delim] || '\n';

    try {
        // Resolve the ID to fetch the IPS record
        const ipsRecord = await resolveId(id);

        // If the record is not found, return a 404 error
        if (!ipsRecord) {
            return res.status(404).send('IPS record not found');
        }

        // Convert the IPS record to BEER format
        const beerData = generateIPSBEER(ipsRecord, delimiter);

        // Send the plain text response
        res.set('Content-Type', 'text/plain');
        res.send(beerData);
    } catch (error) {
        console.error('Error fetching IPS record:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Export the getIPSBEER function
module.exports = {getIPSBEER};
