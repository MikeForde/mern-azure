const express = require('express');
const router = express.Router();
const { generateIPSBEER } = require('./servercontrollerfuncs/generateIPSBEER');

function convertMongoToBEER(req, res) {
  const { data } = req.body;

  try {
    const mongoRecord = JSON.parse(data);
    const delimiter = '\n'; // Assuming newline delimiter
    const beerData = generateIPSBEER(mongoRecord, delimiter);
    res.send(beerData);
  } catch (error) {
    console.error('Error converting to BEER format:', error);
    res.status(500).send('Error converting to BEER format');
  }
}

module.exports = { convertMongoToBEER};
