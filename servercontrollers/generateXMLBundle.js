const { v4: uuidv4 } = require('uuid');

function generateXMLBundle(ipsRecord) {
    // Generate UUIDs for Composition, Patient, Practitioner, Organization
    const compositionUUID = uuidv4();
    const patientUUID = uuidv4();
    const practitionerUUID = uuidv4();
    const organizationUUID = uuidv4();

    // Generate UUIDs for MedicationStatement, Medication, AllergyIntolerance
    const medicationStatementUUIDs = ipsRecord.medication.map(() => uuidv4());
    const medicationUUIDs = ipsRecord.medication.map(() => uuidv4());
    const allergyIntoleranceUUIDs = ipsRecord.allergies.map(() => uuidv4());

    // Get current date/time
    const currentDateTime = new Date().toISOString();

    // Initialize XML string
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Bundle xmlns="http://hl7.org/fhir">
    <id value="${ipsRecord.packageUUID}"/>
    <type value="document"/>
    <timestamp value="${currentDateTime}"/>`;

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

    // Close Composition resource
    xml += `
                </section>
            </Composition>
        </resource>
    </entry>`;

    // Add Patient, Practitioner, and Organization entries
    xml += `
    <entry>
        <resource>
            <Patient>
                <id value="${patientUUID}"/>
                <name>
                    <family value="${ipsRecord.patient.name}"/>
                    <given value="${ipsRecord.patient.given}"/>
                </name>
                <gender value="unknown"/>
                <birthDate value="${ipsRecord.patient.dob.toISOString()}"/>
                <address>
                    <country value="${ipsRecord.patient.nationality}"/>
                </address>
            </Patient>
        </resource>
    </entry>
    <entry>
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
        <resource>
            <Organization>
                <id value="${organizationUUID}"/>
                <name value="UK DMS"/>
            </Organization>
        </resource>
    </entry>`;

    // Add MedicationStatement entries
    ipsRecord.medication.forEach((med, index) => {
        const medicationStatementUUID = medicationStatementUUIDs[index];
        xml += `
    <entry>
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
        <resource>
            <Medication>
                <id value="${medicationUUIDs[index]}"/>
                <code>
                    <coding>
                        <display value="${med.name}"/>
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
        <resource>
            <AllergyIntolerance>
                <id value="${allergyIntoleranceUUIDs[index]}"/>
                <type value="allergy"/>
                <category value="medication"/>
                <criticality value="${allergy.severity}"/>
                <code>
                    <coding>
                        <display value="${allergy.name}"/>
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

    // Close Bundle
    xml += `
</Bundle>`;

    return xml;
}

module.exports = { generateXMLBundle };