const { v4: uuidv4 } = require('uuid');

const ZERO_ISO_DATETIME = '1970-01-01T00:00:00.000Z';
const ZERO_ISO_DATE = '1970-01-01';

function safeToISOString(value, fallback = ZERO_ISO_DATETIME) {
  if (value === undefined || value === null || value === '') return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

function safeToISODate(value, fallback = ZERO_ISO_DATE) {
  const iso = safeToISOString(value, `${fallback}T00:00:00.000Z`);
  return iso.split('T')[0];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function first(value) {
  return Array.isArray(value) && value.length > 0 ? value[0] : undefined;
}

function cleanString(value, fallback = undefined) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function normalizeReferenceId(ref) {
  if (!ref || typeof ref !== 'string') return undefined;
  if (ref.startsWith('#')) return ref.slice(1);
  if (ref.startsWith('urn:uuid:')) return ref.split(':').pop();
  if (ref.includes('/')) return ref.split('/').pop();
  return ref;
}

function findContained(resource, containedId) {
  if (!resource || !containedId) return undefined;
  return asArray(resource.contained).find(r => r?.id === containedId);
}

function getFirstCoding(codeableConcept) {
  return first(codeableConcept?.coding);
}

function getCodeableConceptDisplay(codeableConcept, fallback = null) {
  const coding = getFirstCoding(codeableConcept);
  return (
    cleanString(coding?.display) ||
    cleanString(codeableConcept?.text) ||
    fallback
  );
}

function getCodeableConceptCode(codeableConcept, fallback = null) {
  const coding = getFirstCoding(codeableConcept);
  return cleanString(coding?.code) || fallback;
}

function getCodeableConceptSystem(codeableConcept, fallback = null) {
  const coding = getFirstCoding(codeableConcept);
  return cleanString(coding?.system) || fallback;
}

function getHumanNameDisplay(humanName, fallback = 'Unknown') {
  if (!humanName) return fallback;

  const text = cleanString(humanName.text);
  if (text) return text;

  const family = cleanString(humanName.family);
  const given = cleanString(first(humanName.given));

  if (family && given) return `${family}, ${given}`;
  if (family) return family;
  if (given) return given;

  return fallback;
}

function getPatientName(patientResource) {
  const name0 = first(patientResource?.name);
  return {
    family: cleanString(name0?.family, 'Unknown'),
    given: cleanString(first(name0?.given), 'Unknown')
  };
}

function getBestDateTime(resource, fields, fallback = ZERO_ISO_DATETIME) {
  for (const field of fields) {
    const value = resource?.[field];
    if (value !== undefined && value !== null && value !== '') {
      return safeToISOString(value, fallback);
    }
  }
  return fallback;
}

function convertIPSBundleToSchema(ipsBundle) {
  const bundle = ipsBundle && typeof ipsBundle === 'object' ? ipsBundle : {};
  let packageUUID = cleanString(bundle.id) || uuidv4();
  let timeStamp = cleanString(bundle.timestamp)
    ? safeToISOString(bundle.timestamp)
    : new Date().toISOString();

  console.log('Starting conversion of IPS Bundle to schema...');

  const patient = {
    practitioner: 'Unknown'
  };

  let medication = [];
  let allergies = [];
  let conditions = [];
  let observations = [];
  let immunizations = [];
  let procedures = [];

  const medicationResourceMap = {};
  const entries = asArray(bundle.entry);

  for (const entryItem of entries) {
    const resource = entryItem?.resource;
    if (!resource || typeof resource !== 'object') continue;

    const resourceType = cleanString(resource.resourceType, '').toLowerCase();
    if (!resourceType) continue;

    switch (resourceType) {
      case 'composition':
        break;

      case 'patient': {
        const patientName = getPatientName(resource);
        patient.name = patientName.family;
        patient.given = patientName.given;
        patient.dob = safeToISODate(resource.birthDate);
        patient.gender = cleanString(resource.gender, 'Unknown');

        const address0 = first(resource.address);
        patient.nation = cleanString(address0?.country, 'Unknown');

        const identifiers = asArray(resource.identifier);
        const id0 = first(identifiers);
        const id1 = identifiers.length > 1 ? identifiers[1] : undefined;

        if (id0) {
          patient.identifier = cleanString(id0.value, 'Unknown');
        }
        if (id1) {
          patient.identifier2 = cleanString(id1.value, 'Unknown');
        }
        break;
      }

      case 'practitioner': {
        patient.practitioner = getHumanNameDisplay(first(resource.name), 'Unknown');
        break;
      }

      case 'organization': {
        patient.organization = cleanString(resource.name, 'Unknown');
        break;
      }

      case 'medicationstatement': {
        let dosage = 'Unknown';
        const d0 = first(resource.dosage);

        if (cleanString(d0?.text)) {
          dosage = d0.text.trim();
        } else if (d0?.doseAndRate?.[0]?.doseQuantity) {
          const q = d0.doseAndRate[0].doseQuantity;
          const v = q?.value;
          const u = cleanString(q?.unit) || cleanString(q?.code) || '';
          dosage = `${v ?? ''} ${u}`.trim() || 'Unknown';

          const freq = d0?.timing?.repeat?.frequency;
          const unit = cleanString(d0?.timing?.repeat?.periodUnit);
          if (freq !== undefined && unit) {
            dosage += ` ${freq}${unit}`;
          }
        }

        let name = cleanString(resource?.medicationReference?.display, 'Unknown');
        let medsystem = null;
        let medcode = null;

        const medRefRaw = cleanString(resource?.medicationReference?.reference);
        const medRefId = normalizeReferenceId(medRefRaw);

        if (medRefRaw?.startsWith('#')) {
          const containedMed = findContained(resource, medRefId);
          if (containedMed?.resourceType?.toLowerCase() === 'medication') {
            name = getCodeableConceptDisplay(containedMed.code, name);
            medsystem = getCodeableConceptSystem(containedMed.code, null);
            medcode = getCodeableConceptCode(containedMed.code, null);
          }
        }

        const dt =
          resource?.effectiveDateTime ||
          resource?.effectivePeriod?.start ||
          resource?.dateAsserted ||
          null;

        medication.push({
          name,
          date: dt ? safeToISOString(dt) : ZERO_ISO_DATETIME,
          dosage,
          system: medsystem,
          code: medcode,
          status: cleanString(resource.status, 'active'),
          medRef: medRefRaw && !medRefRaw.startsWith('#') ? medRefId : undefined
        });
        break;
      }

      case 'medicationrequest': {
        let dosage = 'Unknown';
        const di0 = first(resource.dosageInstruction);

        if (cleanString(di0?.text)) {
          dosage = di0.text.trim();
        } else if (cleanString(di0?.timing?.code?.text)) {
          dosage = di0.timing.code.text.trim();
        }

        let name = 'Unknown';
        let medsystem = null;
        let medcode = null;
        let medReferenceId = undefined;

        if (resource.medicationReference) {
          name = cleanString(resource.medicationReference.display, 'Unknown');
          medReferenceId = cleanString(resource.medicationReference.reference);
        } else if (resource.medicationCodeableConcept) {
          name = getCodeableConceptDisplay(resource.medicationCodeableConcept, 'Unknown');
          medsystem = getCodeableConceptSystem(resource.medicationCodeableConcept, null);
          medcode = getCodeableConceptCode(resource.medicationCodeableConcept, null);
        } else {
          const containedMed = asArray(resource.contained).find(
            r => r?.resourceType?.toLowerCase() === 'medication'
          );
          if (containedMed) {
            name = getCodeableConceptDisplay(containedMed.code, 'Unknown');
            medsystem = getCodeableConceptSystem(containedMed.code, null);
            medcode = getCodeableConceptCode(containedMed.code, null);
          }
        }

        medication.push({
          name,
          date: safeToISOString(resource.authoredOn),
          dosage,
          system: medsystem,
          code: medcode,
          status: cleanString(resource.status, 'active'),
          medRef: normalizeReferenceId(medReferenceId)
        });
        break;
      }

      case 'medication': {
        if (!cleanString(resource.id)) break;

        medicationResourceMap[resource.id] = {
          name: getCodeableConceptDisplay(resource.code, null),
          system: getCodeableConceptSystem(resource.code, null),
          code: getCodeableConceptCode(resource.code, null)
        };
        break;
      }

      case 'medicationadministration': {
        const medDate = resource?.effectivePeriod?.start
          ? safeToISOString(resource.effectivePeriod.start)
          : resource?.effectiveDateTime
            ? safeToISOString(resource.effectiveDateTime)
            : ZERO_ISO_DATETIME;

        let name = null;
        let medcode = null;
        let medsystem = null;

        if (resource.medicationCodeableConcept) {
          name = getCodeableConceptDisplay(resource.medicationCodeableConcept, null);
          medcode = getCodeableConceptCode(resource.medicationCodeableConcept, null);
          medsystem = getCodeableConceptSystem(resource.medicationCodeableConcept, null);
        } else if (resource.medicationReference) {
          name = cleanString(resource.medicationReference.display, 'Unknown');
        }

        let dosage = 'Unknown';
        if (resource.dosage) {
          if (cleanString(resource.dosage.text)) {
            dosage = resource.dosage.text.trim();
          } else if (resource.dosage.dose) {
            const value = resource.dosage.dose.value;
            const unit = cleanString(resource.dosage.dose.unit, '');
            dosage = `${value ?? ''} ${unit}`.trim() || 'Unknown';
          }
        }

        medication.push({
          name: name || 'Unknown',
          date: medDate,
          dosage,
          system: medsystem,
          code: medcode,
          status: cleanString(resource.status, 'active')
        });
        break;
      }

      case 'allergyintolerance': {
        console.log('Processing Allergy resource');

        let alName = null;
        let alCode = null;
        let alSystem = null;

        if (resource.code) {
          alName = getCodeableConceptDisplay(resource.code, null);
          alCode = getCodeableConceptCode(resource.code, null);
          alSystem = getCodeableConceptSystem(resource.code, null);
        } else {
          const reaction0 = first(resource.reaction);
          const substance = reaction0?.substance;
          if (substance) {
            alName = getCodeableConceptDisplay(substance, null);
            alCode = getCodeableConceptCode(substance, null);
            alSystem = getCodeableConceptSystem(substance, null);
          }
        }

        // For date, prefer onsetDateTime, but fallback to recordedDate if onsetDateTime is not available
        const allergyDate = getBestDateTime(resource, ['onsetDateTime', 'recordedDate']);

        allergies.push({
          name: alName,
          criticality: cleanString(resource.criticality, 'high'),
          date: allergyDate,
          system: alSystem,
          code: alCode
        });
        break;
      }

      case 'condition': {
        const condDisplay = getCodeableConceptDisplay(resource.code, null);
        const condCode = getCodeableConceptCode(resource.code, null);
        const condSystem = getCodeableConceptSystem(resource.code, null);
        
        // For date, prefer onsetDateTime, but fallback to recordedDate if onsetDateTime is not available
        const conditionDate = getBestDateTime(resource, ['onsetDateTime', 'recordedDate']);

        conditions.push({
          name: condDisplay,
          date: conditionDate,
          system: condSystem,
          code: condCode
        });
        break;
      }

      case 'observation': {
        const observation = {
          name: getCodeableConceptDisplay(resource.code, null),
          code: getCodeableConceptCode(resource.code, null),
          system: getCodeableConceptSystem(resource.code, null),
          status: cleanString(resource.status, 'Unknown'),
          date: getBestDateTime(resource, ['effectiveDateTime', 'issued'])
        };

        if (Array.isArray(resource.component) && resource.component.length >= 2) {
          const firstComp = resource.component[0];
          const secondComp = resource.component[1];
          const val1 = firstComp?.valueQuantity?.value;
          const val2 = secondComp?.valueQuantity?.value;
          const unit = cleanString(firstComp?.valueQuantity?.unit, '');

          if (!Number.isNaN(Number(val1)) && !Number.isNaN(Number(val2))) {
            observation.value = `${val1}-${val2} ${unit}`.trim();
          }
        } else if (resource.valueQuantity) {
          const val = resource.valueQuantity.value;
          const unit = cleanString(resource.valueQuantity.unit, '');
          observation.value = `${val ?? ''} ${unit}`.trim();
        } else if (resource.bodySite?.coding?.length > 0) {
          observation.bodySite = cleanString(resource.bodySite.coding[0]?.display);
          observation.value = observation.value || observation.bodySite;
        } else if (cleanString(resource.valueString)) {
          observation.value = resource.valueString.trim();
        }

        observations.push(observation);
        break;
      }

      case 'immunization': {
        immunizations.push({
          name: getCodeableConceptDisplay(resource.vaccineCode, 'Unknown'),
          date: safeToISOString(resource.occurrenceDateTime),
          system: getCodeableConceptSystem(resource.vaccineCode, null),
          code: getCodeableConceptCode(resource.vaccineCode, null),
          status: cleanString(resource.status, 'Unknown')
        });
        break;
      }

      case 'procedure': {
        procedures.push({
          name: getCodeableConceptDisplay(resource.code, null),
          date: getBestDateTime(resource, [
            'performedDateTime',
            'occurrenceDateTime',
            'recordedDate'
          ]),
          system: getCodeableConceptSystem(resource.code, null),
          code: getCodeableConceptCode(resource.code, null),
          status: cleanString(resource.status, 'Unknown')
        });
        break;
      }

      default:
        break;
    }
  }

  medication = medication.map((med) => {
    if (med.medRef && medicationResourceMap[med.medRef]) {
      med.system = med.system || medicationResourceMap[med.medRef].system;
      med.code = med.code || medicationResourceMap[med.medRef].code;
      med.name = med.name === 'Unknown'
        ? (medicationResourceMap[med.medRef].name || med.name)
        : med.name;
    }
    delete med.medRef;
    return med;
  });

  console.log('Conversion complete. Final structured data:');

  return {
    packageUUID,
    timeStamp,
    patient,
    medication,
    allergies,
    conditions,
    observations,
    immunizations,
    procedures
  };
}

module.exports = { convertIPSBundleToSchema };