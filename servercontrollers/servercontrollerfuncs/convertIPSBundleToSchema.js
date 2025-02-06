function convertIPSBundleToSchema(ipsBundle) {
    const { id: packageUUID, timestamp: timeStamp, entry } = ipsBundle;
  
    // Initialize variables to store patient and practitioner information
    let patient = {};
    patient.practitioner = "Unknown";
    let dosage = "";
    let name = "";
    let medcode = null;
    let medsystem = null;
  
    // Initialize arrays to store medication, allergy, condition, observation, and immunization information
    let medication = [];
    let allergies = [];
    let conditions = [];
    let observations = [];
    let immunizations = [];
  
    // Create a map for Medication resources (keyed by resource.id)
    let medicationResourceMap = {};
  
    // Iterate over each entry in the IPS Bundle
    for (const entryItem of entry) {
      const { resourceType, resource } = entryItem;
  
      // Extract information based on resource type
      switch (resource.resourceType) {
        case "Patient":
          patient.name = resource.name[0].family;
          patient.given = resource.name[0].given[0];
          patient.dob = new Date(resource.birthDate).toISOString().split('T')[0];
          patient.gender = resource.gender !== undefined ? resource.gender : "Unknown";
          patient.nation = resource.address[0].country;
          break;
  
        case "Practitioner":
          if (resource.name[0].text !== undefined) {
            patient.practitioner = resource.name[0].text;
          } else if (resource.name[0].family !== undefined) {
            patient.practitioner = resource.name[0].family + ", " + resource.name[0].given[0];
          } else {
            patient.practitioner = "Unknown";
          }
          break;
  
        case "Organization":
          patient.organization = resource.name !== undefined ? resource.name : "Unknown";
          break;
  
        case "MedicationStatement":
          // Try to extract dosage information
          if (resource.dosage[0].text !== undefined) {
            dosage = resource.dosage[0].text;
          } else {
            dosage = resource.dosage[0].doseAndRate[0].doseQuantity.value + " " +
              resource.dosage[0].doseAndRate[0].doseQuantity.unit;
            if (resource.dosage[0].timing !== undefined) {
              dosage += " " + resource.dosage[0].timing.repeat.frequency + resource.dosage[0].timing.repeat.periodUnit;
            }
          }
          // Create a medication entry.
          // If medicationReference is present and has a reference id, capture it for later matching.
          let medRef = undefined;
          if (resource.medicationReference && resource.medicationReference.reference) {
            medRef = resource.medicationReference.reference;
          }
          medication.push({
            name: resource.medicationReference.display, // display name
            date: new Date(resource.effectivePeriod.start).toISOString(),
            dosage: dosage,
            system: null, // to be added from Medication resource if available
            code: null,   // to be added from Medication resource if available
            status: "Unknown",
            medRef: medRef  // temporary field to aid matching
          });
          break;
  
        case "MedicationRequest":
          // Process dosage
          if (resource.dosageInstruction[0].text !== undefined) {
            dosage = resource.dosageInstruction[0].text;
          } else if (resource.dosageInstruction[0].timing !== undefined) {
            dosage = resource.dosageInstruction[0].timing.code.text;
          } else {
            dosage = "Unknown";
          }
          // Initialize variables for medication name and reference
          medsystem = null;
          medcode = null;
          let medReferenceId = undefined;
          if (resource.medicationReference !== undefined) {
            // medicationReference contains a reference id and a display value.
            name = resource.medicationReference.display;
            if (resource.medicationReference.reference) {
              medReferenceId = resource.medicationReference.reference;
            }
          } else if (resource.medicationCodeableConcept !== undefined) {
            name = resource.medicationCodeableConcept.text;
            medsystem = (resource.medicationCodeableConcept.coding[0].system !== undefined)
              ? resource.medicationCodeableConcept.coding[0].system
              : null;
            medcode = (resource.medicationCodeableConcept.coding[0].code !== undefined)
              ? resource.medicationCodeableConcept.coding[0].code
              : null;
          } else if (resource.contained !== undefined) {
            name = resource.contained[0].code.text;
          } else {
            name = "Unknown";
          }
  
          medication.push({
            name: name,
            date: new Date(resource.authoredOn).toISOString(),
            dosage: dosage,
            system: medsystem,  // if available from medicationCodeableConcept
            code: medcode,      // if available from medicationCodeableConcept
            status: resource.status ? resource.status : "Unknown",
            medRef: medReferenceId  // temporary field for matching later
          });
          break;
  
        case "Medication":
          // Store the Medication resource data in the map so that it can later be applied to any
          // medication entries referencing it.
          if (resource.code && resource.code.coding && resource.code.coding[0]) {
            medicationResourceMap[resource.id] = {
              name: resource.code.coding[0].display,
              system: resource.code.coding[0].system,
              code: resource.code.coding[0].code
            };
          }
          break;
  
        case "AllergyIntolerance":
          allergies.push({
            name: resource.code.coding[0].display,
            criticality: resource.criticality,
            date: new Date(resource.onsetDateTime).toISOString(),
            system: resource.code.coding[0].system !== undefined ? resource.code.coding[0].system : null,
            code: resource.code.coding[0].code !== undefined ? resource.code.coding[0].code : null
          });
          break;
  
        case "Condition":
          conditions.push({
            name: resource.code.coding[0].display,
            // If not onsetDateTime, use the current date
            date: resource.onsetDateTime !== undefined
              ? new Date(resource.onsetDateTime).toISOString()
              : new Date().toISOString(),
            system: resource.code.coding[0].system !== undefined ? resource.code.coding[0].system : null,
            code: resource.code.coding[0].code !== undefined ? resource.code.coding[0].code : null
          });
          break;
  
        case "Observation":
          const observation = {
            name: resource.code.coding[0].display,
          };
          if (resource.effectiveDateTime !== undefined) {
            observation.date = new Date(resource.effectiveDateTime).toISOString();
          } else if (resource.issued !== undefined) {
            observation.date = new Date(resource.issued).toISOString();
          }
          if (resource.valueQuantity !== undefined) {
            observation.value = `${resource.valueQuantity.value} ${resource.valueQuantity.unit}`;
          } else if (resource.bodySite !== undefined) {
            observation.value = resource.bodySite.coding[0].display;
          } else if (resource.valueString !== undefined) {
            observation.value = resource.valueString;
          }
          observations.push(observation);
          break;
  
        case "Immunization":
          // Extract the first code and occurrenceDateTime
          const immunizationCode = resource.vaccineCode.coding[0].code;
          const immunizationSystem = resource.vaccineCode.coding[0].system;
          const immunizationDate = new Date(resource.occurrenceDateTime).toISOString();
  
          immunizations.push({
            name: immunizationCode,
            system: immunizationSystem,
            date: immunizationDate
          });
          break;
  
        default:
          break;
      }
    }
  
    // Post-process the medication array:
    // For any medication entry that has a medication reference (medRef) and there is a corresponding
    // Medication resource in our map, update the entry with system and code.
    medication = medication.map((med) => {
      if (med.medRef && medicationResourceMap[med.medRef]) {
        // Update with the data from the Medication resource
        med.system = medicationResourceMap[med.medRef].system;
        med.code = medicationResourceMap[med.medRef].code;
        // Optionally, you could also override the name if needed:
        // med.name = medicationResourceMap[med.medRef].name;
      }
      // Remove the temporary medRef field before returning the final object.
      delete med.medRef;
      return med;
    });
  
    return { packageUUID, timeStamp, patient, medication, allergies, conditions, observations, immunizations };
  }
  
  module.exports = { convertIPSBundleToSchema };
  