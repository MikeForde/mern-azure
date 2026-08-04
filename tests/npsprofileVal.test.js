const { validateBundle } = require('../schema/npsprofileVal');

function buildBundle(conditionOverrides = {}) {
  return {
    resourceType: 'Bundle',
    id: 'test-bundle',
    meta: {
      profile: ['http://nato.int/nps/StructureDefinition/NPSBundle']
    },
    type: 'collection',
    timestamp: '2024-06-01T18:56:05+00:00',
    entry: [
      {
        fullUrl: 'urn:uuid:patient-james-bond',
        resource: {
          resourceType: 'Patient',
          id: 'NPSPatientExample',
          meta: {
            profile: ['http://nato.int/nps/StructureDefinition/NPSPatient']
          },
          identifier: [
            {
              system: 'urn:nps:service-id',
              value: 'GBR:12345678'
            }
          ],
          name: [
            {
              family: 'Bond',
              given: ['James']
            }
          ],
          birthDate: '1968-04-13'
        }
      },
      {
        fullUrl: 'urn:uuid:condition-example',
        resource: {
          resourceType: 'Condition',
          id: 'NPSConditionExample',
          meta: {
            profile: ['http://nato.int/nps/StructureDefinition/NPSCondition']
          },
          code: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '44054006',
                display: 'Diabetes mellitus type 2'
              }
            ]
          },
          subject: {
            reference: 'Patient/NPSPatientExample'
          },
          ...conditionOverrides
        }
      }
    ]
  };
}

describe('nps profile validator constraints', () => {
  test('flags Condition when neither onsetDateTime nor recordedDate is present', () => {
    const result = validateBundle(buildBundle());

    expect(result.errorsProfile).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/entry/1/resource/Condition',
          message: 'Condition.onsetDateTime or Condition.recordedDate or both SHALL be present'
        })
      ])
    );
  });

  test('accepts Condition when recordedDate is present without onsetDateTime', () => {
    const result = validateBundle(buildBundle({ recordedDate: '2024-06-01T18:56:05+00:00' }));

    expect(result.errorsProfile).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Condition.onsetDateTime or Condition.recordedDate or both SHALL be present'
        })
      ])
    );
  });
});
