require("dotenv").config();
const express = require("express");
const ReadPreference = require("mongodb").ReadPreference;
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { IPSModel } = require("./models/IPSModel");
const uuidv4 = require('uuid').v4;

const { DB_CONN } = process.env;

const api = express();
api.use(cors()); // enable CORS on all our requests
api.use(express.json()); // parses incoming requests with JSON payloads
api.use(express.urlencoded({ extended: false })); // parses incoming requests with urlencoded payloads

mongoose
    .connect(DB_CONN, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("DB connection successful"))
    .catch(console.error);

api.get("/ips/all", (req, res) => {
    IPSModel.find({})
        .read(ReadPreference.NEAREST)
        .exec()
        .then((ipss) => {
            res.json(ipss);
        })
        .catch((err) => {
            res.status(400).send(err);
        });
});

api.get("/ipsraw/:id", (req, res) => {
    const id = req.params.id;
    IPSModel.findById(id)
      .exec()
      .then((ips) => {
        if (!ips) {
          return res.status(404).json({ message: "IPS record not found" });
        }
        if (req.query.pretty === 'true') {
            // Return formatted JSON with indentation for readability
            const formattedJson = JSON.stringify(ips, null, "\t");
            res.send(formattedJson);
        } else {
            // Return JSON without formatting
            res.json(ips);
        }
      })
      .catch((err) => {
        res.status(400).send(err);
      });
  });

  api.get("/ips/:id", (req, res) => {
    const id = req.params.id;
    IPSModel.findById(id)
      .exec()
      .then((ips) => {
        if (!ips) {
          return res.status(404).json({ message: "IPS record not found" });
        }
  
        // Constructing the JSON structure
        const bundle = {
          resourceType: "Bundle",
          id: ips.packageUUID, // First ID is the packageUUID
          type: "collection",
          total: 2 + (ips.medication.length * 2) + ips.allergies.length, // Total resources
          entry: [
            {
              resource: {
                resourceType: "Patient",
                id: uuidv4(), // Generate UUID for patient ID
                name: [
                  {
                    family: ips.patient.name,
                    text: `${ips.patient.given} ${ips.patient.name}`,
                    given: [ips.patient.given, ips.patient.given.charAt(0)],
                  },
                ],
                gender: "female",
                birthDate: ips.patient.dob, // Date of birth
                address: [
                  {
                    country: ips.patient.nationality, // Nationality
                  },
                ],
              },
            },
            {
              resource: {
                resourceType: "Practitioner",
                id: uuidv4(), // Generate UUID for practitioner ID
                name: [
                  {
                    text: ips.patient.practitioner, // Practitioner name
                  },
                ],
              },
            },
            // Medication entries
            ...ips.medication.flatMap((med) => [
              {
                resource: {
                  resourceType: "MedicationRequest",
                  id: uuidv4(), // Generate UUID for medication request ID
                  intent: "order",
                  medicationReference: {
                    reference: `urn:uuid:${uuidv4()}`, // Generate UUID for medication reference
                    display: med.name, // Medication name
                  },
                  authoredOn: med.date, // Date
                  dosageInstruction: [
                    {
                      text: med.dosage, // Dosage
                      // Other dosage instructions
                    },
                  ],
                },
              },
              {
                resource: {
                  resourceType: "Medication",
                  id: uuidv4(), // Generate UUID for medication request ID
                  code: {
                    coding: [
                      {
                        display: med.name, // Medication name
                      },
                    ],
                  },
                },
              },
            ]),
            // Allergy entries
            ...ips.allergies.map((allergy) => ({
              resource: {
                resourceType: "AllergyIntolerance",
                id: uuidv4(), // Generate UUID for allergy ID
                category: ["medication"],
                criticality: "high",
                code: {
                  coding: [
                    {
                      display: allergy.name, // Allergy name
                    },
                  ],
                },
                onsetDateTime: allergy.date, // Onset date
              },
            })),
          ],
        };
  
        res.json(bundle);
      })
      .catch((err) => {
        res.status(400).send(err);
      });
  });
  
  

api.post("/ips", (req, res) => {
    console.log("req.body", req.body);

    const newIPS = new IPSModel(req.body);

    newIPS
        .save()
        .then((newIPS) => {
            res.json(newIPS);
        })
        .catch((err) => {
            res.status(400).send(err);
        });
});

api.put("/ips/:id", (req, res) => {
    const { id } = req.params;

    if (id) {
        IPSModel.findById(id)
            .read(ReadPreference.NEAREST)
            .exec()
            .then((ips) => {
                //ips.isDone = !ips.isDone;
                ips.save().then((updatedIPS) => {
                    res.json(updatedIPS);
                });
            })
            .catch((err) => {
                res.status(400).send(err);
            });
    } else {
        res.status(404).send("IPS not found.");
    }
});

api.delete("/ips/:id", (req, res) => {
    const { id } = req.params;

    if (id) {
        IPSModel.findByIdAndRemove(id)
            .then((ips) => {
                res.json(ips._id);
            })
            .catch((err) => {
                res.status(400).send(err);
            });
    }
});

api.use(express.static(path.join(__dirname, "client", "build")));
api.get("/*", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});

const port = process.env.PORT || 5000;
api.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
  })