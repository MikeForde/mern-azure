function generateIPSBEER(ipsRecord, delimiter) {
    // Get current timestamp
    const currentTimestamp = new Date(ipsRecord.timeStamp);
    const currentTimestampString = currentTimestamp.toISOString();

    // Helper function to format dates as yyyymmdd
    const formatDate = (date) => {
        if (typeof date === 'string') {
            return date.substring(0, 10).replace(/-/g, '');
        }
        return date.toISOString().substring(0, 10).replace(/-/g, '');
    };

    // Helper function to format date and time as yyyymmddHHMM
    const formatDateTime = (date) => {
        if (typeof date === 'string') {
            date = new Date(date);
        }
        return date.toISOString().replace(/[-:T]/g, '').substring(0, 12);
    };

    // Helper function to check if an observation is a vital sign
    const isVitalSign = (name) => {
        const vitalSigns = [
            'Blood Pressure',
            'Pulse',
            'Resp Rate',
            'Temperature',
            'Oxygen Sats',
            'AVPU'
        ];
        return vitalSigns.includes(name);
    };

// Helper function to format vital signs observations
const formatVitalSigns = (vitalSigns, earliestDate) => {
    const obsTypeMap = {
        'Blood Pressure': 'B',
        'Pulse': 'P',
        'Resp Rate': 'R',
        'Temperature': 'T',
        'Oxygen Sats': 'O',
        'AVPU': 'A'
    };

    const formattedVitalSigns = {};

    vitalSigns.forEach(obs => {
        const diffMs = new Date(obs.date) - earliestDate;
        const diffMinutes = Math.round(diffMs / 60000);
        const obsType = obsTypeMap[obs.name];
        
        if (!formattedVitalSigns[obsType]) {
            formattedVitalSigns[obsType] = [];
        }

        let value = parseFloat(obs.value);
        if (obs.name === 'Blood Pressure') {
            const bpValues = obs.value.split('-');
            bpValues[1] = bpValues[1].replace('mmHg','');
            bpValues[1] = bpValues[1].trim();
            value = `${bpValues[0]}-${bpValues[1]}`;
        } else if (obs.name === 'AVPU') {
            value = obs.value;
        }
        
        formattedVitalSigns[obsType].push(`${diffMinutes}+${value}`);
    });

    return Object.entries(formattedVitalSigns).map(([obsType, entries]) => {
        return `${obsType}${entries.join(',')}`;
    }).join(delimiter);
};



    // Basic information
    let basicInfo = `H9${delimiter}`;
    basicInfo += `1${delimiter}`;
    basicInfo += `${ipsRecord.packageUUID}${delimiter}`;
    basicInfo += `${formatDateTime(ipsRecord.timeStamp)}${delimiter}`;
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
    basicInfo += `${ipsRecord.patient.organization || ''}${delimiter}`;

    // Medication information
    const pastMedications = [];
    const futureMedications = [];

    if (ipsRecord.medication && ipsRecord.medication.length > 0) {
        ipsRecord.medication.forEach((med) => {
            if (new Date(med.date) < currentTimestamp) {
                pastMedications.push(med);
            } else {
                futureMedications.push(med);
            }
        });

        if (pastMedications.length > 0) {
            const uniquePastMedications = [...new Set(pastMedications.map(med => med.name))];
            basicInfo += `M${3}-${uniquePastMedications.length}${delimiter}`;

            uniquePastMedications.forEach((medName) => {
                const medEntries = pastMedications.filter(med => med.name === medName);
                basicInfo += `${medName}${delimiter}`;

                const medTimes = medEntries.map(med => formatDate(med.date)).join(', ');
                basicInfo += `${medTimes}${delimiter}`;
                basicInfo += `${medEntries[0].dosage}${delimiter}`;
            });
        }
    }

    // Criticality formatting
    const criticalityMap = {
        'High': 'h',
        'Medium': 'm',
        'Low': 'l',
        'Moderate': 'm'
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

            const conditionTime = (Math.abs(diffMinutes) < 1440) ? diffMinutes : formatDate(new Date(condition.date));
            basicInfo += `${condition.name}${delimiter}`;
            basicInfo += `${conditionTime}${delimiter}`;
        });
    }

    // Observation information
    const pastObservations = [];
    const futureObservations = [];

    if (ipsRecord.observations && ipsRecord.observations.length > 0) {
        ipsRecord.observations.forEach((obs) => {
            if (new Date(obs.date) < currentTimestamp) {
                pastObservations.push(obs);
            } else {
                futureObservations.push(obs);
            }
        });

        if (pastObservations.length > 0) {
            const uniquePastObservations = [...new Set(pastObservations.map(obs => obs.name))];
            basicInfo += `O${3}-${uniquePastObservations.length}${delimiter}`;

            uniquePastObservations.forEach((obsName) => {
                const obsEntries = pastObservations.filter(obs => obs.name === obsName);
                basicInfo += `${obsName}${delimiter}`;

                const obsTimes = obsEntries.map(obs => formatDate(obs.date)).join(',');
                basicInfo += `${obsTimes}${delimiter}`;
                // If value add next
                basicInfo += `${obsEntries[0].value || ''}${delimiter}`;
            });
        }
    }

    // New medication section
    if (futureMedications.length > 0) {
        const earliestMedication = futureMedications.reduce((earliest, current) => {
            return new Date(current.date) < new Date(earliest.date) ? current : earliest;
        }, futureMedications[0]);

        const earliestMedicationTime = formatDateTime(earliestMedication.date);
        basicInfo += `${earliestMedicationTime}${delimiter}`;

        const uniqueFutureMedications = [...new Set(futureMedications.map(med => med.name))];
        basicInfo += `m${3}-${uniqueFutureMedications.length}${delimiter}`;

        uniqueFutureMedications.forEach((medName) => {
            const medEntries = futureMedications.filter(med => med.name === medName);
            basicInfo += `${medName}${delimiter}`;

            const earliestDate = new Date(earliestMedication.date);
            const medTimes = medEntries.map(med => {
                const diffMs = new Date(med.date) - earliestDate;
                const diffMinutes = Math.round(diffMs / 60000);
                return diffMinutes;
            }).join(',');

            basicInfo += `${medTimes}${delimiter}`;
            basicInfo += `O${medEntries.length}${delimiter}`;
        });
    }

    // New future observations section
    if (futureObservations.length > 0) {
        const earliestObservation = futureObservations.reduce((earliest, current) => {
            return new Date(current.date) < new Date(earliest.date) ? current : earliest;
        }, futureObservations[0]);

        const earliestObservationTime = formatDateTime(earliestObservation.date);
        basicInfo += `${earliestObservationTime}${delimiter}`;

        const vitalSigns = futureObservations.filter(obs => isVitalSign(obs.name));
        const otherObservations = futureObservations.filter(obs => !isVitalSign(obs.name));

        if (vitalSigns.length > 0) {
            const vitalSignsCount = new Set(vitalSigns.map(obs => obs.name)).size;
            basicInfo += `v${vitalSignsCount}${delimiter}`;
            basicInfo += `${formatVitalSigns(vitalSigns, new Date(earliestObservation.date))}${delimiter}`;
        }

        if (otherObservations.length > 0) {
            basicInfo += `o3-${otherObservations.length}${delimiter}`;

            otherObservations.forEach((obs) => {
                const diffMs = new Date(obs.date) - new Date(earliestObservation.date);
                const diffMinutes = Math.round(diffMs / 60000);
                basicInfo += `${obs.name}${delimiter}${diffMinutes}${delimiter}${obs.value || ''}${delimiter}`;
            });
        }
    }

    return basicInfo;
}

module.exports = { generateIPSBEER };
