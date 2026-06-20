// const { status } = require('@grpc/grpc-js');
const mongoose = require('mongoose');

const fhirId = () => ({
    type: String,
    required: false,
    trim: true,
    maxlength: 64,
    match: [
        /^[A-Za-z0-9\-.]{1,64}$/,
        'FHIR resource IDs may contain only letters, numbers, hyphens and periods'
    ]
});

const IPSModel = mongoose.model(
    "ipsAlt",
    new mongoose.Schema({
        packageUUID: {
            type: String,
            required: true
        },
        compositionResourceId: fhirId(),
        timeStamp: {
            type: Date,
            required: true
        },
        patient: {
            resourceId: fhirId(),
            organizationResourceId: fhirId(),
            practitionerResourceId: fhirId(),
            name: {
                type: String,
                required: true
            },
            given: {
                type: String,
                required: true
            },
            dob: {
                type: Date,
                required: true
            },
            gender: {
                type: String,
                required: false
            },
            nation: {
                type: String,
                required: false
            },
            practitioner: {
                type: String,
                required: false
            },
            organization: {
                type: String,
                required: false
            },
            identifier: {
                type: String,
                required: false
            },
            identifier2: {
                type: String,
                required: false
            }
        },
        medication: [
            {
                medicationResourceId: fhirId(),
                medicationRequestResourceId: fhirId(),
                name: String,
                date: Date,
                dosage: String,
                system: String,
                code: String,
                status: String,
            }
        ],
        allergies: [
            {
                resourceId: fhirId(),
                name: String,
                criticality: String,
                date: Date,
                system: String,
                code: String
            }
        ],
        conditions: [
            {
                resourceId: fhirId(),
                name: String,
                date: Date,
                system: String,
                code: String
            }
        ],
        observations: [
            {
                resourceId: fhirId(),
                name: String,
                date: Date,
                system: String,
                code: String,
                value: String,
                valueCode: String,
                bodySite: String,
                status: String,
            }
        ],
        immunizations: [
            {
                resourceId: fhirId(),
                name: String,
                system: String,
                code: String,
                date: Date,
                status: String,
            }
        ],
        procedures: [
            {
                resourceId: fhirId(),
                name: String,
                system: String,
                code: String,
                date: Date,
                status: String,
            }
        ],
    })
);

exports.IPSModel = IPSModel;