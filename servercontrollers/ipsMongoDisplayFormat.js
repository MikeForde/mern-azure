const { resolveId } = require('../utils/resolveId');

function getMongoFormatted(req, res) {
    const id = req.params.id;

    resolveId(id)
        .then((ips) => {
            if (!ips) {
                return res.status(404).json({ message: "IPS record not found" });
            }

            // Format the response data
            const formattedData = {
                packageUUID: ips.packageUUID,
                timeStamp: ips.timeStamp,
                patient: {
                    name: ips.patient.name,
                    given: ips.patient.given,
                    dob: ips.patient.dob,
                    gender: ips.patient.gender,
                    practitioner: ips.patient.practitioner,
                    nation: ips.patient.nation,
                    organization: ips.patient.organization
                },
                medication: ips.medication.map(med => ({
                    name: med.name,
                    date: med.date,
                    dosage: med.dosage,
                    code: med.code,
                    system: med.system
                })),
                allergies: ips.allergies.map(allergy => ({
                    name: allergy.name,
                    criticality: allergy.criticality,
                    date: allergy.date,
                    code: allergy.code,
                    system: allergy.system
                })),
                conditions: ips.conditions.map(condition => ({
                    name: condition.name,
                    date: condition.date,
                    code: condition.code,
                    system: condition.system
                })),
                observations: ips.observations.map(observation => ({
                    name: observation.name,
                    code: observation.code,
                    system: observation.system,
                    date: observation.date,
                    value: observation.value
                })),
                immunizations: ips.immunizations.map(immunization => ({
                    name: immunization.name,
                    code: immunization.code,
                    system: immunization.system,
                    date: immunization.date
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
            console.error('Error fetching Mongo formatted record:', err);
            res.status(500).send('Internal Server Error');
        });
}

module.exports = { getMongoFormatted };
