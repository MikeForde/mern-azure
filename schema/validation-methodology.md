# NPS FHIR Validation Methodology

This project currently has three distinct validation approaches for NPS FHIR data. They overlap, but they do not do the same job.

## 1. Draft-07 NPS Schema Validation

Primary implementation:
- `schema/ipsUniVal.js`
- `client/public/ipsdef/*.schema.json`

Method:
- Uses JSON Schema Draft-07 files written for this project.
- Validates the expected NPS bundle/resource shape as defined by our own schema set.
- Adds custom bundle-level logic in code, such as reference resolution and other NPS-specific checks.

Strengths:
- Fast and pragmatic.
- Easy to tailor to the exact application behaviour we want.
- Good for project-specific business rules.
- Error messages can be made very direct for users of this system.

Limitations:
- It is not an HL7-authored conformance model.
- Coverage depends on what we encoded into the Draft-07 files.
- It does not naturally express all FHIR profiling features.
- It can drift from the published NPS profile if the two are maintained separately.

Best use:
- App-level NPS validation.
- Custom constraints that are important to this system even if they are not pure HL7 profile rules.

## 2. Base FHIR R4 Structural Validation

Primary implementation:
- `schema/fhir.schema.json`
- used in `schema/ipsUniVal.js`
- used in `schema/npsprofileVal.js`

Method:
- Uses the generic FHIR R4 JSON Schema.
- Validates that resources are structurally valid FHIR R4 resources.
- Checks base FHIR fields, types, required base elements, and unexpected properties.

Strengths:
- Catches non-FHIR or malformed FHIR JSON.
- Good for detecting unknown fields and incorrect base resource structure.
- Independent of NPS-specific constraints.

Limitations:
- It only knows base FHIR R4, not the NATO NPS profile intent.
- It does not tell you whether a valid FHIR resource conforms to the NPS IG.
- JSON Schema alone does not cover all HL7 profiling behaviour.

Best use:
- General FHIR sanity checking.
- A companion pass alongside NPS-specific validation.

## 3. NPS Profile Validation

Primary implementation:
- `schema/npsprofileVal.js`
- `schema/profile/package.r4.tgz`

Method:
- Uses the published NPS `StructureDefinition` profiles from the implementation guide package.
- Reads the profile snapshot definitions and applies profile-derived checks.
- Validates the NPS-specific shape expected by the NATO profile set.

Current checks in this project:
- profile cardinality
- fixed values where present
- reference target type checks
- FHIR choice element handling such as `medication[x] -> medicationReference`

Strengths:
- Much closer to the published NPS implementation guide.
- Reduces the risk of divergence from the official profile definitions.
- Explains failures in terms of the NPS profile rather than only our custom schema.

Limitations:
- Current implementation is a lightweight in-project validator, not the full HL7 validator engine.
- It does not yet provide full HL7/FHIR profile parity for all invariants, slicing, terminology, and FHIRPath behaviour.
- It should be treated as profile-driven validation, but not as full official HL7 validation.

Best use:
- Checking whether a bundle/resource conforms to the published NPS profile rules we can derive from the IG.
- Running separately from Draft-07 validation for comparison and rollout.

## Practical Difference

The three layers answer different questions:

- Draft-07 NPS: "Does this match the application-specific NPS rules we coded?"
- FHIR R4: "Is this structurally valid FHIR R4 JSON?"
- NPS Profile: "Does this conform to the published NATO NPS profile model?"

## Recommended Interpretation

For NPS bundle validation in this codebase:

1. Use FHIR R4 validation to reject malformed FHIR.
2. Use NPS profile validation to assess conformance to the published profile.
3. Use Draft-07 validation for local business rules and project-specific constraints.

That means these layers are complementary rather than mutually exclusive.

## Current Endpoints

- `/ipsUniVal`
  - Draft-07 NPS validation
  - plus generic FHIR R4 validation

- `/npsProfileVal`
  - NPS profile-driven validation
  - plus generic FHIR R4 validation

## Summary

Draft-07 is the project's custom conformance layer.

FHIR R4 validation is the generic structural correctness layer.

NPS profile validation is the published IG-driven conformance layer.

Using more than one is appropriate because each one detects a different class of problem.
