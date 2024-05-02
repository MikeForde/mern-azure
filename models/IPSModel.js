const mongoose = require("mongoose");

const IPSModel = mongoose.model(
    "ips",
    new mongoose.Schema({
        packageUUID: String,
        patient: {
            name: String,
            given: String,
            dob: String,
            nationality: String,
            practitioner: String,
        },
        medication: [
                {
                    name: String,
                    date: String,
                    dosage: String,
                }
        ],
        allergies: [
            {
                name: String,
                severity: String,
                date: String,
            }
        ],
        })
);
exports.IPSModel = IPSModel;