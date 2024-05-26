const { IPSModel } = require('../models/IPSModel');
const { validate: isValidUUID } = require('uuid');

// Define the getIPSBEER function
const getIPSBEER = async (req, res) => {
    const { id, delim } = req.params;
    let query;

    // Check if the provided ID is a valid UUID
    if (isValidUUID(id)) {
        // Search using packageUUID if it is a valid UUID
        query = IPSModel.findOne({ packageUUID: id });
    } else {
        // Otherwise, assume it is a MongoDB ObjectId
        query = IPSModel.findById(id);
    }

    // Determine the delimiter based on the parameter
    const delimiterMap = {
        'semi': ';',
        'colon': ':',
        'comma': ','
    };
    const delimiter = delimiterMap[delim] || '\n';

    try {
        const ipsRecord = await query.exec();

        // If the record is not found, return a 404 error
        if (!ipsRecord) {
            return res.status(404).send('IPS record not found');
        }

        // Get current timestamp
        const currentTimestamp = new Date();
        const currentTimestampString = currentTimestamp.toISOString();

        // Helper function to format dates as yyyymmdd
        const formatDate = (date) => {
            return date.toISOString().substring(0, 10).replace(/-/g, '');
        };

        // Basic information
        let basicInfo = `H9${delimiter}`;
        basicInfo += `1${delimiter}`;
        basicInfo += `${currentTimestampString}${delimiter}`;
        basicInfo += `${ipsRecord.packageUUID}${delimiter}`;
        basicInfo += `${ipsRecord.patient.name}${delimiter}`;
        basicInfo += `${ipsRecord.patient.given}${delimiter}`;
        basicInfo += `${formatDate(ipsRecord.patient.dob)}${delimiter}`;

        // Gender formatting
        const genderMap = {
            'Male': 'm',
            'Female': 'f',
            'Other': 'o',
            'Unknown': 'u'
        };
        basicInfo += `${genderMap[ipsRecord.patient.gender] || 'u'}${delimiter}`;

        basicInfo += `${ipsRecord.patient.practitioner}${delimiter}`;
        basicInfo += `${ipsRecord.patient.nation}${delimiter}`;
        basicInfo += `UK MOD${delimiter}`;

        // Medication information
        if (ipsRecord.medication && ipsRecord.medication.length > 0) {
            const uniqueMedications = [...new Set(ipsRecord.medication.map(med => med.name))];
            basicInfo += `M${3}-${uniqueMedications.length}${delimiter}`;

            uniqueMedications.forEach((medName) => {
                const medEntries = ipsRecord.medication.filter(med => med.name === medName);
                basicInfo += `${medName}${delimiter}`;

                const medTimes = medEntries.map(med => {
                    const diffMs = new Date(med.date) - currentTimestamp;
                    const diffMinutes = Math.round(diffMs / 60000);

                    // Express time in minutes if within 24 hours, otherwise in yyyymmdd
                    return (Math.abs(diffMinutes) < 1440) ? diffMinutes : formatDate(new Date(med.date));
                }).join(', ');

                basicInfo += `${medTimes}${delimiter}`;
                basicInfo += `${medEntries[0].dosage}${delimiter}`;
            });
        }

        // Criticality formatting
        const criticalityMap = {
            'High': 'h',
            'Moderate': 'm',
            'Low': 'l'
        };

        // Allergy information
        if (ipsRecord.allergies && ipsRecord.allergies.length > 0) {
            basicInfo += `A${3}-${ipsRecord.allergies.length}${delimiter}`;
            ipsRecord.allergies.forEach((allergy) => {
                basicInfo += `${allergy.name}${delimiter}`;
                basicInfo += `${criticalityMap[allergy.criticality] || 'm'}${delimiter}`;
                basicInfo += `${formatDate(allergy.date)}${delimiter}`;
            });
        }

        // Condition information
        if (ipsRecord.conditions && ipsRecord.conditions.length > 0) {
            basicInfo += `C${2}-${ipsRecord.conditions.length}${delimiter}`;
            ipsRecord.conditions.forEach((condition) => {
                const diffMs = new Date(condition.date) - currentTimestamp;
                const diffMinutes = Math.round(diffMs / 60000);

                // Express time in minutes if within 24 hours, otherwise in yyyymmdd
                const conditionTime = (Math.abs(diffMinutes) < 1440) ? diffMinutes : formatDate(new Date(condition.date));

                basicInfo += `${condition.name}${delimiter}`;
                basicInfo += `${conditionTime}${delimiter}`;
            });
        }

        // Send the plain text response
        res.set('Content-Type', 'text/plain');
        res.send(basicInfo);
    } catch (error) {
        console.error('Error fetching IPS record:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Export the getIPSBEER function
module.exports = getIPSBEER;
