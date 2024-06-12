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
                required: true
            },
            practitioner: {
                type: String,
                required: true
            },
            organization: {
                type: String,
                required: false
            },
        },
        medication: [
            {
                name: String,
                date: Date,
                dosage: String,
            }
        ],
        allergies: [
            {
                name: String,
                criticality: String,
                date: Date
            }
        ],
        conditions: [
            {
                name: String,
                date: Date
            }
        ],
        observations: [
            {
                name: String,
                date: Date,
                value: String
            }
        ],
    })
);

exports.IPSModel = IPSModel;