function formatTimestamp(dateInput) {
  if (!dateInput) return '';

  const dateObj = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  if (isNaN(dateObj)) return '';

  const iso = dateObj.toISOString();
  const datePart = iso.substring(0, 10);
  const timePart = iso.substring(11, 19);

  return timePart === '00:00:00' ? datePart : `${datePart} ${timePart}`;
}

  
  function generateXMPPPlainText(ipsRecord) {
    let output = '';

    console.log("timeStamp" + ipsRecord.timeStamp);
  
    output += `IPS UUID: ${ipsRecord.packageUUID}\n`;
    output += `Timestamp: ${formatTimestamp(ipsRecord.timeStamp)}\n`;
  
    output += `Patient Details:\n`;
    output += `Name: ${ipsRecord.patient.name}\n`;
    output += `Given Name: ${ipsRecord.patient.given}\n`;
    output += `DOB: ${formatTimestamp(ipsRecord.patient.dob)}\n`;
    output += `Gender: ${ipsRecord.patient.gender}\n`;
    output += `Country: ${ipsRecord.patient.nation}\n`;
    output += `Practitioner: ${ipsRecord.patient.practitioner}\n`;
    output += `Organization: ${ipsRecord.patient.organization}\n\n`;
  
    output += `Medications:\n`;
    output += `Name\tCode\tSystem\tDate\tDosage\n`;
    ipsRecord.medication.forEach((med) => {
      output += `${med.name}\t${med.code}\t${med.system}\t${formatTimestamp(med.date)}\t${med.dosage}\n`;
    });
    output += `\n`;
  
    output += `Allergies:\n`;
    output += `Name\tCode\tSystem\tCriticality\tDate\n`;
    ipsRecord.allergies.forEach((allergy) => {
      output += `${allergy.name}\t${allergy.code}\t${allergy.system}\t${allergy.criticality}\t${formatTimestamp(allergy.date)}\n`;
    });
    output += `\n`;
  
    output += `Conditions:\n`;
    output += `Name\tCode\tSystem\tDate\n`;
    ipsRecord.conditions.forEach((condition) => {
      output += `${condition.name}\t${condition.code}\t${condition.system}\t${formatTimestamp(condition.date)}\n`;
    });
    output += `\n`;
  
    output += `Observations:\n`;
    output += `Name\tCode\tSystem\tDate\tValue\n`;
    ipsRecord.observations.forEach((obs) => {
      output += `${obs.name}\t${obs.code}\t${obs.system}\t${formatTimestamp(obs.date)}\t${obs.value}\n`;
    });
    output += `\n`;
  
    output += `Immunizations:\n`;
    output += `Name\tSystem\tDate\n`;
    ipsRecord.immunizations.forEach((imm) => {
      output += `${imm.name}\t${imm.system}\t${formatTimestamp(imm.date)}\n`;
    });
  
    return output;
  }
  
  module.exports = {
    generateXMPPPlainText,
  };
  