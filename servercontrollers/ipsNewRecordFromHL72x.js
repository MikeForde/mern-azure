// servercontrollers/ipsNewRecordFromHL72x.js
const { upsertIPS } = require('./servercontrollerfuncs/ipsService');
const { parseHL72_xToMongo } = require('./servercontrollerfuncs/convertHL72_xToSchema');

async function addIPSFromHL72x(req, res) {
  console.log("HL7.x payload", req.body);
  try {
    const ipsRecord = parseHL72_xToMongo(req.body);
    console.log("Converted record", ipsRecord);
    const result = await upsertIPS(ipsRecord);
    res.json(result);
  } catch (error) {
    res.status(400).send(error.message);
  }
}

module.exports = { addIPSFromHL72x };
