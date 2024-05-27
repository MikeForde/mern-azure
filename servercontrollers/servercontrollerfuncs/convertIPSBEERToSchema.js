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
        throw new Error('Invalid data packet format');
    }
    currentIndex++; // Skip header

    if (lines[currentIndex] !== '1') {
        throw new Error('Unsupported version');
    }
    currentIndex++; // Skip version

    // Parsing basic info
    record.packageUUID = lines[currentIndex++];
    record.patient = {
        name: lines[currentIndex++],
        given: lines[currentIndex++],
        dob: new Date(lines[currentIndex++].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')), // Convert yyyymmdd to yyyy-mm-dd
        gender: lines[currentIndex++],
        practitioner: lines[currentIndex++],
        nation: lines[currentIndex++],
    };

    if (lines[currentIndex++] !== 'UK MOD') {
        throw new Error('Invalid data packet format');
    }

    // Helper function to parse entries
    const parseMedications = (count) => {
        const medications = [];
        for (let i = 0; i < count; i++) {
            const name = lines[currentIndex++];
            const dates = lines[currentIndex++].split(', ').map(min => {
                if (/^\d+$/.test(min)) {
                    return new Date(record.timestamp.getTime() + min * 60000);
                } else {
                    return new Date(min.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
                }
            });
            const dosage = lines[currentIndex++];

            dates.forEach(date => {
                medications.push({ name, date, dosage });
            });
        }
        return medications;
    };

    const parseAllergies = (count) => {
        const allergies = [];
        for (let i = 0; i < count; i++) {
            const name = lines[currentIndex++];
            const criticality = lines[currentIndex++];
            const date = new Date(lines[currentIndex++].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
            allergies.push({ name, criticality, date });
        }
        return allergies;
    };

    const parseConditions = (count) => {
        const conditions = [];
        for (let i = 0; i < count; i++) {
            const name = lines[currentIndex++];
            const date = lines[currentIndex++];
            const formattedDate = /^\d+$/.test(date)
                ? new Date(record.timestamp.getTime() + date * 60000)
                : new Date(date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
            conditions.push({ name, date: formattedDate });
        }
        return conditions;
    };

    // Medication entries
    if (lines[currentIndex].startsWith('M')) {
        const [prefix, typeInfo] = lines[currentIndex++].match(/^M(\d+)-(\d+)$/).slice(1, 3);
        const uniqueCount = parseInt(typeInfo, 10);
        record.medication = parseMedications(uniqueCount);
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

    return record;
}

module.exports = { parseBEER };
