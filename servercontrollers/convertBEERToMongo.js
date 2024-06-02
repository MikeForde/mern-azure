const express = require('express');
const router = express.Router();
const { parseBEER } = require('./servercontrollerfuncs/convertIPSBEERToSchema');

function convertBEERToMongo(req, res) {
  const { data } = req.body;

  console.log('data:', data);

  try {
    const delimiter = '\n'; // Assuming newline delimiter
    const mongoData = parseBEER(data, delimiter);
    console.log('mongoData:', mongoData);
    res.json(mongoData);
  } catch (error) {
    console.error('Error converting to MongoDB format:', error);
    res.status(500).send('Error converting to MongoDB format');
  }
};

module.exports = { convertBEERToMongo };
