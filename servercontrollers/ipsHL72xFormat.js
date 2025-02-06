const { resolveId } = require('../utils/resolveId');
const { generateIPSHL72_x } = require('./servercontrollerfuncs/generateIPSHL72_x');

// Define the getIPSHL72_8 function
async function getIPSHL72_x(req, res) {
    const { id } = req.params;

    try {
        // Resolve the ID and fetch the IPS record
        const ipsRecord = await resolveId(id);

        // If the record is not found, return a 404 error
        if (!ipsRecord) {
            return res.status(404).send('IPS record not found');
        }

        // Convert the IPS record to HL7 2.8 format
        const hl72xData = generateIPSHL72_x(ipsRecord);

        // Send the plain text response
        res.set('Content-Type', 'text/plain');
        res.send(hl72xData);
    } catch (error) {
        console.error('Error fetching HL7 2.8 record format:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Export the getIPSHL72_8 function
module.exports = {getIPSHL72_x};
