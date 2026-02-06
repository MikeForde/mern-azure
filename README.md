# IPS MERN Project

IPS MERN is a full-stack MERN (MongoDB, Express, React, Node.js) application for **creating, transforming, securing, and exchanging International Patient Summary (IPS) data** across multiple clinical and operational formats.

The platform acts as both:
- a **clinical data management system** for IPS records, and
- a **format-translation and interchange hub** supporting modern and legacy healthcare standards.

IPS MERN supports bidirectional conversion between:
- MongoDB-native IPS records  
- IPS JSON (FHIR-aligned)
- BEER (Basic Emergency Exchange Record)
- HL7 v2.x
- CDA (XML-based)
- Unified and legacy compact schemas

Beyond traditional REST APIs, the system is designed for **field and constrained-network use cases**, supporting:
- QR code payload generation
- NFC card workflows
- gzip compression
- AES-256 encryption
- raw binary encrypted payloads (IV + MAC + compressed ciphertext)

The project is actively used to explore **interoperability between civilian healthcare systems and operational environments**, including offline exchange, tactical networks, and cross-domain data sharing.

## Table of Contents

- [Overview](#overview)
- [Core Capabilities](#core-capabilities)
- [Data Formats & Interoperability](#data-formats--interoperability)
- [Security & Transport Options](#security--transport-options)
- [System Architecture](#system-architecture)
- [Setup](#setup)
- [API Documentation](#api-documentation)
  - [POST Endpoints](#post-endpoints)
  - [GET Endpoints](#get-endpoints)
  - [PUT Endpoints](#put-endpoints)
  - [DELETE Endpoints](#delete-endpoints)
- [Compression Support (gzip)](#gzip-support)
- [Encryption Support (AES-256)](#aes-256-encryption-support)
- [Raw Binary Payloads](#raw-binary-format-iv--mac--gzipped-data)
- [Client-Side Pages](#client-side-pages)
- [Technologies Used](#technologies-used)
- [Contributing](#contributing)
- [License](#license)

## Overview

IPS MERN is designed as an **interoperability and exchange layer** for International Patient Summary (IPS) data rather than a single-format clinical database.

At its core, the system stores IPS records in a MongoDB-friendly representation, while providing deterministic, reversible transformations into multiple healthcare and operational formats. This allows the same clinical data to be:

- edited and curated in a modern web interface,
- exchanged with external clinical systems,
- embedded into constrained transport mechanisms (QR, NFC),
- and securely transmitted across low-bandwidth or disconnected environments.

The backend exposes a comprehensive REST API that supports CRUD operations, format conversion, compression, and encryption. The frontend provides tooling for clinicians, developers, and integrators to inspect, transform, export, and exchange IPS data without needing to manually manipulate schemas or payload formats.

IPS MERN is intentionally **format-agnostic and transport-agnostic**:
- formats (FHIR IPS, BEER, HL7 2.x, CDA, unified schemas) are treated as interchangeable views of the same underlying clinical facts;
- transport mechanisms (JSON over HTTP, gzip-compressed payloads, encrypted binary streams, QR codes, NFC cards) are treated as interchangeable delivery channels.

This design makes the platform suitable for both conventional healthcare IT environments and more constrained or operational contexts where connectivity, bandwidth, or system compatibility cannot be assumed.

## Core Capabilities

### IPS Record Management
- Create, read, update, and delete IPS records stored in MongoDB.
- Support for record access by internal ID, UUID, and patient demographics.
- Separation between storage format and presentation / exchange formats.

### Multi-Format Conversion
- Bidirectional conversion between:
  - MongoDB IPS representation
  - IPS JSON (FHIR-aligned bundles)
  - BEER (Basic Emergency Exchange Record)
  - HL7 v2.x
  - CDA (XML)
  - Unified and legacy compact schemas
- Deterministic transformations to ensure repeatable, auditable results.
- Ability to generate multiple output formats from a single source record.

### Secure Data Transport
- AES-256 encryption for both request and response payloads.
- Support for:
  - JSON-wrapped encrypted payloads (hex or base64 encoded)
  - Raw binary encrypted streams using IV + MAC + gzipped ciphertext
- Optional gzip compression for bandwidth efficiency.
- Designed to support offline, store-and-forward, and constrained-network scenarios.

### Interchange & Distribution
- REST API endpoints for integration with external systems.
- QR code generation for rapid, camera-based data transfer.
- NFC-friendly payload generation for smart cards and physical tokens.
- Bulk ingestion workflows for structured external data sources.

### Inspection & Tooling
- Frontend tooling to:
  - view and compare different format representations of the same record,
  - download converted payloads,
  - test encryption and compression options,
  - exercise API endpoints interactively.
- Designed to support both clinical users and technical integrators.

### Extensible Architecture
- New formats, transports, and security options can be added without changing the core data model.
- Clear separation between:
  - data storage,
  - format transformation,
  - transport encoding,
  - and client presentation.

## Data Formats & Interoperability

IPS MERN treats data formats as **interchangeable representations of the same clinical intent**, rather than as competing standards. Each supported format exists to solve a different interoperability problem, and the platform is designed to bridge between them in a predictable and auditable way.

### FHIR IPS (JSON)
FHIR-aligned IPS JSON is used as the **canonical exchange format** within the system.

- Human-readable and machine-processable.
- Well-suited to modern REST APIs and web-based systems.
- Compatible with validation, schema inspection, and fine-grained field access.
- Acts as a stable pivot format for conversion to and from other representations.

FHIR IPS is typically used when:
- integrating with modern healthcare platforms,
- exposing structured APIs,
- or generating QR / NFC payloads where schema clarity matters.

### BEER (Basic Emergency Exchange Record)
BEER is a **compact, line-oriented format** optimised for rapid exchange and minimal parsing requirements.

- Designed for constrained environments and emergency use.
- Extremely compact compared to JSON or XML.
- Resilient to partial transmission and tolerant of simple transport mechanisms.
- Well suited to QR codes, NFC storage, and low-bandwidth links.

Within IPS MERN, BEER is treated as a **loss-aware but operationally efficient view** of the IPS dataset, allowing critical information to be exchanged even when full fidelity formats are impractical.

### HL7 v2.x
HL7 v2.x remains widely deployed in legacy and transitional healthcare systems.

- Message-oriented and delimiter-based.
- Often required for integration with existing hospital and laboratory systems.
- Less expressive than FHIR, but operationally ubiquitous.

IPS MERN supports HL7 v2.x primarily as an **interoperability bridge**, allowing IPS data to be injected into or extracted from environments that cannot consume FHIR directly.

### CDA (Clinical Document Architecture)
CDA provides a **document-centric XML representation** of clinical data.

- Common in document-based exchange workflows.
- Often used for archival, regulatory, or cross-organisational sharing.
- Structured but less granular than FHIR.

CDA support enables IPS MERN to ingest and export IPS content from document-based systems, while still allowing the underlying data to be transformed into more operationally flexible formats.

### Unified and Legacy Schemas
In addition to formal standards, IPS MERN supports:
- compact unified schemas for efficient downstream processing,
- legacy formats required for backwards compatibility.

These schemas are treated as **derived views**, not primary data sources, ensuring the underlying clinical meaning remains consistent across representations.

## Security & Transport Options

IPS MERN deliberately supports **multiple security and transport models**, reflecting the reality that IPS data must travel across environments with very different constraints, threat models, and tooling.

Rather than enforcing a single approach, the platform allows the same data to be secured and transported in different ways depending on context.

### JSON-Based Encrypted Transport
JSON-wrapped encryption is provided for compatibility with conventional web systems.

- AES-256 encryption with explicit IV handling.
- Encrypted payloads carried as structured JSON.
- Hex or Base64 encoding supported for interoperability.
- Easy to inspect, log (at boundaries), and integrate with HTTP-based tooling.

This approach is well suited to:
- browser-based clients,
- API gateways,
- debugging and development environments,
- and systems where payload transparency and tooling support are important.

### Raw Binary Encrypted Transport
For constrained or operational environments, IPS MERN supports **raw binary encrypted payloads**.

A single binary stream contains:
- a fixed-length IV,
- a cryptographic MAC for integrity,
- and gzipped, AES-encrypted data.

This model:
- minimises overhead,
- avoids JSON framing costs,
- reduces payload size,
- and aligns well with QR, NFC, file-based, or store-and-forward transports.

Binary payloads are particularly useful where:
- bandwidth is limited,
- message size must be tightly controlled,
- or the transport medium is not JSON-aware.

### Compression as a First-Class Concern
Gzip compression is supported independently of encryption and format.

- Can be applied to plaintext or encrypted data.
- Significantly reduces payload size for verbose formats.
- Especially valuable for QR codes, NFC storage, and low-throughput links.

### Design Rationale
Supporting both JSON and raw binary transports is intentional:

- JSON provides **clarity, accessibility, and ecosystem compatibility**.
- Raw binary provides **efficiency, robustness, and transport neutrality**.

By separating:
- data content,
- format representation,
- encryption,
- and transport encoding,

IPS MERN allows the same clinical information to move safely and efficiently across environments that would otherwise be incompatible.

## System Architecture

IPS MERN is structured as a **layered, transformation-centric architecture**, where data storage, format representation, security, and transport are deliberately separated.

Rather than treating IPS data as a single schema tied to a single protocol, the system is built around the idea that **the same clinical facts must safely exist in multiple representations at different points in their lifecycle**.

### High-Level Architecture

At a conceptual level, the platform consists of five primary layers:

1. **Storage Layer**
2. **Transformation Layer**
3. **Security & Encoding Layer**
4. **Transport Layer**
5. **Client & Integration Layer**

Each layer can evolve independently, allowing new formats, transports, or security mechanisms to be added without destabilising the system.

---

### 1. Storage Layer

The storage layer uses MongoDB as the system of record.

- Stores IPS data in a MongoDB-friendly representation.
- Optimised for querying, partial updates, and indexing.
- Decoupled from any single exchange or presentation format.
- Acts as the authoritative source for all derived representations.

This ensures that transformations are **repeatable and reversible**, and that no exchange format becomes the “truth” by accident.

---

### 2. Transformation Layer

The transformation layer is responsible for converting IPS data between formats.

- Converts between MongoDB representation, FHIR IPS, BEER, HL7 v2.x, CDA, and unified schemas.
- Designed to be deterministic and auditable.
- Handles structural reshaping, field mapping, and normalisation.
- Supports both lossy and loss-aware transformations where required.

By isolating transformation logic, the system avoids format-specific coupling throughout the rest of the codebase.

---

### 3. Security & Encoding Layer

Security and encoding are applied **after** transformation, not baked into the data model.

This layer provides:
- AES-256 encryption
- HMAC / MAC integrity protection
- Gzip compression
- JSON or raw binary encoding

By keeping this layer separate:
- the same IPS data can be encrypted differently depending on context,
- payload size can be optimised without affecting content,
- and security mechanisms can evolve independently of formats.

---

### 4. Transport Layer

The transport layer governs how data is actually delivered.

Supported transports include:
- JSON over HTTP(S)
- Gzip-compressed HTTP payloads
- Raw binary streams (`application/octet-stream`)
- QR code payloads
- NFC-compatible binary blobs

Each transport consumes the output of the security and encoding layer, ensuring consistent behaviour regardless of delivery mechanism.

---

### 5. Client & Integration Layer

The client layer includes both human-facing and system-to-system interfaces.

- React frontend for inspection, editing, and conversion.
- REST APIs for programmatic access.
- Tooling for testing encryption, compression, and format output.
- Integration points for external systems and services.

This layer is intentionally thin, delegating all format, security, and transport logic to lower layers.

---

### Architectural Principles

IPS MERN is guided by a small number of explicit principles:

- **Separation of concerns**  
  Storage, transformation, security, and transport are isolated.

- **Format neutrality**  
  No single exchange format is privileged as “the truth”.

- **Transport independence**  
  Data can move via APIs, files, QR codes, or NFC without redesign.

- **Operational realism**  
  The system assumes constrained, offline, or hostile environments exist.

- **Extensibility over completeness**  
  New formats and transports can be added incrementally.


## Setup

### Prerequisites

- [Node.js](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ips-mern-project.git
   cd ips-mern-project
   ```
2. Install server dependencies:
```bash
cd server
npm install
```
3. Install client dependencies:
```bash
cd ../client
npm install
```
4. Set up environment variables:

Create a .env file in the server directory with the following content:
```
DB_CONN=mongodb://localhost:27017/ipsDB
```
5. Start the development server:
```bash
cd ../server
npm run dev
```
6. Start the React development server:
```bash
cd ../client
npm start
```
## API Documentation

### POST Endpoints

| Endpoint                        | Description                                         | Request Body                                                                                                    | Response                             |
|---------------------------------|-----------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|--------------------------------------|
| `/ips`                          | Add a new IPS record.                                | MongoDb IPS Record | The created IPS record.             |
| `/ipsmany`                      | Add multiple IPS records.                           | Multiple MongoDb IPS Records | Array of created IPS records.        |
| `/ipsbundle`                    | Add IPS records from a bundle.                      | IPS JSON Bundle | The created IPS record.              |
| `/pushipsora`                   | Push IPS records to an ORA system.                  | IPS JSON Bundle | Response from the ORA system.                      |
| `/pushipsnld`                   | Push IPS records to an ORA system.                  | IPS JSON Bundle | Response from the NLD system.                      |
| `/ipsfrombeer`                  | Add IPS records from BEER format.                   | BEER as Plain Text  | The created IPS record.              |
| `/ipsfromcda`                  | Add IPS records from CDA XML format.                   | CDA as XML  | The created IPS record.              |
| `/ipsfromhl72x`                  | Add IPS records from HL7 2.x format.                   | HL7 2.x as Plain Text  | The created IPS record.              |
| `/convertmongo2beer`            | Convert a MongoDB IPS record to BEER format.        | Mongo IPS Record | The BEER formatted data.             |
| `/convertmongo2hl7`             | Convert a MongoDB IPS record to HL7 2.3 format.     | Mongo IPS Record | The HL7 2.3 formatted data.          |
| `/convertbeer2mongo`            | Convert a BEER IPS record to MongoDB format.        | BEER as Plain Text  | MongoDB formatted data.              |
| `/convertbeer2ips`              | Convert a BEER IPS record to IPS JSON format.       | BEER as Plain Text | IPS JSON formatted data.             |
| `/convertips2beer`              | Convert an IPS JSON record to BEER format.          | IPS JSON Bundle | BEER formatted data.                 |
| `/convertcdatoips`              | Convert CDA XML format to IPS JSON Bundle.          | CDA XML Bundle | IPS JSON formatted data.             |
| `/convertcdatobeer`             | Convert CDA XML format to BEER format.              | CDA XML Bundle | BEER formatted data.                 |
| `/convertcdatomongo`             | Convert CDA XML format to MongoDb format.              | CDA XML Bundle | MongoDb - JSON                 |
| `/converthl72xtomongo`          | Convert HL7 2.x format to MongoDB format.           | HL7 2.x - Plain Text | MongoDB - JSON                       |
| `/converthl72xtoips`            | Convert HL7 2.x format to IPS JSON format.          | HL7 2.x - Plain Text | IPS Bundle - JSON                    |
| `/convertxml`            | Generic convert XML format to JSON format.          | XML | JSON                    |
| `/convertfhirxml`            | Convert FHiR XML format to FHiR JSON format.          | FHiR XML | FHiR JSON                    |

### GET Endpoints

| Endpoint                        | Description                                         | Response                              |
|---------------------------------|-----------------------------------------------------|---------------------------------------|
| `/ips/all`                      | Retrieve all IPS records.                           | Array of MongoDb IPS records.                 |
| `/ipsraw/:id`                   | Retrieve IPS record in default MongoDb format by ID.            | Default MongoDb IPS data.                         |
| `/ipsmongo/:id`                 | Retrieve IPS record in presentation format by ID.        | Presentation formatted IPS data.           |
| `/ips/:id`                      | Retrieve Expanded IPS JSON Bundle by its ID.                 | The Expanded IPS JSON Bundle format.           |
| `/ipsbasic/:id`                 | Retrieve basic IPS Bundle by ID.                    | Basic IPS data.                       |
| `/ipsbeer/:id/:delim?`          | Retrieve IPS Bundle in BEER format by ID.           | BEER formatted IPS data.              |
| `/ipshl72x/:id`          | Retrieve IPS Bundle in HL7 2.3 format by ID.           | HL7 2.3 formatted IPS data.              |
| `/ipsxml/:id`                   | Retrieve IPS Bundle in Expanded XML format by ID.            | Expanded XML formatted IPS data.               |
| `/ipslegacy/:id`                | Retrieve IPS Bundle in legacy format by ID.         | Legacy JSON formatted IPS data.       |
| `/ipsunified/:id`                | Retrieve IPS Bundle in compact unified format by ID.         | Compact unified JSON formatted IPS data.       |
| `/ipsbyname/:name/:given`       | Retrieve Expanded IPS Bundle by patient's name and given name. | The Expanded IPS JSON Bundle.                  |
| `/ips/search/:name`             | Search for IPS records by patient's name.           | Array of IPS records.                 |
| `/fetchipsora/:name/:givenName` | Fetch IPS record from ORA by patient's name and given name. | The IPS JSON Bundle.               |

### PUT Endpoints

| Endpoint                        | Description                                         | Request Body                                                                                                     | Response                             |
|---------------------------------|-----------------------------------------------------|------------------------------------------------------------------------------------------------------------------|--------------------------------------|
| `/ips/:id`                      | Update an existing IPS record by its ID.            | MongoDb IPS Record - complete or partial| The updated IPS record.              |
| `/ipsuuid/:uuid`                | Update an existing IPS record by its UUID.          | MongoDb IPS Record - complete or partial  | The updated IPS record.              |

### DELETE Endpoints

| Endpoint                        | Description                                         | Response                              |
|---------------------------------|-----------------------------------------------------|---------------------------------------|
| `/ips/:id`                      | Delete an IPS record by its ID.                     | Status message.                       |

## Gzip Support

### Overview

This API supports gzip compression to optimize data transfer. 

- **Incoming Requests**: When sending gzip-encoded data, set the `Content-Encoding: gzip` header.
- **Outgoing Responses**: To receive gzip-encoded responses, set the `Accept-Encoding: gzip` header.

### Usage Instructions

#### For Requests

1. Compress your payload using gzip.
2. Include the header `Content-Encoding: gzip`.
3. Send the compressed payload.

#### For Responses

1. Set the header `Accept-Encoding: gzip`.
2. The API will return the response in gzip format if supported.

### Example

**Request Headers for Gzip**

```http
Content-Type: application/json
Content-Encoding: gzip
```

**Response Headers for Gzip**

```http
Content-Type: application/json
Content-Encoding: gzip
```

# AES-256 Encryption Support

## Overview

This API supports AES-256 encryption for secure data transfer.

- **Incoming Requests**: To send encrypted data, include the `x-encrypted: true` header and provide an encrypted payload.
- **Outgoing Responses**: To receive encrypted responses, include the `Accept-Encryption: aes256` header in your request.

## Base64 Encoding Option

To facilitate compatibility and efficient data transfer, the API supports returning encrypted data encoded in Base64 format. 

- **Incoming Requests**: To send in base64 format, include the header `Content-Encoding: base64` with the encrypted payload. Make sure both the data and the iv are in base64 not hex.
- **Outgoing Responses**: Use the header `Accept-Encoding: base64` The encrypted payload and IV will be returned as Base64-encoded strings.

## Usage Instructions

### For Requests

1. Encrypt your payload using AES-256 encryption with the provided key and IV.
2. Include the `x-encrypted: true` header.
3. Send the encrypted payload in the request body as a JSON with the elements: encryptedData and iv. 
4. Default format is hex strings for both elements. If you wish to send as base64 strings then use the `Content-Encoding: base64`.

### For Responses

1. Include the `Accept-Encryption: aes256` header in your request.
2. Optionally, include the `Accept-Encoding: base64` header to receive the encrypted data and iv encoded in Base64.
3. The response will be a JSON with two elements: encryptedData and iv.

## Raw Binary Format (IV + MAC + Gzipped Data) 
his API also supports sending and receiving raw binary data via application/octet-stream. This is useful when you want a single binary payload that includes:
1. A 16-byte IV (initialization vector).
2. A 16-byte MAC (HMAC-SHA256 for integrity).
3. The encrypted + gzipped data. + +### Incoming Requests (Raw Binary)

## Usage Instructions

### For Requests
1. Set the header: `Content-Type: application/octet-stream`
2. The first 16 bytes of your binary payload must be the IV, the next 16 bytes must be the MAC, and the remainder is the AES-256-CBC-encrypted, gzip-compressed data. 
3. The server will:
  - Verify the MAC to check integrity.
  - Decrypt the payload using AES-256-CBC.
  - Decompress the result from gzip.

### Responses (Raw Binary)
1. Send a request with: `Accept: application/octet-stream`
2. The server will:
  - Take the plaintext response body.
  - Compress it with gzip.
  - Encrypt it using AES-256-CBC.
  - Compute the MAC for integrity.
  - Return a binary payload consisting of [16-byte IV] + [32-byte MAC] + [Encrypted Gzipped Data]
3. The response will have: 
- Content-Type: `application/octet-stream`
- X-Encrypted: true

## Client-Side Pages

| Page                   | Description                                                                                           |
|------------------------|-------------------------------------------------------------------------------------------------------|
| **Records (Default)**. | Create, edit, search, and manage IPS records stored in MongoDB.                                       |
| **Record Viewer**      | Inspect a single IPS record in multiple representations (expanded, compact, unified, legacy).         |
| **API Explorer**       | Interactive interface for exercising API endpoints and downloading responses.                         |
| **Format Conversion**. | Convert IPS records between FHIR IPS, BEER, HL7 v2.x, CDA, and unified schemas.                       |
| **QR Tools**           | Generate QR codes for IPS payloads in multiple formats.                                               |
| **Encrypt & Compress** | Apply gzip compression and AES-256 encryption to generated payloads.                                  |
| **DMICP / Bulk Upload**| Bulk ingestion of IPS records produced from structured external sources.                              |
| **External Systems**   | Fetch from and push IPS data to external IPS-compatible services.                                     |
| **NPS Schema pages**   | NPS Schema definition browser and validator.                                                          |
| **About & Docs**       | Project information, ChangeLog, and API documentation.                                                |

### Detailed Descriptions

1. **Default Page**
   - **Purpose:** Central page for managing IPS records. Users can add new records, edit existing records, and perform searches.
   - **Features:** 
     - Search for records directly from the page.
     - Perform CRUD operations on IPS records.

2. **API Page**
   - **Purpose:** Provides an interface for interacting with API GET endpoints.
   - **Features:** 
     - View available API endpoints.
     - Execute API calls and display the response.
     - Download the response data.
     - Includes the ability to encrypt and compress the response - base64

3. **QR Page**
   - **Purpose:** Generate and download QR codes for IPS records.
   - **Features:** 
     - Create QR codes in various formats including IPS JSON and BEER.
     - Download the generated QR codes.
     - Includes the ability to encrypt and compress the response - base64

4. **DMICP Page**
   - **Purpose:** Facilitates the bulk upload of IPS records in the SmartDoc format.
   - **Features:** 
     - Upload multiple IPS records simultaneously.
     - Supports the SmartDoc format for bulk data entry.

5. **External API Pages**
   - **Purpose:** Manage interactions with external IPS webApps/servers.
   - **Features:** 
     - GET and POST IPS records between pre-defined endpoints (or manually entered) and the IPS MERN WebApp.

6. **About Pages**
   - **Purpose:** Provide detailed information about the IPS system and the WebApp.
   - **Features:** 
     - Overview of IPS.
     - Information about the WebApp.
     - View the ChangeLog for recent updates.
     - Access the API Documentation page.

Each page in the application is designed to provide specific functionalities for managing and interacting with IPS records, ensuring a comprehensive and user-friendly experience.


## Technologies Used
Frontend: React, React Bootstrap
Backend: Node.js, Express
Database: MongoDB
Other: Axios for HTTP requests, Mongoose for MongoDB interaction


## Contributing
Contributions are welcome! Please read our contributing guidelines before you submit a pull request.


## License
This project is licensed under the MIT License. See the LICENSE file for details.





