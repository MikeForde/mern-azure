// fsh/profiles.fsh

//--------------------------------------------------------------------------------
// IPS Unified Bundle
//--------------------------------------------------------------------------------
Profile: IPSUnifiedBundle
Parent: Bundle
Id: IPSUnifiedBundle
Title: "IPS Unified Bundle"
Description: "A Bundle containing exactly one Patient, one Organization, and zero-or-more of the other IPS resources."
* type = #collection
* entry 2..*
* entry ^slicing.discriminator[0].type = #value
* entry ^slicing.discriminator[0].path = "resource.resourceType"
* entry ^slicing.rules = #closed
* entry contains PatientEntry 1..1
* entry[PatientEntry].resource only IPSUnifiedPatient
* entry contains OrgEntry 1..1
* entry[OrgEntry].resource only IPSUnifiedOrganization
* entry contains MedReqEntry 0..*
* entry[MedReqEntry].resource only IPSUnifiedMedicationRequest
* entry contains MedEntry 0..*
* entry[MedEntry].resource only IPSUnifiedMedication
* entry contains AllergyEntry 0..*
* entry[AllergyEntry].resource only IPSUnifiedAllergyIntolerance
* entry contains ConditionEntry 0..*
* entry[ConditionEntry].resource only IPSUnifiedCondition
* entry contains ObsEntry 0..*
* entry[ObsEntry].resource only IPSUnifiedObservation

//--------------------------------------------------------------------------------
// IPS Unified Patient
//--------------------------------------------------------------------------------
Profile: IPSUnifiedPatient
Parent: Patient
Id: IPSUnifiedPatient
Title: "IPS Unified Patient"
Description: "The Patient resource as used in the IPS Unified bundle."
* identifier 1..2
* name 1..1
* name.family 1..1
* name.given 1..1
* gender 1..1
* birthDate 1..1
* address 1..1
* address.country 1..1

//--------------------------------------------------------------------------------
// IPS Unified Organization
//--------------------------------------------------------------------------------
Profile: IPSUnifiedOrganization
Parent: Organization
Id: IPSUnifiedOrganization
Title: "IPS Unified Organization"
Description: "The Organization resource as used in the IPS Unified bundle."
* name 1..1

//--------------------------------------------------------------------------------
// IPS Unified MedicationRequest
//--------------------------------------------------------------------------------
Profile: IPSUnifiedMedicationRequest
Parent: MedicationRequest
Id: IPSUnifiedMedicationRequest
Title: "IPS Unified MedicationRequest"
Description: "MedicationRequest entries in the IPS Unified bundle."
* status 1..1
* medicationReference 1..1
* subject 1..1
* authoredOn 1..1
* dosageInstruction 1..1

//--------------------------------------------------------------------------------
// IPS Unified Medication
//--------------------------------------------------------------------------------
Profile: IPSUnifiedMedication
Parent: Medication
Id: IPSUnifiedMedication
Title: "IPS Unified Medication"
Description: "Medication entries in the IPS Unified bundle."
* code 1..1
* code.coding 1..*
* code.coding.display 1..1
* code.coding.system 1..1
* code.coding.code 1..1

//--------------------------------------------------------------------------------
// IPS Unified AllergyIntolerance
//--------------------------------------------------------------------------------
Profile: IPSUnifiedAllergyIntolerance
Parent: AllergyIntolerance
Id: IPSUnifiedAllergyIntolerance
Title: "IPS Unified AllergyIntolerance"
Description: "AllergyIntolerance entries in the IPS Unified bundle."
* category 1..1
* criticality 1..1
* code 1..1
* code.coding 1..*
* code.coding.display 1..1
* code.coding.system 1..1
* code.coding.code 1..1
* patient 1..1
* onsetDateTime 1..1

//--------------------------------------------------------------------------------
// IPS Unified Condition
//--------------------------------------------------------------------------------
Profile: IPSUnifiedCondition
Parent: Condition
Id: IPSUnifiedCondition
Title: "IPS Unified Condition"
Description: "Condition entries in the IPS Unified bundle."
* code 1..1
* code.coding 1..*
* code.coding.display 1..1
* code.coding.system 1..1
* code.coding.code 1..1
* subject 1..1
* onsetDateTime 1..1

//--------------------------------------------------------------------------------
// IPS Unified Observation
//--------------------------------------------------------------------------------
Profile: IPSUnifiedObservation
Parent: Observation
Id: IPSUnifiedObservation
Title: "IPS Unified Observation"
Description: "Observation entries in the IPS Unified bundle."
* status 1..1
* code 1..1
* code.coding 1..*
* code.coding.display 1..1
* code.coding.system 1..1
* code.coding.code 1..1
* subject 1..1
* effectiveDateTime 1..1
* valueQuantity 0..1
* component 0..*
* bodySite 0..1
