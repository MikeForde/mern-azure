function formatTimestamp(dateInput) {
  if (!dateInput) return '';

  const dateObj = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  if (isNaN(dateObj)) return '';

  const iso = dateObj.toISOString();
  const datePart = iso.substring(0, 10);
  const timePart = iso.substring(11, 19);

  return (timePart === '00:00:00' || timePart === undefined) ? datePart : `${datePart} ${timePart}`;
}

function calculateColumnWidths(records, fields) {
  const widths = fields.map(field => field.length); // header width as starting point

  records.forEach(record => {
    fields.forEach((field, idx) => {
      const val = (record[field] !== undefined && record[field] !== null) ? record[field].toString() : '';
      widths[idx] = Math.max(widths[idx], val.length);
    });
  });

  return widths;
}

function formatRow(values, widths) {
  return values.map((val, idx) => {
    const str = (val !== undefined && val !== null) ? val.toString() : '';
    return str.padEnd(widths[idx], ' ');
  }).join('  ') + '\n';
}

function generateXMPPPlainText(ipsRecord, omitObsImmProc = false) {
  let output = '';

  output += `IPS UUID: ${ipsRecord.packageUUID}\n`;
  output += `Timestamp: ${formatTimestamp(ipsRecord.timeStamp)}\n\n`;

  output += `Patient Details:\n`;
  output += `Name:         ${ipsRecord.patient.name}\n`;
  output += `Given Name:   ${ipsRecord.patient.given}\n`;
  output += `DOB:          ${formatTimestamp(ipsRecord.patient.dob)}\n`;
  output += `Gender:       ${ipsRecord.patient.gender}\n`;
  output += `Country:      ${ipsRecord.patient.nation}\n`;
  output += `Practitioner: ${ipsRecord.patient.practitioner}\n`;
  output += `Organization: ${ipsRecord.patient.organization}\n\n`;

  // Medications
  if (ipsRecord.medication && ipsRecord.medication.length) {
    output += `Medications:\n`;

    if (!omitObsImmProc) {
      var fields = ['name', 'code', 'system', 'date', 'dosage'];
      var data = ipsRecord.medication.map(med => ({
        name: med.name || '',
        code: med.code || '',
        system: med.system || '',
        date: formatTimestamp(med.date),
        dosage: med.dosage || ''
      }));
    } else {
      var fields = ['name', 'date', 'dosage'];
      var data = ipsRecord.medication.map(med => ({
        name: med.name || '',
        date: formatTimestamp(med.date),
        dosage: med.dosage || ''
      }));
    }

    const widths = calculateColumnWidths(data, fields);
    output += formatRow(fields.map(f => f.charAt(0).toUpperCase() + f.slice(1)), widths);
    data.forEach(med => output += formatRow(fields.map(f => med[f]), widths));
    output += '\n';
  }

  // Allergies
  if (ipsRecord.allergies && ipsRecord.allergies.length) {
    output += `Allergies:\n`;

    if (!omitObsImmProc) {
      var fields = ['name', 'code', 'system', 'criticality', 'date'];
      var data = ipsRecord.allergies.map(allergy => ({
        name: allergy.name || '',
        code: allergy.code || '',
        system: allergy.system || '',
        criticality: allergy.criticality || '',
        date: formatTimestamp(allergy.date)
      }));
    } else {
      var fields = ['name', 'date'];
      var data = ipsRecord.allergies.map(allergy => ({
        name: allergy.name || '',
        date: formatTimestamp(allergy.date)
      }));
    }

    const widths = calculateColumnWidths(data, fields);
    output += formatRow(fields.map(f => f.charAt(0).toUpperCase() + f.slice(1)), widths);
    data.forEach(allergy => output += formatRow(fields.map(f => allergy[f]), widths));
    output += '\n';
  }

  // Conditions
  if (ipsRecord.conditions && ipsRecord.conditions.length) {
    output += `Conditions:\n`;

    if (!omitObsImmProc) {
      var fields = ['name', 'code', 'system', 'date'];
      var data = ipsRecord.conditions.map(cond => ({
        name: cond.name || '',
        code: cond.code || '',
        system: cond.system || '',
        date: formatTimestamp(cond.date)
      }));
    } else {
      var fields = ['name', 'date'];
      var data = ipsRecord.conditions.map(cond => ({
        name: cond.name || '',
        date: formatTimestamp(cond.date)
      }));
    }

    const widths = calculateColumnWidths(data, fields);
    output += formatRow(fields.map(f => f.charAt(0).toUpperCase() + f.slice(1)), widths);
    data.forEach(cond => output += formatRow(fields.map(f => cond[f]), widths));
    output += '\n';
  }

  if (omitObsImmProc) {
    return output;
  }

  // Observations
  if (ipsRecord.observations && ipsRecord.observations.length) {
    output += `Observations:\n`;

    const fields = ['name', 'code', 'system', 'date', 'value'];
    const data = ipsRecord.observations.map(obs => ({
      name: obs.name || '',
      code: obs.code || '',
      system: obs.system || '',
      date: formatTimestamp(obs.date),
      value: obs.value || ''
    }));

    const widths = calculateColumnWidths(data, fields);
    output += formatRow(fields.map(f => f.charAt(0).toUpperCase() + f.slice(1)), widths);
    data.forEach(obs => output += formatRow(fields.map(f => obs[f]), widths));
    output += '\n';
  }

  // Immunizations
  if (ipsRecord.immunizations && ipsRecord.immunizations.length) {
    output += `Immunizations:\n`;

    const fields = ['name', 'system', 'date'];
    const data = ipsRecord.immunizations.map(imm => ({
      name: imm.name || '',
      system: imm.system || '',
      date: formatTimestamp(imm.date)
    }));

    const widths = calculateColumnWidths(data, fields);
    output += formatRow(fields.map(f => f.charAt(0).toUpperCase() + f.slice(1)), widths);
    data.forEach(imm => output += formatRow(fields.map(f => imm[f]), widths));
    output += '\n';
  }

  // Procedures
  if (ipsRecord.procedures && ipsRecord.procedures.length) {
    output += `Procedures:\n`;

    const fields = ['name', 'code', 'system', 'date'];
    const data = ipsRecord.procedures.map(proc => ({
      name: proc.name || '',
      code: proc.code || '',
      system: proc.system || '',
      date: formatTimestamp(proc.date)
    }));

    const widths = calculateColumnWidths(data, fields);
    output += formatRow(fields.map(f => f.charAt(0).toUpperCase() + f.slice(1)), widths);
    data.forEach(proc => output += formatRow(fields.map(f => proc[f]), widths));
    output += '\n';
  }

  return output;
}

module.exports = {
  generateXMPPPlainText,
};
