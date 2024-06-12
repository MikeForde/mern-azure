function convertIPSBundleToSchema(ipsBundle) {
    const { id: packageUUID, timestamp: timeStamp, entry } = ipsBundle;

    // Initialize variables to store patient and practitioner information
    let patient = {};
    patient.practitioner = "Unknown";
    let dosage = "";

    // Initialize arrays to store medication, allergy, condition, and observation information
    let medication = [];
    let allergies = [];
    let conditions = [];
    let observations = [];

    // Iterate over each entry in the IPS Bundle
    for (const entryItem of entry) {
        const { resourceType, resource } = entryItem;

        // Extract information based on resource type
        switch (resource.resourceType) {
            case "Patient":
                patient.name = resource.name[0].family;
                patient.given = resource.name[0].given[0];
                patient.dob = new Date(resource.birthDate).toISOString().split('T')[0];
                patient.gender = (resource.gender !== undefined) ? resource.gender : "Unknown";
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
                if(resource.name !== undefined) {
                    patient.organization = resource.name;
                } else {
                    patient.organization = "Unknown";
                }
                break;
            case "MedicationStatement":
                if (resource.dosage[0].text !== undefined) {
                    dosage = resource.dosage[0].text;
                } else {
                    dosage = resource.dosage[0].doseAndRate[0].doseQuantity.value + " " + resource.dosage[0].doseAndRate[0].doseQuantity.unit;
                    if (resource.dosage[0].timing !== undefined) {
                        dosage += " " + resource.dosage[0].timing.repeat.frequency + resource.dosage[0].timing.repeat.periodUnit;
                    }
                }
                medication.push({
                    name: resource.medicationReference.display,
                    date: new Date(resource.effectivePeriod.start).toISOString(),
                    dosage: dosage
                });
                break;
            case "MedicationRequest":
                if (resource.dosageInstruction[0].text !== undefined) {
                    dosage = resource.dosageInstruction[0].text;
                } else {
                    dosage = "Unknown";
                }
                medication.push({
                    name: resource.medicationReference.display,
                    date: new Date(resource.authoredOn).toISOString(),
                    dosage: dosage
                });
                break;
            case "AllergyIntolerance":
                allergies.push({
                    name: resource.code.coding[0].display,
                    criticality: resource.criticality,
                    date: new Date(resource.onsetDateTime).toISOString()
                });
                break;
            case "Condition":
                conditions.push({
                    name: resource.code.coding[0].display,
                    // If not onsetDateTime, use the current date
                    date: (resource.onsetDateTime !== undefined) ? new Date(resource.onsetDateTime).toISOString() : new Date().toISOString()
                });
                break;
            case "Observation":
                const observation = {
                    name: resource.code.coding[0].display,
                    date: new Date(resource.effectiveDateTime).toISOString()
                };
                if (resource.valueQuantity !== undefined) {
                    observation.value = `${resource.valueQuantity.value} ${resource.valueQuantity.unit}`;
                } else if (resource.bodySite !== undefined) {
                    observation.value = resource.bodySite.coding[0].display;
                }
                observations.push(observation);
                break;
            default:
                break;
        }
    }

    return { packageUUID, timeStamp, patient, medication, allergies, conditions, observations };
}

module.exports = { convertIPSBundleToSchema };
