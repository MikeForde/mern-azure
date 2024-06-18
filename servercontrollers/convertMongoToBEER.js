
const { generateIPSBEER } = require('./servercontrollerfuncs/generateIPSBEER');

function convertMongoToBEER(req, res) {
  let mongoRecord;

  // Check if 'data' is already an object or needs to be parsed from a string
  let delimiter = '\n';

  if (typeof req.body.data === 'string') {
    try {
      mongoRecord = JSON.parse(req.body.data);
    } catch (error) {
      console.error('Invalid JSON format:', error);
      return res.status(400).send('Invalid JSON format');
    }
  } else {
    mongoRecord = req.body;
    delimiter = '|';
  }

  delimiter = req.body.delimiter || delimiter;

  // Check if mongoRecord is valid
  if (typeof mongoRecord !== 'object' || mongoRecord === null) {
    return res.status(400).send('Invalid MongoDB record');
  }

  try {
    const beerData = generateIPSBEER(mongoRecord, delimiter);
    res.send(beerData);
  } catch (error) {
    console.error('Error converting to BEER format:', error);
    res.status(500).send('Error converting to BEER format');
  }
}

module.exports = { convertMongoToBEER };

