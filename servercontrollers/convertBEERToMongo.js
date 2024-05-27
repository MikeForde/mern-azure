const express = require('express');
const router = express.Router();
const { parseBEER } = require('./servercontrollerfuncs/convertIPSBEERToSchema');

function convertBEERToMongo(req, res) {
  const { data } = req.body;

  try {
    const delimiter = '\n'; // Assuming newline delimiter
    const mongoData = parseBEER(data, delimiter);
    res.json(mongoData);
  } catch (error) {
    console.error('Error converting to MongoDB format:', error);
    res.status(500).send('Error converting to MongoDB format');
  }
};

module.exports = { convertBEERToMongo };
