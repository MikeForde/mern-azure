require("dotenv").config();
const express = require("express");
const axios = require('axios');
const ReadPreference = require("mongodb").ReadPreference;
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const xmlparser = require("express-xml-bodyparser");
const { IPSModel } = require("./models/IPSModel");
const { getIPSBundle } = require('./servercontrollers/ipsBundleFormat');
const { getIPSBundleByName } = require('./servercontrollers/ipsBundleByName');
const { getORABundleByName } = require('./servercontrollers/oraBundleByName');
const { getIPSLegacyBundle } = require('./servercontrollers/ipsBundleFormat_old');
const { getIPSXMLBundle } = require('./servercontrollers/ipsXMLBundleFormat');
const { getIPSRaw, getAllIPS } = require('./servercontrollers/ipsDatabaseFormats');
const { getMongoFormatted } = require('./servercontrollers/ipsMongoDisplayFormat');
const getIPSBasic = require("./servercontrollers/ipsBasicFormat");
const getIPSBEER = require("./servercontrollers/ipsBEERFormat");
const getIPSHL72_8 = require("./servercontrollers/ipsHL728Format");
const { addIPS, addIPSMany } = require('./servercontrollers/ipsNewRecord');
const { addIPSFromBundle } = require("./servercontrollers/ipsNewRecordFromBundle");
const { addIPSFromBEER } = require("./servercontrollers/ipsNewRecordFromBEER");
const { addIPSFromCDA } = require('./servercontrollers/addIPSFromCDA');
const { postIPSBundle } = require('./servercontrollers/postIPSBundle');
const { postIPSBundleNLD } = require('./servercontrollers/postIPSBundleNLD');
const { updateIPS, deleteIPS, deleteIPSbyPractitioner } = require('./servercontrollers/ipsCRUD_UD');
const { getIPSSearch } = require('./servercontrollers/ipsRecordSearch');
const { convertMongoToBEER } = require('./servercontrollers/convertMongoToBEER');
const { convertMongoToHL72_8 } = require('./servercontrollers/convertMongoToHL72_8');
const { convertBEERToMongo } = require('./servercontrollers/convertBEERToMongo');
const { convertBEERToIPS } = require('./servercontrollers/convertBEERToIPS');
const { convertIPSToBEER } = require('./servercontrollers/convertIPSToBEER');
const { updateIPSByUUID } = require('./servercontrollers/updateIPSRecordByUUID');
const { convertCDAToIPS } = require('./servercontrollers/convertCDAToIPS');
const { convertCDAToBEER } = require('./servercontrollers/convertCDAToBEER');
const { convertHL72_8ToMongo} = require('./servercontrollers/convertHL72_8ToMongo');
const { convertHL72_8ToIPS } = require("./servercontrollers/convertHL72_8ToIPS");
const { gzipDecode, gzipEncode } = require("./compression/gzipUtils");


const { DB_CONN } = process.env;

const api = express();
api.use(cors()); // enable CORS on all our requests

// Middleware to decode gzip data
api.use(async (req, res, next) => {
    // Ignore internal API calls
    const isInternalCall = req.headers['sec-fetch-site'] === 'same-origin';

    if (req.headers['content-encoding'] === 'gzip' && !isInternalCall) {
        //console.log("Incoming data claims to be gzip...");
        try {
            let rawData = [];

            // Collect raw binary data from the stream
            req.on('data', (chunk) => rawData.push(chunk));
            req.on('end', async () => {
                try {
                    const buffer = Buffer.concat(rawData); // Combine chunks into a single buffer
                    //console.log("Raw Buffer Data:", buffer);

                    // Decompress the gzip data
                    const decompressedData = await gzipDecode(buffer);
                    //console.log("Decompressed Data:", decompressedData);

                    // Attempt to parse as JSON, fallback to plain text
                    try {
                        req.body = JSON.parse(decompressedData); // Parse as JSON
                    } catch {
                        req.body = decompressedData; // Keep as plain text if not JSON
                    }

                    next(); // Proceed to the next middleware
                } catch (error) {
                    //console.error("Error decompressing gzip data:", error);
                    res.status(400).send("Invalid gzip data: " + error.message);
                }
            });
        } catch (error) {
            //console.error("Error processing gzip request:", error);
            res.status(500).send("Server error: " + error.message);
        }
    } else if (isInternalCall) {
        next();
    } else {
        next(); // Proceed if not gzip
    }
});

api.use(express.json()); // parses incoming requests with JSON payloads
api.use(express.urlencoded({ extended: false })); // parses incoming requests with urlencoded payloads
api.use(express.text())
api.use(xmlparser());

// Middleware to compress data for response.
api.use(async (req, res, next) => {
    const originalSend = res.send;

    res.send = async function (body) {
        // Treat accept-encoding gzip as flag to send it back as gzip
        const acceptEncoding = req.headers['accept-encoding'] || '';
        // Ignore internal API calls
        const isInternalCall = req.headers['sec-fetch-site'] === 'same-origin';
        if (acceptEncoding.includes('gzip') && !isInternalCall) {
            console.log("Returning response using gzip compression...");
            try {
                // Compress the response body
                const compressedData = await gzipEncode(typeof body === 'object' ? JSON.stringify(body) : body);

                // Set appropriate headers
                res.set('Content-Encoding', 'gzip');
                res.set('Content-Type', 'application/json'); // Assuming JSON responses

                // Send the compressed data
                originalSend.call(this, compressedData);
            } catch (error) {
                console.error('Error compressing response data:', error);
                return res.status(500).send('Error compressing response');
            }
        } else {
            // If gzip is not supported or requested, send the response as-is
            originalSend.call(this, body);
        }
    };

    next();
});


mongoose
    .connect(DB_CONN, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("DB connection successful"))
    .catch(console.error);

// API POST - CRUD Create/Convert
api.post("/ips", addIPS);
api.post("/ipsmany", addIPSMany);
api.post("/ipsbundle", addIPSFromBundle);
api.post('/pushipsora', postIPSBundle);
api.post('/pushipsnld', postIPSBundleNLD);
api.post('/ipsfrombeer', addIPSFromBEER);
api.post('/ipsfromcda', addIPSFromCDA);
api.post('/convertmongo2beer', convertMongoToBEER);
api.post('/convertmongo2hl7', convertMongoToHL72_8);
api.post('/convertbeer2mongo', convertBEERToMongo);
api.post('/convertbeer2ips', convertBEERToIPS);
api.post('/convertips2beer', convertIPSToBEER);
api.post('/convertcdatoips', convertCDAToIPS);
api.post('/convertcdatobeer', convertCDAToBEER);
api.post('/converthl728tomongo', convertHL72_8ToMongo);
api.post('/converthl728toips', convertHL72_8ToIPS)

// API GET - CRUD Read
api.get("/ips/all", getAllIPS);
api.get("/ipsraw/:id", getIPSRaw);
api.get("/ipsmongo/:id", getMongoFormatted);
api.get("/ips/:id", getIPSBundle);
api.get("/ipsbasic/:id", getIPSBasic);
api.get("/ipsbeer/:id/:delim?", getIPSBEER);
api.get("/ipshl728/:id", getIPSHL72_8);
api.get("/ipsxml/:id", getIPSXMLBundle);
api.get("/ipslegacy/:id", getIPSLegacyBundle);
api.get("/ipsbyname/:name/:given", getIPSBundleByName);
api.get("/ips/search/:name", getIPSSearch);
api.get('/fetchipsora/:name/:givenName', getORABundleByName);
  
// API PUT - CRUD Update
api.put("/ips/:id", updateIPS);
api.put("/ipsuuid/:uuid", updateIPSByUUID);

// API DELETE - CRUD Delete
api.delete("/ips/:id", deleteIPS);
api.delete("/ipsdeletebypractitioner/:practitioner", deleteIPSbyPractitioner);

api.use(express.static(path.join(__dirname, "client", "build")));
api.get("/*", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});

const port = process.env.PORT || 5000;
api.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
  })