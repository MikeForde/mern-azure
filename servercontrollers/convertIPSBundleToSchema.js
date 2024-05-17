
function convertIPSBundleToSchema(ipsBundle) {
    const { id: packageUUID, entry } = ipsBundle;

    // Initialize variables to store patient and practitioner information
    let patient = {};
    let practitioner = {};
    let dosage = "";

    // Initialize arrays to store medication and allergy information
    let medication = [];
    let allergies = [];

    // Iterate over each entry in the IPS Bundle
    for (const entryItem of entry) {
        const { resourceType, resource } = entryItem;

        // Extract information based on resource type
        switch (resource.resourceType) {
            case "Patient":
                patient.name = resource.name[0].family;
                patient.given = resource.name[0].given[0];
                patient.dob = new Date(resource.birthDate).toISOString().split('T')[0];
                patient.nationality = resource.address[0].country;
                break;
            case "Practitioner":
                if(resource.name[0].text !== undefined){
                    patient.practitioner = resource.name[0].text;
                } else if (resource.name[0].family !== undefined) {
                    patient.practitioner = resource.name[0].family + ", " + resource.name[0].given[0];
                } else {
                    patient.practitioner = "unknown";
                }
                break;
            case "MedicationStatement":
                if(resource.dosage[0].text !== undefined){
                    dosage = resource.dosage[0].text;
                } else {
                    dosage = resource.dosage[0].doseAndRate[0].doseQuantity.value + " " + resource.dosage[0].doseAndRate[0].doseQuantity.unit;
                    if(resource.dosage[0].timing !== undefined){
                        dosage += " " + resource.dosage[0].timing.repeat.frequency + resource.dosage[0].timing.repeat.periodUnit;
                    console.log("not undefined");   
                    }
                }
                medication.push({
                    name: resource.medicationReference.display,
                    date: new Date(resource.effectivePeriod.start).toISOString(),
                    dosage: dosage    
                });
                break;
            case "AllergyIntolerance":
                allergies.push({
                    name: resource.code.coding[0].display,
                    severity: resource.criticality,
                    date: new Date(resource.onsetDateTime).toISOString()
                });
                break;
            default:
                break;
        }
    }

    return { packageUUID, patient, practitioner, medication, allergies };
}

module.exports = { convertIPSBundleToSchema };