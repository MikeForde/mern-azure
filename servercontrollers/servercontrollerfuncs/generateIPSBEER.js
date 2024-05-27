function generateIPSBEER(ipsRecord, delimiter) {
    // Get current timestamp
    const currentTimestamp = new Date();
    const currentTimestampString = currentTimestamp.toISOString();

    // Helper function to format dates as yyyymmdd
    const formatDate = (date) => {
        // Check if date is already a string
        if (typeof date === 'string') {
            return date.substring(0, 10).replace(/-/g, '');
        }
        // Otherwise, assume it's a Date object
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

    return basicInfo;
}

module.exports = { generateIPSBEER };
