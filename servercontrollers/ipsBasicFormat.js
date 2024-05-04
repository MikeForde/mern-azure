// Import necessary modules
const { IPSModel } = require('../models/IPSModel');

// Define the getIPSBasic function
const getIPSBasic = (req, res) => {
    // Retrieve IPS record from the database based on the provided ID
    IPSModel.findById(req.params.id).exec().then((ipsRecord) => {
        // If the record is not found, return a 404 error
        if (!ipsRecord) {
            return res.status(404).send('IPS record not found');
        }

        // Construct the plain text response format
        let basicInfo = '';
        basicInfo += `${ipsRecord.packageUUID}\r\n`;
        basicInfo += `${ipsRecord.patient.name}\r\n`;
        basicInfo += `${ipsRecord.patient.given}\r\n`;
        basicInfo += `${ipsRecord.patient.dob}\r\n`;
        basicInfo += `${ipsRecord.patient.nationality}\r\n`;
        basicInfo += `${ipsRecord.patient.practitioner}\r\n`;

        // Append medication information
        ipsRecord.medication.forEach((med) => {
            basicInfo += `M:\r\n${med.name}\r\n${med.date}\r\n${med.dosage}\r\n`;
        });

        // Append allergy information
        ipsRecord.allergies.forEach((allergy) => {
            basicInfo += `A:\r\n${allergy.name}\r\n${allergy.severity}\r\n${allergy.date}\r\n`;
        });

        // Send the plain text response
        res.set('Content-Type', 'text/plain');
        res.send(basicInfo);
    }).catch((error) => {
        console.error('Error fetching IPS record:', error);
        res.status(500).send('Internal Server Error');
    });
};

// Export the getIPSBasic function
module.exports = getIPSBasic;
