const { status } = require('@grpc/grpc-js');
const mongoose = require('mongoose');

const IPSModel = mongoose.model(
    "ipsAlt",
    new mongoose.Schema({
        packageUUID: {
            type: String,
            required: true
        },
        timeStamp: {
            type: Date,
            required: true
        },
        patient: {
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
                name: String,
                criticality: String,
                date: Date,
                system: String,
                code: String
            }
        ],
        conditions: [
            {
                name: String,
                date: Date,
                system: String,
                code: String
            }
        ],
        observations: [
            {
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
                name: String,
                system: String,
                code: String,
                date: Date,
                status: String,
            }
        ],
        procedures: [
            {
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