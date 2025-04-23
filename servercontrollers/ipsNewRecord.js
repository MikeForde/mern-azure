// server/controllers/ipsNewRecord.js
const { upsertIPS } = require('./servercontrollerfuncs/ipsService');

async function addIPS(req, res) {
  try {
    console.log("req.body", req.body);
    const result = await upsertIPS(req.body);

    // emit the new/updated record
    const io = req.app.get('io');
    if (io) {
      io.emit('ipsUpdated', result);
    }

    res.json(result);
  } catch (err) {
    res.status(400).send(err);
  }
}

async function addIPSMany(req, res) {
  try {
    console.log("req.body (many)", req.body);
    // run all in parallel; if you want bulkWrite for perf, you can swap in a bulk implementation here
    const results = await Promise.all(req.body.map(ipsData => upsertIPS(ipsData)));

    // emit the new/updated record
    const io = req.app.get('io');
    if (io) {
      io.emit('ipsUpdated', result);
    }
    
    res.json(results);
  } catch (err) {
    res.status(400).send(err);
  }
}

module.exports = { addIPS, addIPSMany };
