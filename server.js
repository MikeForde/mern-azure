require("dotenv").config();
const express = require("express");
const axios = require('axios');
const ReadPreference = require("mongodb").ReadPreference;
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { IPSModel } = require("./models/IPSModel");
const { getIPSBundle } = require('./servercontrollers/ipsBundleFormat');
const { getIPSBundleByName } = require('./servercontrollers/ipsBundleByName');
const { getIPSLegacyBundle } = require('./servercontrollers/ipsBundleFormat_old');
const { getIPSXMLBundle } = require('./servercontrollers/ipsXMLBundleFormat');
const { getIPSRaw, getAllIPS } = require('./servercontrollers/ipsDatabaseFormats');
const getIPSBasic = require("./servercontrollers/ipsBasicFormat");
const { addIPS, addIPSMany } = require('./servercontrollers/ipsNewRecord');
const { addIPSFromBundle } = require("./servercontrollers/ipsNewRecordFromBundle");
const { updateIPS, deleteIPS } = require('./servercontrollers/ipsCRUD_UD');
const { getIPSSearch } = require('./servercontrollers/ipsRecordSearch');


const { DB_CONN } = process.env;

const api = express();
api.use(cors()); // enable CORS on all our requests
api.use(express.json()); // parses incoming requests with JSON payloads
api.use(express.urlencoded({ extended: false })); // parses incoming requests with urlencoded payloads

mongoose
    .connect(DB_CONN, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("DB connection successful"))
    .catch(console.error);

// API POST - CRUD Create
api.post("/ips", addIPS);
api.post("/ipsmany", addIPSMany);
api.post("/ipsbundle", addIPSFromBundle);

// API GET - CRUD Read
api.get("/ips/all", getAllIPS);
api.get("/ipsraw/:id", getIPSRaw);
api.get("/ips/:id", getIPSBundle);
api.get("/ipsbasic/:id", getIPSBasic);
api.get("/ipsxml/:id", getIPSXMLBundle);
api.get("/ipslegacy/:id", getIPSLegacyBundle);
api.get("/ipsbyname/:name/:given", getIPSBundleByName);
api.get("/ips/search/:name", getIPSSearch);
api.get('/fetchipsora/:name/:givenName', async (req, res) => {
    console.log('name:', req.params.name, 'givenName:', req.params.givenName);
    const { name, givenName } = req.params;
    
    try {
      const response = await axios.get(`https://4202xiwc.offroadapps.dev:62444/Fhir/ips/json/${name}/${givenName}`);
      res.json(response.data);
    } catch (error) {
      console.error('Error fetching data from external API:', error.message);
      if (error.response) {
        console.error('Status code:', error.response.status);
        console.error('Response data:', error.response.data);
        res.status(error.response.status).json({ error: error.response.data });
      } else if (error.request) {
        console.error('No response received:', error.request);
        res.status(500).json({ error: 'No response received from external API' });
      } else {
        console.error('Error setting up request:', error.message);
        res.status(500).json({ error: 'Error setting up request to external API' });
      }
    }
  });
  
// API PUT - CRUD Update
api.put("/ips/:id", updateIPS);

// API DELETE - CRUD Delete
api.delete("/ips/:id", deleteIPS);

api.use(express.static(path.join(__dirname, "client", "build")));
api.get("/*", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});

const port = process.env.PORT || 5000;
api.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
  })