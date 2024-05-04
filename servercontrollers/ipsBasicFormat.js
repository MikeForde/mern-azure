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
        basicInfo += `${ipsRecord.packageUUID}\n`;
        basicInfo += `${ipsRecord.patient.name}\n`;
        basicInfo += `${ipsRecord.patient.given}\n`;
        basicInfo += `female\n`;
        basicInfo += `${ipsRecord.patient.dob}\n`;
        basicInfo += `${ipsRecord.patient.nationality}\n`;
        basicInfo += `${ipsRecord.patient.practitioner}\n`;

        // Append medication information
        ipsRecord.medication.forEach((med) => {
            basicInfo += `M:\n${med.name}\n${med.date}\n${med.dosage}\n`;
        });

        // Append allergy information
        ipsRecord.allergies.forEach((allergy) => {
            basicInfo += `A:\n${allergy.name}\n${allergy.severity}\n${allergy.date}\n`;
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
