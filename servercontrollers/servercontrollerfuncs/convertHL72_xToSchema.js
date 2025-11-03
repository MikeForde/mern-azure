const moment = require('moment');

function parseHL72_xToMongo(hl7Message) {
    const lines = hl7Message.split('\n').filter(line => line); // Split by new lines and remove any empty lines
    const data = {
        patient: {},
        medication: [],
        allergies: [],
        conditions: [],
        observations: [],
        immunizations: [],
        procedures: []
    };

    data.patient.practitioner = 'Unknown'; // Default to Unknown

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
                data.patient.gender = segments[8].toLowerCase() === 'm' ? 'male' : (segments[8].toLowerCase() === 'f' ? 'female' : 'other');
                data.patient.nation = segments[11].split('^')[3];
                data.patient.organization = segments[3].split('^')[3];
                break;

            case 'IVC':
                data.patient.practitioner = segments[2];
                break;

            case 'RXA':
                const rxaData5 = segments[5];
                const rxaData5Split = rxaData5.split('^');
                const meddate = moment(segments[3], 'YYYYMMDDHHmmss').toDate();
                if (rxaData5Split.length <5) {
                    // If this is an immunization 
                    const [immcode, immname, immsystem] = rxaData5Split;
                    data.immunizations.push({ name: immname, code: immcode, system: immsystem, date: meddate });
                } else {
                    // Otherwise, it's a regular medication
                    const [medcode, medname, medsystem, dummy ,meddosage] = rxaData5Split;
                    data.medication.push({ name: medname, code: medcode, system: medsystem, date: meddate, dosage: meddosage });
                }

                break;

            case 'AL1':
                const al1Data3 = segments[3];
                const [alcode, alname, alsystem] = al1Data3.split('^');
                const criticalityMap = { 'SV': 'high', 'MO': 'moderate', 'MI': 'mild', 'U': 'unknown' };
                const criticality = criticalityMap[segments[4]] || 'unknown';
                const allergyDate = moment(segments[6], 'YYYYMMDD').isValid() ? moment(segments[6], 'YYYYMMDD').toDate() : null;
                data.allergies.push({ name: alname, code: alcode, system: alsystem, criticality, date: allergyDate });
                break;

            case 'DG1':
                const dg1Data3 = segments[3];
                const [condcode, condname, condsystem] = dg1Data3.split('^');
                const conditionDate = moment(segments[5], 'YYYYMMDD').isValid() ? moment(segments[5], 'YYYYMMDD').toDate() : null;
                data.conditions.push({ name: condname, code: condcode, system: condsystem,  date: conditionDate });
                break;

            case 'OBX':
                const obxdata3 = segments[3];
                const [obcode, obname, obsystem] = obxdata3.split('^');
                const observationValue = segments[5];
                const observationUnits = segments[6];
                const observationDate = moment(segments[12], 'YYYYMMDDHHmmss').isValid() ? moment(segments[12], 'YYYYMMDDHHmmss').toDate() : null;
                data.observations.push({ name: obname, code: obcode, system: obsystem, value: `${observationValue} ${observationUnits}`.trim(), date: observationDate });
                break;

            default:
                break;
        }
    });

    return data;
}

module.exports = { parseHL72_xToMongo };
