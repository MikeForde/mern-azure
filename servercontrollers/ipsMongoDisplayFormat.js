// In ipsRawFormat.js
const { validate: isValidUUID } = require('uuid');
const { IPSModel } = require('../models/IPSModel');

function getMongoFormatted(req, res) {
  const id = req.params.id;
  let query;

  // Check if the provided ID is a valid UUID
  if (isValidUUID(id)) {
    // Search using packageUUID if it is a valid UUID
    query = IPSModel.findOne({ packageUUID: id });
  } else {
    // Otherwise, assume it is a MongoDB ObjectId
    query = IPSModel.findById(id);
  }

  // Execute the query
  query.exec()
    .then((ips) => {
      if (!ips) {
        return res.status(404).json({ message: "IPS record not found" });
      }

      // Format the response data
      const formattedData = {
        packageUUID: ips.packageUUID,
        patient: {
          name: ips.patient.name,
          given: ips.patient.given,
          dob: ips.patient.dob,
          gender: ips.patient.gender,
          practitioner: ips.patient.practitioner,
          nation: ips.patient.nation
        },
        medication: ips.medication.map(med => ({
          name: med.name,
          date: med.date,
          dosage: med.dosage
        })),
        allergies: ips.allergies.map(allergy => ({
          name: allergy.name,
          criticality: allergy.criticality[0].toLowerCase(), // First character, lowercased
          date: allergy.date
        })),
        conditions: ips.conditions.map(condition => ({
          name: condition.name,
          date: condition.date
        }))
      };

      if (req.query.pretty === 'true') {
        // Return formatted JSON with indentation for readability
        const formattedJson = JSON.stringify(formattedData, null, "\t");
        res.send(formattedJson);
      } else {
        // Return JSON without formatting
        res.json(formattedData);
      }
    })
    .catch((err) => {
      res.status(400).send(err);
    });
}

module.exports = { getMongoFormatted };
