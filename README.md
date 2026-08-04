# IPS MERN Project

IPS MERN is a full-stack MERN application for creating, transforming, validating, securing, and exchanging International Patient Summary (IPS) data across multiple healthcare and operational formats.

It supports:
- MongoDB-backed IPS record management
- FHIR-based bundle generation in multiple flavours
- conversion to and from BEER, HL7 2.x, CDA XML, and JSON views
- schema and profile validation
- gzip, AES-256, Base64, and raw binary transport modes
- QR, animated dual-QR, NFC, XMPP, TAK, and MMP/PMR workflows

## Overview

The platform acts as both:
- a clinical record management and transformation system
- an interoperability hub for IPS-related exchange scenarios

The backend exposes REST, Swagger, GraphQL, validation, and integration endpoints. The frontend provides tooling for record editing, payload inspection, schema viewing, validation, QR/NFC workflows, and external exchange experiments.

## Current Capabilities

### Record Management
- Create, read, update, delete, search, and upsert IPS records in MongoDB.
- Access records by MongoDB `_id`, `packageUUID`, and name-based search.
- Real-time frontend refresh using Socket.IO when records are created or updated.

### Bundle and Format Generation
- Expanded IPS FHIR JSON: `/ips/:id`
- NHS SCR-aligned IPS FHIR JSON: `/ipsnhsscr/:id`
- European Patient Summary (EPS) FHIR JSON: `/ipseps/:id`
- NPS unified bundle: `/nps/:id`
- NPS profile/FHIR-server-friendly bundle: `/npsprofile/:id`
- XML, BEER, HL7 2.3, human-readable text, legacy, unified split, and NFC split variants

### Validation
- NPS unified schema validation: `/ipsUniVal` and alias `/npsVal`
- NPS profile validation with FHIR R4 checks: `/npsProfileVal`
- NHS SCR validation with FHIR R4 checks: `/ipsNhsScrVal`
- EPS validation: `/epsVal`
- Frontend schema viewers and validator modes for NPS, NPS Profile, NHS SCR, EPS, and NPS NFC split workflows

### Exchange and Transport
- Standard JSON over HTTP
- gzip-compressed requests and responses
- AES-256 encrypted JSON payloads with IV and MAC/HMAC
- Base64-encoded encrypted payloads
- raw binary `application/octet-stream` payloads using IV + MAC + gzipped encrypted body
- QR code and animated dual-QR transfer
- NFC read/write including plain text, encrypted binary, gzip-only binary, and gzipped URL payloads

### Integration Features
- External IPS fetch/push flows
- SNOMED GPS semantic lookup and picklists
- XMPP messaging endpoints
- TAK integration endpoints
- MMP/PMR messaging support
- Swagger UI and GraphQL playground

## Supported Data Views

- MongoDB IPS record
- Expanded IPS FHIR JSON
- NPS unified JSON
- NPS profile JSON
- NHS SCR-aligned FHIR JSON
- EPS-aligned FHIR JSON
- Legacy FHIR JSON view
- FHIR XML
- CDA XML ingest and conversion
- HL7 2.3 plain text
- BEER plain text
- Human-readable plain text

Clinical coverage in the current model includes:
- Patient
- Organization
- Medication / MedicationRequest / MedicationStatement
- AllergyIntolerance
- Condition
- Observation
- Procedure
- Immunization
- Coverage
- Composition and Bundle structures where required by the target flavour

## Setup

### Prerequisites

- Node.js
- MongoDB
- npm

### Installation

1. Clone the repository.
2. Install backend dependencies from the project root:

```bash
npm install
```

3. Install frontend dependencies:

```bash
npm install --prefix client
```

4. Create a root-level `.env` file with at least:

```env
DB_CONN=mongodb://localhost:27017/ipsDB
```

5. Start the backend and frontend together:

```bash
npm run dev
```

Useful scripts:
- `npm run server` starts the backend with nodemon
- `npm run client` starts the React frontend
- `npm test` runs Jest tests

## Developer Docs

- Swagger UI: `/docs`
- GraphQL endpoint: `/graphql`
- GraphQL Playground: `/playground`
- In-app API docs page: `client/src/pages/APIDocumentationPage.js`
- In-app changelog page: `client/src/pages/ChangelogPage.js`

## API Summary

The tables below focus on the main documented endpoints. For interactive testing and the broader live surface, use `/docs`.

### Core POST Endpoints

| Endpoint | Description |
|---|---|
| `/ips` | Create a new IPS record from MongoDB-style JSON input. |
| `/ipsmany` | Create multiple IPS records. |
| `/ipsbundle` | Ingest an IPS bundle and create/update a record. |
| `/pushipsora` | Push IPS JSON to an external ORA system. |
| `/pushipsnld` | Push IPS JSON to an external NLD system. |
| `/ipsfrombeer` | Create a record from BEER text. |
| `/ipsfromcda` | Create a record from CDA XML. |
| `/ipsfromhl72x` | Create a record from HL7 2.x text. |
| `/convertmongo2beer` | Convert MongoDB JSON to BEER. |
| `/convertmongo2hl7` | Convert MongoDB JSON to HL7 2.3. |
| `/convertbeer2mongo` | Convert BEER to MongoDB JSON. |
| `/convertbeer2ips` | Convert BEER to IPS/NPS JSON. |
| `/convertips2beer` | Convert IPS JSON to BEER. |
| `/convertips2plaintext` | Convert IPS JSON to human-readable plain text. |
| `/convertcdatoips` | Convert CDA XML to IPS/NPS JSON. |
| `/convertcdatobeer` | Convert CDA XML to BEER. |
| `/convertcdatomongo` | Convert CDA XML to MongoDB JSON. |
| `/converthl72xtomongo` | Convert HL7 2.x to MongoDB JSON. |
| `/converthl72xtoips` | Convert HL7 2.x to IPS/NPS JSON. |
| `/convertxml` | Generic XML to JSON conversion. |
| `/convertfhirxml` | FHIR XML to FHIR JSON conversion. |
| `/npsVal` | Validate NPS unified JSON against schema rules. |
| `/npsProfileVal` | Validate NPS profile JSON against profile rules plus FHIR R4 checks. |
| `/ipsNhsScrVal` | Validate NHS SCR IPS JSON. |
| `/epsVal` | Validate EPS IPS JSON. |
| `/test` | Echo/test endpoint used for encryption, compression, and binary workflow testing. |

### Core GET Endpoints

| Endpoint | Description |
|---|---|
| `/ips/all` | Retrieve all IPS records. |
| `/ips/list` | Retrieve lightweight IPS list data for selection workflows. |
| `/ipsraw/:id` | Retrieve raw stored IPS record JSON. |
| `/ipsmongo/:id` | Retrieve MongoDB presentation JSON. |
| `/ips/:id?narrative=1&resourceNarrative=1` | Retrieve expanded IPS FHIR JSON, optionally with generated narratives. |
| `/ipsnhsscr/:id?narrative=1&resourceNarrative=1` | Retrieve NHS SCR-aligned FHIR JSON. |
| `/ipseps/:id?narrative=1&resourceNarrative=1` | Retrieve EPS-aligned FHIR JSON. |
| `/ipsbasic/:id` | Retrieve basic plain-text output. |
| `/ipsplaintext/:id` | Retrieve human-readable plain-text output. |
| `/ipsbeer/:id/:delim?` | Retrieve BEER with optional delimiter mode. |
| `/ipshl72x/:id` | Retrieve HL7 2.3 output. |
| `/ipsxml/:id` | Retrieve FHIR XML output. |
| `/ipslegacy/:id` | Retrieve legacy FHIR JSON output. |
| `/ipsunified/:id` | Retrieve compact unified JSON output. |
| `/nps/:id` | Retrieve NPS unified FHIR JSON. |
| `/npsprofile/:id` | Retrieve NPS profile/FHIR-server-compliant JSON. |
| `/npsnfc/:id` | Retrieve NPS split bundle for NFC proof-of-concept workflows. |
| `/ipsdatasplitpoc/:id` | Retrieve bespoke RO/RW split payload bundle for NFC proof-of-concept workflows. |
| `/ipsbyname/:name/:given` | Retrieve an IPS bundle by patient name. |
| `/ips/search/:name` | Search IPS records by patient name. |
| `/fetchipsora/:name/:givenName` | Fetch IPS data from an external ORA system. |

### Core PUT and DELETE

| Endpoint | Description |
|---|---|
| `/ips/:id` | Update an IPS record by id. |
| `/ipsuuid/:uuid` | Update an IPS record by UUID/packageUUID. |
| `/ips/:id` | Delete an IPS record by id. |

### SNOMED GPS Endpoints

| Endpoint | Description |
|---|---|
| `/snomedgps/tags` | List semantic tags available in the SNOMED GPS data set. |
| `/snomedgps/code/:code` | Retrieve a SNOMED GPS concept by code. |
| `/snomedgps/picklist/:tag?limit=100` | Retrieve filtered picklists by tag or semantic grouping. |
| `/snomedgps/search?q=term&tag=disorder&limit=25` | Free-text SNOMED GPS search with optional filtering. |

### XMPP Endpoints

| Endpoint | Description |
|---|---|
| `/xmpp/test-send-message` | Send a test message to the configured XMPP group chat. |
| `/xmpp/xmpp-post` | Post a message to XMPP, optionally to a custom room. |
| `/xmpp/xmpp-ips` | Fetch an IPS record and broadcast it to XMPP. |
| `/xmpp/xmpp-ips-private` | Fetch an IPS record and send it privately to a specific occupant. |

### TAK Endpoints

| Endpoint | Description |
|---|---|
| `/tak/test` | Send a test CoT message. |
| `/tak/ips` | Resolve an IPS record, compress and encode it, and embed it in CoT. |
| `/tak/browser/:id` | Render an IPS record as browser-friendly HTML for TAK-related workflows. |

## Narrative Flags

The following GET endpoints support optional narrative generation flags:
- `/ips/:id`
- `/ipsnhsscr/:id`
- `/ipseps/:id`

Supported query parameters:
- `?narrative=1` includes section narratives in `Composition.section[].text`
- `&resourceNarrative=1` includes resource narratives in `Bundle.entry[].resource.text`

## Encryption and Encoding

### Gzip
- Incoming: set `Content-Encoding: gzip`
- Outgoing: set `Accept-Encoding: gzip`

### AES-256 Encrypted JSON
- Incoming: set `X-Encrypted: true`
- Default encrypted fields are hex: `encryptedData`, `iv`, `mac`
- For Base64 input, include `Content-Encoding: base64`
- For encrypted responses, include `Accept-Encryption: aes256`
- For Base64 encrypted responses, include `Accept-Encoding: base64`

### Combined Gzip + AES-256
- Incoming: gzip first, then encrypt
- Use `Content-Encoding: gzip` and `X-Encrypted: true`
- Base64 variant may use `Content-Encoding: gzip, base64`
- Outgoing: use `Accept-Encoding: gzip` and `Accept-Encryption: aes256`

### Raw Binary Payloads
- Content type: `application/octet-stream`
- Request format: `[16-byte IV] + [16-byte MAC] + [gzipped encrypted payload]`
- Response format: `[16-byte IV] + [16-byte MAC] + [gzipped encrypted payload]`
- Response headers include `Content-Type: application/octet-stream` and `X-Encrypted: true`

## Frontend Tooling

The frontend includes pages and workflows for:
- record creation, editing, search, and viewing
- API exploration and payload download
- QR generation, animated QR generation, and animated QR reading
- NFC reading and writing, including compressed and encrypted payload modes
- BEER conversion workflows
- schema viewing and validation for NPS, NPS Profile, NHS SCR, EPS, and split NFC payloads
- PDF/report-style viewing and export
- changelog and API documentation pages
- JWE field-encryption demos
- external integration experiments including TAK and XMPP-related flows

## Technologies Used

- Frontend: React, React Bootstrap
- Backend: Node.js, Express
- Database: MongoDB, Mongoose
- Validation: AJV, FHIR R4 JSON Schema, profile-driven validation
- Messaging and transport: Socket.IO, XMPP, TAK integration, Swagger, GraphQL

## Notes

- The README summarizes the main current surface area, but `/docs` is the best source for interactive REST endpoint discovery.
- The in-app changelog documents the feature evolution in more detail than this file.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
