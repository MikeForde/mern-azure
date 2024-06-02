// servercontrollers/convertIPSBEERToSchema.js
function parseBEER(dataPacket, delimiter) {
    // Mapping delimiters
    const delimiterMap = {
        'semi': ';',
        'colon': ':',
        'comma': ',',
        'newline': '\n'
    };

    const delim = delimiterMap[delimiter] || '\n';
    const lines = dataPacket.split(delim);

    // Basic Information
    const record = {};
    let currentIndex = 0;

    if (lines[currentIndex] !== 'H9') {
        throw new Error('Invalid data packet format - first line should be H9');
    }
    currentIndex++; // Skip header

    if (lines[currentIndex] !== '1') {
        throw new Error('Unsupported version');
    }
    currentIndex++; // Skip version

    // Helper function to map gender
    function mapGender(gender) {
        const genderMap = {
            'm': 'Male',
            'f': 'Female',
            'u': 'Unknown',
            'o': 'Other'
        };
        return genderMap[gender] || 'Unknown';
    }

    // Parsing basic info
    record.packageUUID = lines[currentIndex++];
    record.timeStamp = new Date(lines[currentIndex++].replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:00.000Z'));
    record.patient = {
        name: lines[currentIndex++],
        given: lines[currentIndex++],
        dob: new Date(lines[currentIndex++].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')), // Convert yyyymmdd to yyyy-mm-dd
        gender: mapGender(lines[currentIndex++]),
        practitioner: lines[currentIndex++],
        nation: lines[currentIndex++],
    };

    currentIndex++; // Skip UK MOD

    const parsePreMeds = (count) => {
        const medications = [];
        for (let i = 0; i < count; i++) {
            const name = lines[currentIndex++];
            const date = new Date(lines[currentIndex++].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
            const dosage = lines[currentIndex++];
            medications.push({ name, date, dosage });
        }
        return medications;
    };
    
    const parsePostMeds = (count, earliestMedTime) => {
        const medications = [];
        for (let i = 0; i < count; i++) {
            const name = lines[currentIndex++];
            const minutesList = lines[currentIndex++].split(', ').map(min => parseInt(min, 10));
            const dosage = "Stat";
            currentIndex++; // Skip route line - may handle in future but dosage always assumed to be "Stat"
    
            minutesList.forEach(minutes => {
                const date = new Date(earliestMedTime.getTime() + minutes * 60000);
                medications.push({ name, date, dosage });
            });
        }
        return medications;
    };

    // Helper function to parse allergies criticality
    function mapCriticality(criticality) {
        const criticalityMap = {
            'l': 'Low',
            'm': 'Medium',
            'h': 'High'
        };
        return criticalityMap[criticality] || 'Unknown';
    }

    const parseAllergies = (count) => {
        const allergies = [];
        for (let i = 0; i < count; i++) {
            const name = lines[currentIndex++];
            const criticality = mapCriticality(lines[currentIndex++]);
            const date = new Date(lines[currentIndex++].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
            allergies.push({ name, criticality, date });
        }
        return allergies;
    };

    const parseConditions = (count) => {
        const conditions = [];
        for (let i = 0; i < count; i++) {
            const name = lines[currentIndex++];
            const date = new Date(lines[currentIndex++].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
            conditions.push({ name, date });
        }
        return conditions;
    };

    // Medication entries before timeStamp
    if (lines[currentIndex].startsWith('M')) {
        const [prefix, typeInfo] = lines[currentIndex++].match(/^M(\d+)-(\d+)$/).slice(1, 3);
        const uniqueCount = parseInt(typeInfo, 10);
        record.medication = parsePreMeds(uniqueCount);
    } else {
        record.medication = [];
    }

    // Allergy entries
    if (lines[currentIndex].startsWith('A')) {
        const [prefix, typeInfo] = lines[currentIndex++].match(/^A(\d+)-(\d+)$/).slice(1, 3);
        const uniqueCount = parseInt(typeInfo, 10);
        record.allergies = parseAllergies(uniqueCount);
    } else {
        record.allergies = [];
    }

    // Condition entries
    if (lines[currentIndex].startsWith('C')) {
        const [prefix, typeInfo] = lines[currentIndex++].match(/^C(\d+)-(\d+)$/).slice(1, 3);
        const uniqueCount = parseInt(typeInfo, 10);
        record.conditions = parseConditions(uniqueCount);
    } else {
        record.conditions = [];
    }

    // Observation entries
    if (lines[currentIndex].startsWith('O')) {
        const [prefix, typeInfo] = lines[currentIndex++].match(/^O(\d+)-(\d+)$/).slice(1, 3);
        const uniqueCount = parseInt(typeInfo, 10);
        record.observations = [];
        for (let i = 0; i < uniqueCount; i++) {
            record.observations.push({
                name: lines[currentIndex++],
                date: new Date(lines[currentIndex++].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')),
                value: lines[currentIndex++]
            });
        }
    } else {
        record.observations = [];
    }

    // Medication entries on or after timeStamp
    if (/^\d{12}$/.test(lines[currentIndex])) {
        const earliestMedTime = new Date(
            lines[currentIndex].replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:00.000Z')
        );
        currentIndex++;
        const [prefix, typeInfo] = lines[currentIndex++].match(/^m(\d+)-(\d+)$/).slice(1, 3);
        const uniqueCount = parseInt(typeInfo, 10);
        record.medication = record.medication.concat(parsePostMeds(uniqueCount, earliestMedTime));
    }

    return record;
}

module.exports = { parseBEER };
