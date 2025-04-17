const moment = require('moment');

function generateIPSHL72_x(data) {
    // Initialize HL7 message
    let hl7Message = '';

    // MSH Segment - 
    hl7Message += `MSH|^~\\&|IPSMERN|UKMOD|ReceivingApp|ReceivingFac|${moment(data.timeStamp).format('YYYYMMDDHHmmss')}||MDM^T01|${data.packageUUID}|P|2.3\n`;

    // PID Segment
    hl7Message += `PID|||123456^^^${data.patient.organization}^ISO||${data.patient.name}^${data.patient.given}||${moment(data.patient.dob).format('YYYYMMDD')}|${data.patient.gender.charAt(0)}|||^^^${data.patient.nation}|||\n`;

    // IVC Segment
    //hl7Message += `IVC||${data.patient.practitioner}\n`

    // RXA Segments
    if (data.medication.length) {
        data.medication.forEach((med, index) => {
            hl7Message += `RXA|0|1|${moment(med.date).format('YYYYMMDDHHmmss')}|${moment(med.date).format('YYYYMMDDHHmmss')}|${med.code}^${med.name}^${med.system}^MED^${med.dosage}\n`;
        });
    }

    // RXA Segments for Immunizations
    if (data.immunizations && data.immunizations.length) {
        data.immunizations.forEach((immunization, index) => {
            hl7Message += `RXA|0|1|${moment(immunization.date).format('YYYYMMDDHHmmss')}|${moment(immunization.date).format('YYYYMMDDHHmmss')}|${immunization.code}^${immunization.name}^${immunization.system}^IMM\n`;
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
            hl7Message += `AL1|${index + 1}|DA|${allergy.code}^${allergy.name}^${allergy.system}|${severityCode}||${moment(allergy.date).format('YYYYMMDD')}\n`;
        });
    }

    // DG1 Segments
    if (data.conditions.length) {
        data.conditions.forEach((condition, index) => {
            hl7Message += `DG1|${index + 1}||${condition.code}^${condition.name}^${condition.system}||${moment(condition.date).format('YYYYMMDD')}\n`;
        });
    }

    // OBX Segments
    if (data.observations.length) {
        data.observations.forEach((obs, index) => {
            let valueType = 'TX'; // Default to Text
            let value = obs.value || ''; // Default to empty string if no value
            let units = '';

            if (obs.value) {
                const numericMatch = obs.value.match(
                    /^(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)\s*(\S+)?$/
                  );
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

            hl7Message += `OBX|${index + 1}|${valueType}|${obs.code}^${obs.name}^${obs.system}||${value}|${units}|||F|||${moment(obs.date).format('YYYYMMDDHHmmss')}\n`;
        });
    }

    hl7Message += `PV1|1|N\n`;

    return hl7Message;
}

module.exports = { generateIPSHL72_x };