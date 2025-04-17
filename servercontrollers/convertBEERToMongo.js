const express = require('express');
const router = express.Router();
const { parseBEER } = require('./servercontrollerfuncs/convertIPSBEERToSchema');

function convertBEERToMongo(req, res) {
  let beerMessage;

  // Check if 'data' is provided in the body, otherwise assume entire body is the HL7 message
  if (req.body.data) {
    beerMessage = req.body.data;
  } else {
    beerMessage = req.body;
  }

  console.log(beerMessage);

  try {
    const delimiter = '\n'; // Assuming newline delimiter
    const mongoData = parseBEER(beerMessage, delimiter);
    console.log('mongoData:', mongoData);
    res.json(mongoData);
  } catch (error) {
    console.error('Error converting to MongoDB format:', error);
    res.status(500).send('Error converting to MongoDB format');
  }
};

module.exports = { convertBEERToMongo };
