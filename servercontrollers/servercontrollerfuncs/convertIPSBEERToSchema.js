// servercontrollers/convertIPSBEERToSchema.js
function parseBEER(dataPacket, delimiter) {
    // Mapping delimiters
    const delimiterMap = {
        'pipe': '|',
        'semi': ';',
        'colon': ':',
        'at': '@',
        'newline': '\n'
    };

    let delim = delimiterMap[delimiter] || '\n';
    dataPacket = dataPacket + delim; // Ensure last line is parsed
    let lines = dataPacket.split(delim);

    // Basic Information
    const record = {};
    let currentIndex = 0;

    let bolDelimFound = false;
    if (lines[currentIndex] !== 'H9') {
        // Try other delimiters
        const delimiters = Object.keys(delimiterMap).filter(key => key !== delimiter);
        for (let i = 0; i < delimiters.length; i++) {
            delim = delimiterMap[delimiters[i]];
            lines = dataPacket.split(delim);
            if (lines[currentIndex] === 'H9') {
                // Successfully found delimiter
                bolDelimFound = true;
                break;
            }
        } 
    } else {
        bolDelimFound = true;
    }

    if (!bolDelimFound) {
        throw new Error('Unsupported delimiter or wrong data format');
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
        dob: dobFunction(), // Convert yyyymmdd to yyyy-mm-dd
        gender: mapGender(lines[currentIndex++]),
        practitioner: lines[currentIndex++],
        nation: lines[currentIndex++],
        organization: lines[currentIndex++]
    };

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
            const minutesList = lines[currentIndex++].split(',').map(min => parseInt(min, 10));
            const dosage = "Stat";
            currentIndex++; // Skip route line - may handle in future but dosage always assumed to be "Stat"
    
            minutesList.forEach(minutes => {
                const date = new Date(earliestMedTime.getTime() + minutes * 60000);
                medications.push({ name, date, dosage });
            });
        }
        return medications;
    };

    function dobFunction() {
        const line = lines[currentIndex++];
        try {
            const dobRaw = line.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
            // check if date is valid
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
                throw new Error('Invalid date');
            }
            const dob = new Date(dobRaw);
            return dob;
        } catch (error) {
            currentIndex--;
            // return todays date minus 20 years
            const fakeDate = new Date(new Date().getFullYear() - 20, 0, 1)
            console.log(`Error parsing date: ${line}. Using fake date: ${fakeDate}`);
            return fakeDate;
        }
    }

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
    const parseObservations = (count) => {
        const observations = [];
        for (let i = 0; i < count; i++) {
            const name = lines[currentIndex++];
            const dates = lines[currentIndex++].split(',').map(dateStr => new Date(dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')));
            const values = lines[currentIndex++].split(',');
            dates.forEach((date, index) => {
                observations.push({ name, date, value: values[index] });
            });
        }
        return observations;
    };

    if (lines[currentIndex].startsWith('O')) {
        const [prefix, typeInfo] = lines[currentIndex++].match(/^O(\d+)-(\d+)$/).slice(1, 3);
        const uniqueCount = parseInt(typeInfo, 10);
        record.observations = parseObservations(uniqueCount);
    } else {
        record.observations = [];
    }

    // Medication entries on or after timeStamp
    if (/^\d{12}$/.test(lines[currentIndex])) {
        let earliestMedTime = new Date(
            lines[currentIndex++].replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:00.000Z')
        );
        if (lines[currentIndex].startsWith('m')) {
            const [prefix, typeInfo] = lines[currentIndex++].match(/^m(\d+)-(\d+)$/).slice(1, 3);
            const uniqueCount = parseInt(typeInfo, 10);
            record.medication = record.medication.concat(parsePostMeds(uniqueCount, earliestMedTime));
        }
    }

    // Observation entries on or after timeStamp
    if (/^\d{12}$/.test(lines[currentIndex])) {
        let earliestObservationTime = new Date(
            lines[currentIndex++].replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:00.000Z')
        );

        const parseVitalSigns = (vCount, earliestObservationTime) => {
            const vitalSigns = [];
            const obsTypeMap = {
                'B': 'Blood Pressure',
                'P': 'Pulse',
                'R': 'Resp Rate',
                'T': 'Temperature',
                'O': 'Oxygen Sats',
                'A': 'AVPU'
            };

            // Needs obsUnitsMap
            const obsUnitsMap = {
                'B': 'mmHg',
                'P': 'bpm',
                'R': 'bpm',
                'T': 'cel',
                'O': '%',
                'A': ''
            };
            
            for (let i = 0; i < vCount; i++) {
                const line = lines[currentIndex++];
                const obsType = line[0];
                const units = obsUnitsMap[obsType];
                const obsName = obsTypeMap[obsType];
                const entries = line.substring(1).split(/[,]+/);
                
                entries.forEach(entry => {
                    const [time, value] = entry.split('+');
                    const minutes = parseInt(time, 10);
                    const date = new Date(earliestObservationTime.getTime() + minutes * 60000);
                    
                    // Need to add units to value
                    vitalSigns.push({ name: obsName, date, value: `${value}${units}` });
                });
            }
            
            return vitalSigns;
        };
        
        if (lines[currentIndex].startsWith('v')) {
            const [_, vCountStr] = lines[currentIndex++].match(/^v(\d+)$/);
            const vCount = parseInt(vCountStr, 10);
            record.observations = record.observations.concat(parseVitalSigns(vCount, earliestObservationTime));
        }               

        const parseOtherObservations = (oCount) => {
            const observations = [];
            for (let i = 0; i < oCount; i++) {
                const name = lines[currentIndex++];
                const minutesList = lines[currentIndex++].split(',').map(min => parseInt(min, 10));
                const values = lines[currentIndex++].split(',');
                minutesList.forEach((minutes, index) => {
                    const date = new Date(earliestObservationTime.getTime() + minutes * 60000);
                    observations.push({ name, date, value: values[index] });
                });
            }
            return observations;
        };

        if (lines[currentIndex].startsWith('o')) {
            const [_, typeInfo] = lines[currentIndex++].match(/^o(\d+)-(\d+)$/).slice(1, 3);
            const oCount = parseInt(typeInfo, 10);
            record.observations = record.observations.concat(parseOtherObservations(oCount));
        }
    }

    return record;
}

module.exports = { parseBEER };
