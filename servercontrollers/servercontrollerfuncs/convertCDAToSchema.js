// servercontrollerfuncs/convertCDAToSchema.js
function convertCDAToSchema(cdaJSON) {
    const cdaObject = cdaJSON.clinicaldocument;

    const getValue = (path) => {
        return path?._ || '';
    };

    const getCodeValue = (node) => node?.$?.displayName || node?.$?.code || '';

    const getCode = (element) => element?.$?.code || '';

    const getDateValue = (element) => {
        if (!element || !element.$) return null;
        const date = element.$.value;
        const formattedDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
        if (date.length > 8) {
            const time = `${date.slice(8, 10)}:${date.slice(10, 12)}:${date.slice(12, 14)}`;
            return new Date(`${formattedDate}T${time}.000Z`);
        }
        return new Date(`${formattedDate}T00:00:00.000Z`);
    };

    const parseTimestamp = (value) => {
        if (value) {
            const [datePart, offset] = value.split(/[+-]/);
            const formattedDate = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;

            let formattedTime = `${datePart.slice(8, 10)}:${datePart.slice(10, 12)}`;
            if (datePart.length > 12) {
                // If there are more characters, add the seconds
                formattedTime += `:${datePart.slice(12, 14)}`;
            } else {
                // Otherwise, assume no seconds part
                formattedTime += `:00`;
            }

            const sign = value.includes('+') ? '+' : '-';
            const formattedOffset = `${sign}${offset.slice(0, 2)}:${offset.slice(2)}`;

            return new Date(`${formattedDate}T${formattedTime}${formattedOffset}`);
        }
        return null;
    };


    const parseDate = (value) => {
        if (value && value.length === 8) {
            const formattedDate = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
            return new Date(`${formattedDate}T00:00:00.000Z`);
        }
        return null;
    };

    // Helper function to map gender codes to readable format
    const mapGender = (code) => {
        const genderMap = {
            'M': 'Male',
            'F': 'Female',
            'U': 'Unknown',
            'O': 'Other'
        };
        return genderMap[code] || 'Unknown';
    };

    const patient = {};
    const medication = [];
    const allergies = [];
    const conditions = [];
    const observations = [];

    // Extract patient details
    const recordTarget = cdaObject.recordtarget[0]?.patientrole?.[0]?.patient?.[0];
    patient.name = getValue(recordTarget?.name?.[0]?.family?.[0]);
    patient.given = getValue(recordTarget?.name?.[0]?.given?.[0]);
    patient.dob = parseDate(recordTarget?.birthtime?.[0]?.$?.value || '');
    patient.gender = mapGender(recordTarget?.administrativegendercode?.[0]?.$?.code || 'U');
    patient.nation = cdaObject.realmcode?.[0]?.$?.code || 'Unknown';

    // Extract practitioner and organization details
    const participant = cdaObject.participant?.[0];
    patient.practitioner = `${getValue(participant?.associatedentity?.[0]?.associatedperson?.[0]?.name?.[0]?.given?.[0])} ${getValue(participant?.associatedentity?.[0]?.associatedperson?.[0]?.name?.[0]?.family?.[0])}`;
    patient.organization = getValue(cdaObject.author?.[0]?.assignedAuthor?.[0]?.representedOrganization?.[0]?.name?.[0]) || 'NL MOD';

    const components = cdaObject.component?.[0]?.structuredbody?.[0]?.component;
    if (components) {
        // Extract medication details
        const medicationSection = components.find(c =>
            getCode(c.section?.[0]?.code?.[0]) === '10160-0' &&
            c.section?.[0]?.code?.[0]?.$?.codeSystemName === 'LOINC'
        );

        if (medicationSection) {
            medicationSection.section?.[0]?.entry?.forEach(entry => {
                const substanceAdmin = entry?.substanceadministration?.[0];

                // Find the first entryRelationship of type 'COMP'
                const compEntryRelationship = substanceAdmin?.entryrelationship?.find(er => er?.$?.typeCode === 'COMP');
                const doseQuantity = compEntryRelationship?.substanceadministration?.[0]?.effectivetime?.[0]?.['hl7nl:frequency']?.[0]?.['hl7nl:denominator']?.[0]?.$;

                medication.push({
                    name: getCodeValue(substanceAdmin?.consumable?.[0]?.manufacturedproduct?.[0]?.manufacturedmaterial?.[0]?.code?.[0]),
                    date: parseTimestamp(substanceAdmin?.effectivetime?.[0]?.low?.[0]?.$?.value),
                    dosage: doseQuantity ? `${doseQuantity.value} per ${doseQuantity.unit}` : ''
                });
            });
        }

        // Extract allergy details
        const allergySection = components.find(c =>
            getCode(c.section?.[0]?.code?.[0]) === '48765-2' &&
            c.section?.[0]?.code?.[0]?.$?.codeSystemName === 'LOINC'
        );

        if (allergySection) {
            allergySection.section?.[0]?.entry?.forEach(entry => {
                const allergy = getCodeValue(entry.act?.[0].entryrelationship[0].observation[0].participant[0].participantrole[0].playingentity[0].code[0]);

                if (allergy) {
                    allergies.push({
                        name: allergy,
                        criticality: entry.act?.[0].entryrelationship[0].observation[0].entryrelationship[1].observation[0].value[0]?.$?.displayName || 'Moderate',
                        date: parseTimestamp(entry.act[0].entryrelationship[0].observation[0].effectivetime?.[0]?.low?.[0]?.$?.value)
                    });
                }
            });
        }

        // Extract condition details
        const conditionSection = components.find(c =>
            getCode(c.section?.[0]?.code?.[0]) === '11450-4' &&
            c.section?.[0]?.code?.[0]?.$?.displayName === 'Problem list Reported'
        );

        if (conditionSection) {
            conditionSection.section?.[0]?.entry?.forEach(entry => {
                const condition = getCodeValue(entry.act?.[0].entryrelationship[0].observation[0].value[0]);

                conditions.push({
                    name: condition,
                    date: new Date(parseDate(entry.act?.[0].entryrelationship[0].observation[0].effectivetime[0].low[0].$?.value)) || ''
                });
            });
        }

        // Extract observation details
        const observationSection = components.find(c =>
            getCode(c.section?.[0]?.code?.[0]) === '8716-3' &&
            c.section?.[0]?.code?.[0]?.$?.displayName === 'Vital signs'
        );

        if (observationSection) {
            observationSection.section?.[0]?.entry?.[0]?.organizer?.[0]?.component.forEach(c => {
                const element = c;

                // If it is a BP then the element is an organizer
                // Whereas a single value observation is simply an observation

                if (element.observation) {
                    observations.push({
                        name: element.observation[0].code[0]?.$?.displayName || '',
                        date: parseTimestamp(element.observation[0].effectivetime[0].$?.value),
                        value: element.observation[0].value[0]?.$?.value + element.observation[0].value[0]?.$?.unit || ''
                    });
                } else if (element.organizer) {
                    const diastolic = element.organizer[0].component[0].observation[0].value[0].$?.value;
                    const systolic = element.organizer[0].component[1].observation[0].value[0].$?.value;

                    observations.push({
                        name: 'Blood Pressure',
                        date: parseTimestamp(element.organizer[0].component[0].observation[0].effectivetime[0].$?.value),
                        value: `${systolic}-${diastolic}mmHg`
                    });
                }
            });
        }



    }


    const packageUUID = cdaObject.id?.[0]?.$?.root || '';
    const effectivetime = cdaObject.effectivetime?.[0]?.$?.value || '';
    const formattedeffectivetime = parseTimestamp(effectivetime);
    const timeStamp = new Date(formattedeffectivetime);

    return { packageUUID, timeStamp, patient, medication, allergies, conditions, observations };
}

module.exports = { convertCDAToSchema };
