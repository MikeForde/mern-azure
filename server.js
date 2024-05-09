require("dotenv").config();
const express = require("express");
const ReadPreference = require("mongodb").ReadPreference;
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { IPSModel } = require("./models/IPSModel");
const { getIPSBundle } = require('./servercontrollers/ipsBundleFormat');
const { getIPSXMLBundle } = require('./servercontrollers/ipsXMLBundleFormat');
const { getIPSRaw, getAllIPS } = require('./servercontrollers/ipsDatabaseFormats');
const getIPSBasic = require("./servercontrollers/ipsBasicFormat");
const { addIPS, addIPSMany } = require('./servercontrollers/ipsNewRecord');
const { updateIPS, deleteIPS } = require('./servercontrollers/ipsCRUD_UD');

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

// API GET - CRUD Read
api.get("/ips/all", getAllIPS);
api.get("/ipsraw/:id", getIPSRaw);
api.get("/ips/:id", getIPSBundle);
api.get("/ipsbasic/:id", getIPSBasic);
api.get("/ipsxml/:id", getIPSXMLBundle);
  
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