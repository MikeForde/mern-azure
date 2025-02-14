const { v4: uuidv4 } = require('uuid');

function generateXMLBundle(ipsRecord) {
    // Generate UUIDs for Composition, Patient, Practitioner, Organization
    const compositionUUID = uuidv4();
    const patientUUID = uuidv4();
    const practitionerUUID = uuidv4();
    const organizationUUID = uuidv4();

    // Generate UUIDs for MedicationStatement, Medication, AllergyIntolerance, Condition, Observation
    const medicationStatementUUIDs = ipsRecord.medication.map(() => uuidv4());
    const medicationUUIDs = ipsRecord.medication.map(() => uuidv4());
    const allergyIntoleranceUUIDs = ipsRecord.allergies.map(() => uuidv4());
    const conditionUUIDs = ipsRecord.conditions.map(() => uuidv4());
    const observationUUIDs = ipsRecord.observations.map(() => uuidv4());
    const immunizationUUIDs = ipsRecord.immunizations.map(() => uuidv4());

    // Get current date/time
    const currentDateTime = new Date().toISOString();

    // Initialize XML string
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Bundle xmlns="http://hl7.org/fhir">
    <id value="${ipsRecord.packageUUID}"/>
    <type value="document"/>
    <timestamp value="${ipsRecord.timeStamp}"/>`;

    // Compose Composition resource XML
    xml += `
    <entry>
        <fullUrl value="urn:uuid:${compositionUUID}"/>
        <resource>
            <Composition>
                <id value="${compositionUUID}"/>
                <type>
                    <coding>
                        <system value="http://loinc.org"/>
                        <code value="60591-5"/>
                        <display value="Patient summary Document"/>
                    </coding>
                </type>
                <subject>
                    <reference value="Patient/${patientUUID}"/>
                </subject>
                <date value="${currentDateTime}"/>
                <author>
                    <reference value="Practitioner/${practitionerUUID}"/>
                </author>
                <title value="Patient Summary as of ${currentDateTime}"/>
                <custodian>
                    <reference value="Organization/${organizationUUID}"/>
                </custodian>
                <section>
                    <title value="Medication"/>
                    <code>
                        <coding>
                            <system value="http://loinc.org"/>
                            <code value="10160-0"/>
                            <display value="History of Medication use Narrative"/>
                        </coding>
                    </code>`;

    // Add MedicationStatement entries to Composition section
    medicationStatementUUIDs.forEach((medStatementUUID) => {
        xml += `
                    <entry>
                        <reference value="MedicationStatement/${medStatementUUID}" />
                    </entry>`;
    });

    // Close Medication section and start Allergies section
    xml += `
                </section>
                <section>
                    <title value="Allergies and Intolerances"/>
                    <code>
                        <coding>
                            <system value="http://loinc.org"/>
                            <code value="48765-2"/>
                            <display value="Allergies and adverse reactions Document"/>
                        </coding>
                    </code>`;

    // Add AllergyIntolerance entries to Composition section
    allergyIntoleranceUUIDs.forEach((allergyIntoleranceUUID) => {
        xml += `
                    <entry>
                        <reference value="AllergyIntolerance/${allergyIntoleranceUUID}"/>
                    </entry>`;
    });

    // Close Allergies section and start Conditions section
    xml += `
                </section>
                <section>
                    <title value="Conditions"/>
                    <code>
                        <coding>
                            <system value="http://loinc.org"/>
                            <code value="11348-0"/>
                            <display value="Problem List"/>
                        </coding>
                    </code>`;

    // Add Condition entries to Composition section
    conditionUUIDs.forEach((conditionUUID) => {
        xml += `
                    <entry>
                        <reference value="Condition/${conditionUUID}"/>
                    </entry>`;
    });

    // Close Conditions section and start Observations section
    xml += `
                </section>
                <section>
                    <title value="Observations"/>
                    <code>
                        <coding>
                            <system value="http://loinc.org"/>
                            <code value="57016-8"/>
                            <display value="Vital signs Document"/>
                        </coding>
                    </code>`;

    // Add Observation entries to Composition section
    observationUUIDs.forEach((observationUUID) => {
        xml += `
                    <entry>
                        <reference value="Observation/${observationUUID}"/>
                    </entry>`;
    });

    // Close Observations section and start Immunizations section
    xml += `
                </section>
                <section>
                    <title value="Immunizations"/>
                    <code>
                        <coding>
                            <system value="http://loinc.org"/>
                            <code value="11369-6"/>
                            <display value="Immunization Activity"/>
                        </coding>
                    </code>`;

    // Add Immunization entries to Composition section
    immunizationUUIDs.forEach((immunizationUUID) => {
    xml += `
                    <entry>
                        <reference value="Immunization/${immunizationUUID}"/>
                    </entry>`;
    });

    // Close Composition resource
    xml += `
                </section>
            </Composition>
        </resource>
    </entry>`;

    // Add Patient, Practitioner, and Organization entries
    xml += `
    <entry>
        <fullUrl value="urn:uuid:${patientUUID}"/>
        <resource>
            <Patient>
                <id value="${patientUUID}"/>
                <name>
                    <family value="${ipsRecord.patient.name}"/>
                    <given value="${ipsRecord.patient.given}"/>
                </name>
                <gender value="${ipsRecord.patient.gender}"/>
                <birthDate value="${ipsRecord.patient.dob.toISOString().split('T')[0]}"/>
                <address>
                    <country value="${ipsRecord.patient.nation}"/>
                </address>
            </Patient>
        </resource>
    </entry>
    <entry>
        <fullUrl value="urn:uuid:${practitionerUUID}"/>
        <resource>
            <Practitioner>
                <id value="${practitionerUUID}"/>
                <name>
                    <text value="${ipsRecord.patient.practitioner}"/>
                </name>
            </Practitioner>
        </resource>
    </entry>
    <entry>
        <fullUrl value="urn:uuid:${organizationUUID}"/>
        <resource>
            <Organization>
                <id value="${organizationUUID}"/>
                <name value="${ipsRecord.patient.organization}"/>
            </Organization>
        </resource>
    </entry>`;

    // Add MedicationStatement entries
    ipsRecord.medication.forEach((med, index) => {
        const medicationStatementUUID = medicationStatementUUIDs[index];
        xml += `
    <entry>
        <fullUrl value="urn:uuid:${medicationStatementUUID}"/>
        <resource>
            <MedicationStatement>
                <id value="${medicationStatementUUID}"/>
                <status value="active"/>
                <medicationReference>
                    <reference value="Medication/${medicationUUIDs[index]}"/>
                    <display value="${med.name}"/>
                </medicationReference>
                <effectivePeriod>
                    <start value="${med.date.toISOString()}"/>
                </effectivePeriod>
                <subject>
                    <reference value="Patient/${patientUUID}"/>
                </subject>
                <dosage>
                    <text value="${med.dosage}"/>
                </dosage>
            </MedicationStatement>
        </resource>
    </entry>`;
    });

    // Add Medication entries
    ipsRecord.medication.forEach((med, index) => {
        xml += `
    <entry>
        <fullUrl value="urn:uuid:${medicationUUIDs[index]}"/>
        <resource>
            <Medication>
                <id value="${medicationUUIDs[index]}"/>
                <code>
                    <coding>
                        <display value="${med.name}"/>
                        <system value="${med.system}"/>
                        <code value="${med.code}"/>
                    </coding>
                </code>
            </Medication>
        </resource>
    </entry>`;
    });

    // Add AllergyIntolerance entries
    ipsRecord.allergies.forEach((allergy, index) => {
        xml += `
    <entry>
        <fullUrl value="urn:uuid:${allergyIntoleranceUUIDs[index]}"/>
        <resource>
            <AllergyIntolerance>
                <id value="${allergyIntoleranceUUIDs[index]}"/>
                <type value="allergy"/>
                <category value="medication"/>
                <criticality value="${allergy.criticality}"/>
                <code>
                    <coding>
                        <display value="${allergy.name}"/>
                        <system value="${allergy.system}"/>
                        <code value="${allergy.code}"/>
                    </coding>
                </code>
                <patient>
                    <reference value="Patient/${patientUUID}"/>
                </patient>
                <onsetDateTime value="${allergy.date.toISOString()}"/>
            </AllergyIntolerance>
        </resource>
    </entry>`;
    });

    // Add Condition entries
    ipsRecord.conditions.forEach((condition, index) => {
        xml += `
    <entry>
        <fullUrl value="urn:uuid:${conditionUUIDs[index]}"/>
        <resource>
            <Condition>
                <id value="${conditionUUIDs[index]}"/>
                <code>
                    <coding>
                        <display value="${condition.name}"/>
                        <system value="${condition.system}"/>
                        <code value="${condition.code}"/>
                    </coding>
                </code>
                <subject>
                    <reference value="Patient/${patientUUID}"/>
                </subject>
                <onsetDateTime value="${condition.date.toISOString()}"/>
            </Condition>
        </resource>
    </entry>`;
    });

// Add Observation entries
ipsRecord.observations.forEach((observation, index) => {
    xml += `
    <entry>
        <fullUrl value="urn:uuid:${observationUUIDs[index]}"/>
        <resource>
            <Observation>
                <id value="${observationUUIDs[index]}"/>
                <code>
                    <coding>
                        <display value="${observation.name}"/>
                        <system value="${observation.system}"/>
                        <code value="${observation.code}"/>
                    </coding>
                </code>
                <subject>
                    <reference value="Patient/${patientUUID}"/>
                </subject>
                <effectiveDateTime value="${observation.date.toISOString()}"/>`;

    // Check if observation value is present and determine its type
    if (observation.value) {
        const value = observation.value.trim();

        // Regex to separate numeric part and unit
        const match = value.match(/^(\d+)(\D*)$/);

        if (match) {
            const numericValue = match[1];
            const unit = match[2];
            xml += `
                <valueQuantity>
                    <value value="${numericValue}"/>
                    <unit value="${unit}"/>
                    <system value="http://unitsofmeasure.org"/>
                    <code value="${unit}"/>
                </valueQuantity>`;
        } else {
            // If no match, treat it as bodySite
            xml += `
                <bodySite>
                    <coding>
                        <display value="${value}"/>
                    </coding>
                </bodySite>`;
        }
    }

        // Close Observation resource
        xml += `
            </Observation>
        </resource>
    </entry>`;
    });

    // Add Immunization entries
    ipsRecord.immunizations.forEach((immunization, index) => {
        xml += `
    <entry>
        <fullUrl value="urn:uuid:${immunizationUUIDs[index]}"/>
        <resource>
            <Immunization>
                <id value="${immunizationUUIDs[index]}"/>
                <status value="completed"/>
                <vaccineCode>
                    <coding>
                        <system value="${immunization.system}"/>
                        <code value="${immunization.name}"/>
                    </coding>
                </vaccineCode>
                <patient>
                    <reference value="Patient/${patientUUID}"/>
                </patient>
                <occurrenceDateTime value="${new Date(immunization.date).toISOString()}"/>
            </Immunization>
        </resource>
    </entry>`;
    });

    // Close Bundle
    xml += `
</Bundle>`;

    return xml;
}

module.exports = { generateXMLBundle };
