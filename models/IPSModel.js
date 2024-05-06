const mongoose = require('mongoose');

const IPSModel = mongoose.model(
    "ips",
    new mongoose.Schema({
        packageUUID: {
            type: String,
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
            nationality: {
                type: String,
                required: true
            },
            practitioner: {
                type: String,
                required: true
            }
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
                severity: String,
                date: Date
            }
        ],
    })
);

exports.IPSModel = IPSModel;