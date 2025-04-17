// uuid4 is a library to generate UUIDs
const { v4: uuidv4 } = require('uuid');

function convertIPSBundleToSchema(ipsBundle) {
  var { id: packageUUID, timestamp: timeStamp, entry } = ipsBundle;

  // if no id is provided then generate UUID
  if (!packageUUID) {
    packageUUID = uuidv4();
    console.log("No packageUUID provided. Generated UUID: " + packageUUID);
  }

  // if timestamp is not provided, use the current date
  if (!timeStamp) {
    timeStamp = new Date().toISOString();
    console.log("No timestamp provided. Using current date.");
  }

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

    // Extract information based on resource type - change to lowercase
    switch ((resource.resourceType).toLowerCase()) {
      case "patient":
        patient.name = resource.name[0].family;
        patient.given = resource.name[0].given ? resource.name[0].given[0] : "Unknown";
        // check if patient given is just empty string
        if (patient.given === "") {
          patient.given = "Unknown";
        }
        patient.dob = new Date(resource.birthDate).toISOString().split('T')[0];
        patient.gender = resource.gender !== undefined ? resource.gender : "Unknown";
        // If no address is provided, set nation to Unknown
        patient.nation = resource.address !== undefined ? resource.address[0].country : "Unknown";
        console.log("Patient = " + JSON.stringify(patient));
        break;

      case "practitioner":
        if (resource.name) {
          if (resource.name[0].text) {
            patient.practitioner = resource.name[0].text;
          } else if (resource.name[0].family) {
            patient.practitioner = resource.name[0].family + ", " + resource.name[0].given[0];
          } else {
            patient.practitioner = "Unknown";
          }
        } else {
          patient.practitioner = "Unknown";
        }
        break;

      case "organization":
        patient.organization = resource.name  ? resource.name : "Unknown";
        break;

      case "medicationstatement":
        // Try to extract dosage information
        if (resource.dosage[0].text) {
          dosage = resource.dosage[0].text;
        } else {
          dosage = resource.dosage[0].doseAndRate[0].doseQuantity.value + " " +
            resource.dosage[0].doseAndRate[0].doseQuantity.unit;
          if (resource.dosage[0].timing) {
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
          status: "active",
          medRef: medRef  // temporary field to aid matching
        });
        break;

      case "medicationrequest":
        // Process dosage
        if (resource.dosageInstruction[0].text) {
          dosage = resource.dosageInstruction[0].text;
        } else if (resource.dosageInstruction[0].timing) {
          dosage = resource.dosageInstruction[0].timing.code.text;
        } else {
          dosage = "Unknown";
        }
        // Initialize variables for medication name and reference
        medsystem = null;
        medcode = null;
        let medReferenceId = undefined;
        if (resource.medicationReference) {
          // medicationReference contains a reference id and a display value.
          name = resource.medicationReference.display;
          if (resource.medicationReference.reference) {
            medReferenceId = resource.medicationReference.reference;
          }
        } else if (resource.medicationCodeableConcept) {
          name = resource.medicationCodeableConcept.text;
          medsystem = (resource.medicationCodeableConcept.coding[0].system)
            ? resource.medicationCodeableConcept.coding[0].system
            : null;
          medcode = (resource.medicationCodeableConcept.coding[0].code)
            ? resource.medicationCodeableConcept.coding[0].code
            : null;
        } else if (resource.contained) {
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
          status: "active",
          medRef: medReferenceId  // temporary field for matching later
        });
        break;

      case "medication":
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

      case "medicationadministration":
        let medDate = resource.effectivePeriod ? new Date(resource.effectivePeriod.start).toISOString() : new Date().toISOString();
        if (resource.medicationCodeableConcept) {
          name = resource.medicationCodeableConcept.coding[0].display ? resource.medicationCodeableConcept.coding[0].display : null;
          medcode = resource.medicationCodeableConcept.coding[0].code ? resource.medicationCodeableConcept.coding[0].code : null;
          medsystem = resource.medicationCodeableConcept.coding[0].system ? resource.medicationCodeableConcept.coding[0].system : null;
          if (name === null) {
            name = resource.medicationCodeableConcept.text ? resource.medicationCodeableConcept.text : null;
          }
        }

        if (resource.dosage) {
          dosage = resource.dosage.text ? resource.dosage.text : "";
          if (dosage === "" && resource.dosage.dose) {
            dosage = resource.dosage.dose.value + " " + resource.dosage.dose.unit;
          }
        }

        if (dosage === "") {
          dosage = "Unknown";
        }

        medication.push({
          name: name,
          date: medDate,
          dosage: dosage,
          system: medsystem,
          code: medcode,
          status: "active"
        });
        break;


      case "allergyintolerance":
        let alName = null;
        let alCode = null;
        let alSystem = null;
        if (resource.code) {
          alName = resource.code.coding[0].display ? resource.code.coding[0].display : null;
          alCode = resource.code.coding[0].code ? resource.code.coding[0].code : null;
          alSystem = resource.code.coding[0].system ? resource.code.coding[0].system : null;
          if (alName === null) {
            alName = resource.code.text ? resource.code.text : null;
          }
        } else if (resource.reaction.substance) {
          alName = resource.reaction.substance.coding[0].display ? resource.reaction.substance.coding[0].display : null;
          alCode = resource.reaction.substance.coding[0].code ? resource.reaction.substance.coding[0].code : null;
          alSystem = resource.reaction.substance.coding[0].system ? resource.reaction.substance.coding[0].system : null;
          if (alName === null) {
            alName = resource.reaction.substance.text ? resource.reaction.substance.text : null;
          }
        }

        allergies.push({
          name: alName,
          criticality: resource.criticality,
          date: new Date(resource.onsetDateTime).toISOString(),
          system: alSystem,
          code: alCode
        });
        console.log("Allergies = " + JSON.stringify(allergies));
        break;

      case "condition":
        let condCode = null;
        let condSystem = null;
        let condDisplay = null;
        if (resource.code) {
          condCode = resource.code.coding[0].code ? resource.code.coding[0].code : null;
          condSystem = resource.code.coding[0].system ? resource.code.coding[0].system : null;
          condDisplay = resource.code.coding[0].display ? resource.code.coding[0].display : null;
          if (condDisplay === null) {
            condDisplay = resource.code.text ? resource.code.text : null;
          }
        }

        conditions.push({
          name: condDisplay,
          date: resource.onsetDateTime !== undefined
            ? new Date(resource.onsetDateTime).toISOString()
            : new Date().toISOString(),
          system: condSystem,
          code: condCode
        });
        break;

      case "observation":
        case "observation":
          let obName = null;
          let obCode = null;
          let obSystem = null;
      
          if (resource.code?.coding?.length > 0) {
              const coding = resource.code.coding[0];
              obName = coding.display || resource.code.text || null;
              obCode = coding.code || null;
              obSystem = coding.system || null;
          }
      
          const observation = {
              name: obName,
              code: obCode,
              system: obSystem
          };
      
          // Use effectiveDateTime or issued for date
          if (resource.effectiveDateTime) {
              observation.date = new Date(resource.effectiveDateTime).toISOString();
          } else if (resource.issued) {
              observation.date = new Date(resource.issued).toISOString();
          }
      
          // Prefer component-based BP-style values
          if (resource.component?.length === 2) {
              const [firstComp, secondComp] = resource.component;
              const val1 = firstComp?.valueQuantity?.value;
              const val2 = secondComp?.valueQuantity?.value;
              const unit = firstComp?.valueQuantity?.unit || '';
      
              if (!isNaN(val1) && !isNaN(val2)) {
                  observation.value = `${val1}-${val2} ${unit}`;
              }
          }
          // Fallback to valueQuantity format
          else if (resource.valueQuantity) {
              const val = resource.valueQuantity.value;
              const unit = resource.valueQuantity.unit || '';
              observation.value = `${val} ${unit}`;
          }
          // Optional: capture bodySite or string values
          else if (resource.bodySite?.coding?.length > 0) {
              observation.bodySite = resource.bodySite.coding[0].display;
              // Fudge - but for now, we'll double-tap and use the bodySite as the value (unless it already contains a value)
              observation.value = observation.value ? observation.value : observation.bodySite;
          } else if (resource.valueString) {
              observation.value = resource.valueString;
          }
      
          observations.push(observation);
          break;
      

      case "immunization":
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