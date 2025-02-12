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
const { getIPSBundleGeneric } = require('./servercontrollers/fetchips');
const { getIPSLegacyBundle } = require('./servercontrollers/ipsBundleFormat_old');
const { getIPSUnifiedBundle } = require('./servercontrollers/ipsBundleFormatUnified');
const { getIPSXMLBundle } = require('./servercontrollers/ipsXMLBundleFormat');
const { getIPSRaw, getAllIPS } = require('./servercontrollers/ipsDatabaseFormats');
const { getMongoFormatted } = require('./servercontrollers/ipsMongoDisplayFormat');
const { getIPSBasic } = require("./servercontrollers/ipsBasicFormat");
const { getIPSBEER } = require("./servercontrollers/ipsBEERFormat");
const { getIPSHL72_x } = require("./servercontrollers/ipsHL72xFormat");
const { addIPS, addIPSMany } = require('./servercontrollers/ipsNewRecord');
const { addIPSFromBundle } = require("./servercontrollers/ipsNewRecordFromBundle");
const { addIPSFromBEER } = require("./servercontrollers/ipsNewRecordFromBEER");
const { addIPSFromCDA } = require('./servercontrollers/addIPSFromCDA');
const { addIPSFromHL72x } = require('./servercontrollers/ipsNewRecordFromHL72x');
const { postIPSBundle } = require('./servercontrollers/postIPSBundle');
const { postIPSBundleNLD } = require('./servercontrollers/postIPSBundleNLD');
const { postIPSBundleUnified } = require('./servercontrollers/puships');
const { updateIPS, deleteIPS, deleteIPSbyPractitioner } = require('./servercontrollers/ipsCRUD_UD');
const { getIPSSearch } = require('./servercontrollers/ipsRecordSearch');
const { convertMongoToBEER } = require('./servercontrollers/convertMongoToBEER');
const { convertMongoToHL72_x } = require('./servercontrollers/convertMongoToHL72_x');
const { convertBEERToMongo } = require('./servercontrollers/convertBEERToMongo');
const { convertBEERToIPS } = require('./servercontrollers/convertBEERToIPS');
const { convertIPSToBEER } = require('./servercontrollers/convertIPSToBEER');
const { updateIPSByUUID } = require('./servercontrollers/updateIPSRecordByUUID');
const { convertCDAToIPS } = require('./servercontrollers/convertCDAToIPS');
const { convertCDAToBEER } = require('./servercontrollers/convertCDAToBEER');
const { convertCDAToMongo } = require('./servercontrollers/convertCDAToMongo');
const { convertHL72_xToMongo } = require('./servercontrollers/convertHL72_xToMongo');
const { convertHL72_xToIPS } = require("./servercontrollers/convertHL72_xToIPS");
const { gzipDecode, gzipEncode } = require("./compression/gzipUtils");
const { encrypt, decrypt } = require('./encryption/aesUtils');


const { DB_CONN } = process.env;

const api = express();
api.use(cors()); // enable CORS on all our requests

// Combined middleware to handle decryption and decompression
api.use(async (req, res, next) => {
    const isEncrypted = req.headers['x-encrypted'] === 'true';
    const isGzip = req.headers['content-encoding']?.includes('gzip');
    const isBase64 = req.headers['content-encoding']?.includes('base64');
    const isInternalCall = req.headers['sec-fetch-site'] === 'same-origin';

    if ((isEncrypted || isGzip || isBase64) && !isInternalCall) {
        try {
            // Collect raw binary data from the request
            const rawData = await new Promise((resolve, reject) => {
                const chunks = [];
                req.on('data', (chunk) => chunks.push(chunk));
                req.on('end', () => resolve(Buffer.concat(chunks)));
                req.on('error', (err) => reject(err));
            });

            let data = rawData;

            // If encrypted, decrypt the data - could be hex or base64 format
            if (isEncrypted) {
                console.log('Incoming data claims to be encrypted. Base64 flag is: ', isBase64);

                // Parse the JSON payload
                const encryptedPayload = JSON.parse(data.toString('utf8'));
                console.log('Parsed Encrypted Payload:', encryptedPayload);

                // Ensure payload contains necessary fields
                if (!encryptedPayload.encryptedData || !encryptedPayload.iv) {
                    throw new Error('Invalid encrypted payload format');
                }

                // Decrypt the data
                data = decrypt(
                    encryptedPayload.encryptedData,
                    encryptedPayload.iv,
                    isBase64
                );

                console.log('Decrypted Data:', data);
            }

            // If gzip encoded, decompress the data
            if (isGzip) {
                console.log('Incoming data claims to be gzip...', data);
                data = await gzipDecode(data);
                console.log('Decompressed Data:', data);
            }

            // Attempt to parse as JSON, fallback to plain text
            try {
                req.body = JSON.parse(data.toString('utf8')); // Parse as JSON
            } catch {
                req.body = data.toString('utf8'); // Keep as plain text if not JSON
            }

            next();
        } catch (error) {
            console.error('Error processing request data:', error);
            res.status(400).send('Invalid request data');
        }
    } else {
        next();
    }
});


api.use((req, res, next) => {
    if (req.headers['x-encrypted'] === 'true') {
        // Encrypted request; body has already been parsed
        next();
    } else {
        // Not encrypted; apply express.json()
        express.json()(req, res, next);
    }
});
api.use(express.urlencoded({ extended: false })); // parses incoming requests with urlencoded payloads
api.use(express.text())
api.use(xmlparser());

// Middleware to handle requests for data to be returned gzipped, encrypted, or both
api.use((req, res, next) => {
    const originalSend = res.send;

    res.send = async function (body) {
        try {
            //console.log("body is: ", body);
            let modifiedBody = body;
            const acceptEncoding = req.headers["accept-encoding"] || "";
            const isInternalCall = req.headers["sec-fetch-site"] === "same-origin";
            const acceptExtra = req.headers["accept-extra"] || "";
            const acceptEncryption = req.headers["accept-encryption"] || "";

            let isCompressed = false;
            let isBase64 = acceptEncoding.includes("base64") || acceptExtra.includes("base64");

            let gzipReq = false;

            // Apply compression if requested and not an internal call
            if ((acceptEncoding.includes("gzip") && !isInternalCall) || acceptEncoding.includes("insomzip") || acceptExtra.includes("insomzip")) {
                gzipReq = true;
                console.log("Returning response using gzip compression...");
                // Convert body to string if it's an object
                if (typeof modifiedBody === "object") {
                    modifiedBody = JSON.stringify(modifiedBody);
                }
                console.log("modifiedBody", modifiedBody);
                // Compress the data
                const compressedData = await gzipEncode(modifiedBody);
                modifiedBody = compressedData;
                isCompressed = true;
                console.log("compressed data: ", compressedData);
                // Set Content-Encoding header
                res.set("Content-Encoding", "gzip");
                res.set("Content-Type", "application/octet-stream");

            }

            // Apply encryption if requested
            if (acceptEncryption === "aes256") {
                console.log("Returning response using AES-256 encryption. Base64 flag is: ", isBase64);

                // Ensure the body is in a string format before encryption
                if (!gzipReq) {
                    if (typeof modifiedBody === "object" || Buffer.isBuffer(modifiedBody)) {
                        modifiedBody = JSON.stringify(modifiedBody);
                    } else {
                        modifiedBody = modifiedBody.toString(); // Ensure it's a string
                    }
                }

                console.log("modifiedBody: ", modifiedBody);

                // Encrypt the data directly
                if (acceptExtra.includes("includeKey")) {
                    const { encryptedData, iv, key } = encrypt(modifiedBody, isBase64); // Pass flag for Base64 encoding
                    modifiedBody = JSON.stringify({ encryptedData, iv, key });
                } else {
                    const { encryptedData, iv } = encrypt(modifiedBody, isBase64); // Pass flag for Base64 encoding
                    modifiedBody = JSON.stringify({ encryptedData, iv });
                }

                console.log("Return payload: ", modifiedBody);
                // Set headers
                res.set("Content-Type", "application/json");
                res.set("x-encrypted", "true");
                // Remove Content-Encoding if previously set
                if (isCompressed) {
                    res.removeHeader("Content-Encoding");
                }
            }

            // Send the final modified response
            originalSend.call(this, modifiedBody);
        } catch (error) {
            console.error("Error processing response data:", error);
            res.status(500).send("Error processing response");
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
api.post('/puships', postIPSBundleUnified);
api.post('/ipsfrombeer', addIPSFromBEER);
api.post('/ipsfromcda', addIPSFromCDA);
api.post('/ipsfromhl72x', addIPSFromHL72x);
api.post('/convertmongo2beer', convertMongoToBEER);
api.post('/convertmongo2hl7', convertMongoToHL72_x);
api.post('/convertbeer2mongo', convertBEERToMongo);
api.post('/convertbeer2ips', convertBEERToIPS);
api.post('/convertips2beer', convertIPSToBEER);
api.post('/convertcdatoips', convertCDAToIPS);
api.post('/convertcdatobeer', convertCDAToBEER);
api.post('/convertcdatomongo', convertCDAToMongo);
api.post('/converthl72xtomongo', convertHL72_xToMongo);
api.post('/converthl72xtoips', convertHL72_xToIPS)
// Add a /test POST endpoint for echoing back request data
api.post('/test', (req, res) => {
    console.log("Request received at /test");

    // Respond with the raw request body
    res.send(req.body);
});


// API GET - CRUD Read
api.get("/ips/all", getAllIPS);
api.get("/ipsraw/:id", getIPSRaw);
api.get("/ipsmongo/:id", getMongoFormatted);
api.get("/ips/:id", getIPSBundle);
api.get("/ipsbasic/:id", getIPSBasic);
api.get("/ipsbeer/:id/:delim?", getIPSBEER);
api.get("/ipshl72x/:id", getIPSHL72_x);
api.get("/ipsxml/:id", getIPSXMLBundle);
api.get("/ipslegacy/:id", getIPSLegacyBundle);
api.get("/ipsunified/:id", getIPSUnifiedBundle);
api.get("/ipsbyname/:name/:given", getIPSBundleByName);
api.get("/ips/search/:name", getIPSSearch);
api.get('/fetchipsora/:name/:givenName', getORABundleByName);
api.get("/fetchips", getIPSBundleGeneric);

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
