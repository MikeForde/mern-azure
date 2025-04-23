// servercontrollers/ipsNewRecord.js
const { convertIPSBundleToSchema } = require('./servercontrollerfuncs/convertIPSBundleToSchema');
const { convertFhirXmlToJson } = require('./servercontrollerfuncs/convertFHIRXMLtoJSON');
const { upsertIPS } = require('./servercontrollerfuncs/ipsService');

async function addIPSFromBundle(req, res) {
    // Extract IPS Bundle from request body
    try {
        let ipsBundle = req.body;

        if (
            ipsBundle &&
            typeof ipsBundle === 'object' &&
            !ipsBundle.resourceType &&
            Object.keys(ipsBundle).length === 1
        ) {
            console.log("Converted incoming FHIR XML to IPS JSON");
            ipsBundle = convertFhirXmlToJson(ipsBundle);
        }

        // Convert IPS Bundle to desired schema
        const ipsRecord = convertIPSBundleToSchema(ipsBundle);
        console.log("Converted IPS record:", ipsRecord);

        const result = await upsertIPS(ipsRecord);

        // emit the new/updated record
        const io = req.app.get('io');
        if (io) {
            io.emit('ipsUpdated', result);
        }

        res.json(result);
    } catch (error) {
        console.error("Error in addIPSFromBundle:", error);
        res.status(500).json({ error: "Failed to add IPS record from IPS Bundle" });
    }
}

module.exports = { addIPSFromBundle };
