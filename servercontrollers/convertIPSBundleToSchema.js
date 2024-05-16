
function convertIPSBundleToSchema(ipsBundle) {
    const { id: packageUUID, entry } = ipsBundle;

    // Initialize variables to store patient and practitioner information
    let patient = {};
    let practitioner = {};

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
                patient.practitioner = resource.name[0].text;
                break;
            case "MedicationStatement":
                medication.push({
                    name: resource.medicationReference.display,
                    date: new Date(resource.effectivePeriod.start).toISOString().split('T')[0],
                    dosage: resource.dosage[0].text
                });
                break;
            case "AllergyIntolerance":
                allergies.push({
                    name: resource.code.coding[0].display,
                    severity: resource.criticality,
                    date: new Date(resource.onsetDateTime).toISOString().split('T')[0]
                });
                break;
            default:
                break;
        }
    }

    return { packageUUID, patient, practitioner, medication, allergies };
}

module.exports = { convertIPSBundleToSchema };