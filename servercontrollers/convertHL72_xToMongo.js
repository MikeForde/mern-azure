const { parseHL72_xToMongo } = require('./servercontrollerfuncs/convertHL72_xToSchema');

function convertHL72_xToMongo(req, res) {
  let hl7Message;

  // Check if 'data' is provided in the body, otherwise assume entire body is the HL7 message
  if (req.body.data) {
    hl7Message = req.body.data;
  } else {
    hl7Message = req.body;
  }

  console.log(hl7Message);

  // Ensure hl7Message is a valid string
  if (typeof hl7Message !== 'string' || !hl7Message.trim()) {
    return res.status(400).send('Invalid HL7 message format');
  }

  try {
    // Parse the HL7 message into a MongoDB-compatible format
    const mongoRecord = parseHL72_xToMongo(hl7Message);
    res.json(mongoRecord); // Send back as JSON response
  } catch (error) {
    console.error('Error converting HL7 2.x to MongoDB format:', error);
    res.status(500).send('Error converting HL7 2.x to MongoDB format');
  }
}

module.exports = { convertHL72_xToMongo };
