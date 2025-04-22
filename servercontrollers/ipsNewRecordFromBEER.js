// servercontrollers/ipsNewRecord.js
const { parseBEER } = require('./servercontrollerfuncs/convertIPSBEERToSchema');
const { upsertIPS } = require('./servercontrollerfuncs/ipsService');

async function addIPSFromBEER(req, res) {
    // Extract IPS Bundle from request body
    const ipsBEER = req.body;

    console.log(ipsBEER);

    const delimiter = req.query.delim || 'newline';

    // Convert IPS BEER to desired schema
    try {
        const ipsRecord = parseBEER(ipsBEER, delimiter);

        console.log(ipsRecord);

        // Create a new IPS record using the converted schema
        const result = await upsertIPS(ipsRecord);
        res.json(result);
    } catch (error) {
        res.status(400).send(error.message);
    }
}

module.exports = { addIPSFromBEER };
