const { generateIPSHL72_x } = require('./servercontrollerfuncs/generateIPSHL72_x');

function convertMongoToHL72_x(req, res) {
  let mongoRecord;

  // Check if 'data' is already an object or needs to be parsed from a string
  if (req.body.data) {
    if (typeof req.body.data === 'string') {
      try {
        mongoRecord = JSON.parse(req.body.data);
      } catch (error) {
        console.error('Invalid JSON format:', error);
        return res.status(400).send('Invalid JSON format');
      }
    } else {
      mongoRecord = req.body.data;
    }
  } else {
    mongoRecord = req.body; // Assume entire body is the record
  }

  // Check if mongoRecord is valid
  if (typeof mongoRecord !== 'object' || mongoRecord === null) {
    return res.status(400).send('Invalid MongoDB record');
  }

  try {
    const hl728Data = generateIPSHL72_x(mongoRecord);
    res.send(hl728Data);
  } catch (error) {
    console.error('Error converting to HL7 2.3 format:', error);
    res.status(500).send('Error converting to HL7 2.3 format');
  }
}

module.exports = { convertMongoToHL72_x };

