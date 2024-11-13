const moment = require('moment');

function parseHL72_8ToMongo(hl7Message) {
    const lines = hl7Message.split('\n').filter(line => line); // Split by new lines and remove any empty lines
    const data = {
        patient: {},
        medication: [],
        allergies: [],
        conditions: [],
        observations: [],
        immunizations: []
    };

    lines.forEach(line => {
        const segments = line.split('|');
        const segmentType = segments[0];

        switch (segmentType) {
            case 'MSH':
                data.packageUUID = segments[9];
                data.timeStamp = moment(segments[6], 'YYYYMMDDHHmmss').toDate();
                break;

            case 'PID':
                const [lastName, firstName] = segments[5].split('^');
                data.patient.name = lastName;
                data.patient.given = firstName;
                data.patient.dob = moment(segments[7], 'YYYYMMDD').toDate();
                data.patient.gender = segments[8] === 'M' ? 'Male' : (segments[8] === 'F' ? 'Female' : 'Other');
                data.patient.nation = segments[11].split('^')[3];
                data.patient.organization = segments[3].split('^')[3];
                break;

            case 'IVC':
                data.patient.practitioner = segments[2];
                break;

            case 'RXA':
                if (segments.length >= 6) {
                    const medicationName = segments[5];
                    const dosage = segments[6];
                    const date = moment(segments[3], 'YYYYMMDDHHmmss').toDate();
                    if (segments[5].includes('^')) {
                        // If this is an immunization (detected by presence of '^' in the name)
                        const [name, system] = medicationName.split('^');
                        data.immunizations.push({ name, system, date });
                    } else {
                        // Otherwise, it's a regular medication
                        data.medication.push({ name: medicationName, date, dosage });
                    }
                }
                break;

            case 'AL1':
                const allergyName = segments[3].split('^')[1];
                const criticalityMap = { 'SV': 'high', 'MO': 'moderate', 'MI': 'mild', 'U': 'unknown' };
                const criticality = criticalityMap[segments[4]] || 'unknown';
                const allergyDate = moment(segments[6], 'YYYYMMDD').isValid() ? moment(segments[6], 'YYYYMMDD').toDate() : null;
                data.allergies.push({ name: allergyName, criticality, date: allergyDate });
                break;

            case 'DG1':
                const conditionName = segments[3].split('^')[1];
                const conditionDate = moment(segments[5], 'YYYYMMDD').isValid() ? moment(segments[5], 'YYYYMMDD').toDate() : null;
                data.conditions.push({ name: conditionName, date: conditionDate });
                break;

            case 'OBX':
                const observationName = segments[3].split('^')[1];
                const observationValue = segments[5];
                const observationUnits = segments[6];
                const observationDate = moment(segments[12], 'YYYYMMDDHHmmss').isValid() ? moment(segments[12], 'YYYYMMDDHHmmss').toDate() : null;
                data.observations.push({ name: observationName, value: `${observationValue} ${observationUnits}`.trim(), date: observationDate });
                break;

            default:
                break;
        }
    });

    return data;
}

module.exports = { parseHL72_8ToMongo };
