const { mergeExternalIssues } = require('../schema/ipsExternalVal');

describe('ips external validator merge', () => {
  test('keeps only error severity issues and deduplicates across sources', () => {
    const result = mergeExternalIssues([
      {
        name: 'hl7',
        data: {
          issue: [
            {
              severity: 'warning',
              diagnostics: 'Rule dom-6 failed',
              location: ['Bundle.entry[0].resource/*Patient/abc*/']
            },
            {
              severity: 'error',
              diagnostics: "Validation failed for 'http://unitsofmeasure.org#rpm'",
              location: ['Bundle.entry[13].resource/*Observation/abc*/.value.ofType(Quantity)']
            }
          ]
        }
      },
      {
        name: 'tx',
        data: {
          issue: [
            {
              severity: 'information',
              diagnostics: "Unknown code '4443490082' in the CodeSystem 'http://snomed.info/sct'",
              location: ['Bundle.entry[2].resource/*MedicationRequest/null*/.medication.ofType(Reference)']
            },
            {
              severity: 'error',
              diagnostics: "Unknown code '4443490082' in the CodeSystem 'http://snomed.info/sct'",
              location: ['Bundle.entry[3].resource/*Medication/null*/.code']
            }
          ]
        }
      }
    ]);

    expect(result).toEqual([
      {
        severity: 'error',
        path: 'Bundle.entry[13].resource/*Observation/abc*/.value.ofType(Quantity)',
        message: "Validation failed for 'http://unitsofmeasure.org#rpm'",
        sources: ['hl7']
      },
      {
        severity: 'error',
        path: 'Bundle.entry[3].resource/*Medication/null*/.code',
        message: "Unknown code '4443490082' in the CodeSystem 'http://snomed.info/sct'",
        sources: ['tx']
      }
    ]);
  });

  test('merges matching errors reported by both validators', () => {
    const result = mergeExternalIssues([
      {
        name: 'hl7',
        data: {
          issue: [
            {
              severity: 'error',
              diagnostics: "Unknown code '4443490082' in the CodeSystem 'http://snomed.info/sct'",
              location: ['Bundle.entry[3].resource/*Medication/123*/.code']
            }
          ]
        }
      },
      {
        name: 'tx',
        data: {
          issue: [
            {
              severity: 'error',
              diagnostics: "Unknown code '4443490082' in the CodeSystem 'http://snomed.info/sct'",
              location: ['Bundle.entry[3].resource/*Medication/null*/.code']
            }
          ]
        }
      }
    ]);

    expect(result).toEqual([
      {
        severity: 'error',
        path: 'Bundle.entry[3].resource/*Medication/123*/.code',
        message: "Unknown code '4443490082' in the CodeSystem 'http://snomed.info/sct'",
        sources: ['hl7', 'tx']
      }
    ]);
  });
});
