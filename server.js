require("dotenv").config();
const express = require("express");
const axios = require('axios');
const ReadPreference = require("mongodb").ReadPreference;
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
//const xmlparser = require("express-xml-bodyparser");
//const getRawBody = require('raw-body');

// ───── Models & Controllers ─────
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
const { convertIPSToMongo } = require('./servercontrollers/convertIPSToMongo');
const { updateIPSByUUID } = require('./servercontrollers/updateIPSRecordByUUID');
const { convertCDAToIPS } = require('./servercontrollers/convertCDAToIPS');
const { convertCDAToBEER } = require('./servercontrollers/convertCDAToBEER');
const { convertCDAToMongo } = require('./servercontrollers/convertCDAToMongo');
const { convertHL72_xToMongo } = require('./servercontrollers/convertHL72_xToMongo');
const { convertHL72_xToIPS } = require("./servercontrollers/convertHL72_xToIPS");

// ----- Middleware ---------
const binaryDecryptMiddleware = require('./middlewares/binaryDecryptMiddleware');
const jsonDecryptDezipMiddleware = require('./middlewares/jsonDecryptDezipMiddleware');
const xmlMiddleware = require('./middlewares/xmlMiddleware');
const responseMiddleware = require('./middlewares/responseMiddleware');

// ───── Other ─────
const { convertXmlEndpoint } = require('./servercontrollers/convertXmlEndpoint');
const { convertFhirXmlEndpoint } = require('./servercontrollers/convertFhirXmlEndpoint');

// ───── XMPP ─────
//const { initXMPP_WebSocket } = require("./xmpp/xmppConnection");
//const xmppRoutes = require("./xmpp/xmppRoutes");

// ───── gRPC ─────

const { startGrpcServer } = require("./proto/grpcServer");

// ----- MMP ------
const pmrRoutes = require('./mmp/pmr');

// ──────── TAK ───────────────────────────
const takRoutes = require('./tak/takRoutes');

// ───────────── GraphQL Apollo ─────────────────────────────
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const typeDefs = require('./graphql/schema');
const resolvers = require('./graphql/resolvers');
const playground = require('graphql-playground-middleware-express').default;

const { DB_CONN } = process.env;

const api = express();
api.use(cors()); // enable CORS on all requests

// Load the Swagger definition
const apiDefinition = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'apidefinition.json'), 'utf-8')
);

api.use('/docs', swaggerUi.serve, swaggerUi.setup(apiDefinition));

// ──────────────────────────────────────────────────────────
//                  Logging Middleware
// ──────────────────────────────────────────────────────────
api.use((req, res, next) => {
    console.log("Incoming request:", req.method, req.url);
    console.log("Request headers:", req.headers);
    console.log("Request path:", req.path);
    next();
});

// ──────────────────────────────────────────────────────────
//   1. Raw Binary Middleware (Handles application/octet-stream)
//      Assume: [first 16 bytes: IV] + [next 16 bytes: HMAC] + [rest: encrypted & gzipped data]
// ──────────────────────────────────────────────────────────
api.use(binaryDecryptMiddleware);

// ──────────────────────────────────────────────────────────
//   2. Combined Middleware for JSON-based Decryption
//      (Headers x-encrypted=true, content-encoding=gzip/base64, etc.)
// ──────────────────────────────────────────────────────────
api.use(jsonDecryptDezipMiddleware);

// ──────────────────────────────────────────────────────────
//   3. Fallback JSON Parsing for Unencrypted Requests
// ──────────────────────────────────────────────────────────
api.use((req, res, next) => {
    if (req.headers['x-encrypted'] === 'true') {
        // Already decrypted in prior middleware
        next();
    } else {
        // Not encrypted; apply express.json()
        express.json()(req, res, next);
    }
});
api.use(express.urlencoded({ extended: false }));
api.use(express.text());

// ──────────────────────────────────────────────────────────
//   4. XML Parser for Non-/test Endpoints
// ──────────────────────────────────────────────────────────
api.use(xmlMiddleware);

// ──────────────────────────────────────────────────────────
//   5. Response Middleware for Gzip & Encryption
//      + Raw Binary Output if Accept: application/octet-stream
// ──────────────────────────────────────────────────────────
api.use(responseMiddleware);

// ──────────────────────────────────────────────────────────
//              Database Connection
// ──────────────────────────────────────────────────────────
mongoose
    .connect(DB_CONN, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("DB connection successful"))
    .catch(console.error);

// ──────────────────────────────────────────────────────────
//                 API Routes
// ──────────────────────────────────────────────────────────

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
api.post('/convertips2mongo', convertIPSToMongo);
api.post('/convertcdatoips', convertCDAToIPS);
api.post('/convertcdatobeer', convertCDAToBEER);
api.post('/convertcdatomongo', convertCDAToMongo);
api.post('/converthl72xtomongo', convertHL72_xToMongo);
api.post('/converthl72xtoips', convertHL72_xToIPS);
api.post('/convertxml', convertXmlEndpoint);
api.post('/convertfhirxml', convertFhirXmlEndpoint);

// Add a /test POST endpoint for echoing back request data
api.post('/test', (req, res) => {
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

// XMPP endpoints
//api.use("/xmpp", xmppRoutes);

// MMP endpoints
api.use('/api', pmrRoutes);

// Mount the TAK routes on the /tak path
api.use('/tak', takRoutes);

// API PUT - CRUD Update
api.put("/ips/:id", updateIPS);
api.put("/ipsuuid/:uuid", updateIPSByUUID);

// API DELETE - CRUD Delete
api.delete("/ips/:id", deleteIPS);
api.delete("/ipsdeletebypractitioner/:practitioner", deleteIPSbyPractitioner);

// GraphQL
api.get('/playground', playground({ endpoint: '/graphql' }));
async function startApolloServer() {
    const apolloServer = new ApolloServer({ typeDefs, resolvers, introspection: true, playground: true });
    await apolloServer.start();
    api.use('/graphql', express.json(), expressMiddleware(apolloServer));
}

startApolloServer();


// Static front-end
api.use(express.static(path.join(__dirname, "client", "build")));

api.get("/*", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});

// Initialize XMPP once
// initXMPP_WebSocket()
//     .then(() => {
//         console.log("XMPP connection initialized.");
//     })
//     .catch((err) => {
//         console.error("Failed to init XMPP:", err);
//     });

// Start server
// const port = process.env.PORT || 5050;
// api.listen(port, '0.0.0.0', () => {
//     console.log(`Server is running on port: ${port}`);
// });

// ─── Socket.IO ─────────────────────────────────────────────
// wrap the express app in a raw HTTP server
const port = process.env.PORT || 5050;
const httpServer = http.createServer(api);

// create the Socket.IO server and allow CORS from your front‑end origin
const io = new Server(httpServer, {
    cors: { origin: '*' }
});

// make the `io` instance available in your route handlers
api.set('io', io);

io.on('connection', (socket) => {
    console.log('⚡️  New WS client connected', socket.id);
    socket.on('disconnect', () => {
        console.log('✌️  WS client disconnected', socket.id);
    });
});

httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server + WebSocket listening on port ${port}`);
});

// Finally, start the gRPC server
startGrpcServer();
