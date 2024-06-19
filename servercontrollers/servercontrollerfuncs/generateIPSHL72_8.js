const moment = require('moment');

function generateIPSHL72_8(data) {
    // Initialize HL7 message
    let hl7Message = '';

    // MSH Segment - 
    hl7Message += `MSH|^~\\&|SendingApp|SendingFac|ReceivingApp|ReceivingFac|${moment(data.timeStamp).format('YYYYMMDDHHmmss')}||ORM^O01|${data.packageUUID}|P|2.8\n`;

    // PID Segment
    hl7Message += `PID|||123456^^^AssigningAuthority^ISO||${data.patient.name}^${data.patient.given}||${moment(data.patient.dob).format('YYYYMMDD')}|${data.patient.gender.charAt(0)}|||^^^${data.patient.nation}|||\n`;

    // RXA Segments
    if (data.medication.length) {
        data.medication.forEach((med, index) => {
            hl7Message += `RXA|0|1|${moment(med.date).format('YYYYMMDDHHmmss')}|${moment(med.date).format('YYYYMMDDHHmmss')}|${med.name}|${med.dosage}\n`;
        });
    }

    // AL1 Segments
    if (data.allergies.length) {
        data.allergies.forEach((allergy, index) => {
            let severityCode = 'U'; // Unknown by default
            switch (allergy.criticality.toLowerCase()) {
                case 'high': severityCode = 'SV'; break;
                case 'moderate': severityCode = 'MO'; break;
                case 'mild': severityCode = 'MI'; break;
            }
            hl7Message += `AL1|${index + 1}|DA|^${allergy.name}|${severityCode}||${moment(allergy.date).format('YYYYMMDD')}\n`;
        });
    }

    // DG1 Segments
    if (data.conditions.length) {
        data.conditions.forEach((condition, index) => {
            hl7Message += `DG1|${index + 1}||^${condition.name}^ICD-10-CM||${moment(condition.date).format('YYYYMMDD')}\n`;
        });
    }

    // OBX Segments
    if (data.observations.length) {
        data.observations.forEach((obs, index) => {
            let valueType = 'TX'; // Default to Text
            let value = obs.value || ''; // Default to empty string if no value
            let units = '';

            if (obs.value) {
                const numericMatch = obs.value.match(/^(\d+\.?\d*)\s*(\w+)?$/);
                if (numericMatch) {
                    const [_, numericValue, unit] = numericMatch;
                    valueType = 'NM'; // Numeric
                    value = numericValue;
                    units = unit || '';
                } else {
                    valueType = 'TX'; // Text or coded entries
                }
            } else {
                valueType = 'CE'; // If no value, default to Coded Entry
            }

            hl7Message += `OBX|${index + 1}|${valueType}|^${obs.name}||${value}|${units}|||F|||${moment(obs.date).format('YYYYMMDDHHmmss')}\n`;
        });
    }

    return hl7Message;
}

module.exports = { generateIPSHL72_8 };

