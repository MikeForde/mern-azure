function generateIPSBasic(ipsRecord) {
    let basicInfo = '';
    basicInfo += `${ipsRecord.packageUUID}\r\n`;
    basicInfo += `${ipsRecord.timeStamp.toISOString()}\r\n`;
    basicInfo += `${ipsRecord.patient.name}\r\n`;
    basicInfo += `${ipsRecord.patient.given}\r\n`;

    const dob = ipsRecord.patient.dob.toISOString().substring(0, 10);
    basicInfo += `${dob}\r\n`;

    basicInfo += `${ipsRecord.patient.gender}\r\n`;
    basicInfo += `${ipsRecord.patient.nation}\r\n`;
    basicInfo += `${ipsRecord.patient.practitioner}\r\n`;
    basicInfo += `${ipsRecord.patient.organization}\r\n`;

    ipsRecord.medication.forEach((med) => {
        const medDate = med.date.toISOString().substring(0, 10);
        basicInfo += `M:\r\n${med.name}\r\n${medDate}\r\n${med.dosage}\r\n`;
    });

    ipsRecord.allergies.forEach((allergy) => {
        const allergyDate = allergy.date.toISOString().substring(0, 10);
        basicInfo += `A:\r\n${allergy.name}\r\n${allergy.criticality}\r\n${allergyDate}\r\n`;
    });

    ipsRecord.conditions.forEach((condition) => {
        const conditionDate = condition.date.toISOString().substring(0, 10);
        basicInfo += `C:\r\n${condition.name}\r\n${conditionDate}\r\n`;
    });

    ipsRecord.observations.forEach((observation) => {
        const observationDate = observation.date.toISOString().substring(0, 10);
        basicInfo += `O:\r\n${observation.name}\r\n${observationDate}\r\n${observation.value}\r\n`;
    });

    ipsRecord.immunizations.forEach((immunization) => {
        const immunizationDate = immunization.date.toISOString().substring(0, 10);
        basicInfo += `I:\r\n${immunization.name}\r\n${immunization.system}\r\n${immunizationDate}\r\n`;
    });

    ipsRecord.procedures.forEach((procedure) => {
        const procedureDate = procedure.date.toISOString().substring(0, 10);
        basicInfo += `P:\r\n${procedure.name}\r\n${procedureDate}\r\n`;
    }
    );

    return basicInfo;
}

module.exports = { generateIPSBasic };
