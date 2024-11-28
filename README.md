# IPS MERN Project

This project is a MERN (MongoDB, Express, React, Node.js) stack application designed to manage and manipulate IPS (International Patient Summary) records. It includes features to convert between MongoDB, BEER, and IPS JSON formats, and supports various CRUD operations on IPS data.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Setup](#setup)
- [API Documentation](#api-documentation)
  - [POST Endpoints](#post-endpoints)
  - [GET Endpoints](#get-endpoints)
  - [PUT Endpoints](#put-endpoints)
  - [DELETE Endpoints](#delete-endpoints)
- [Gzip Support](#gzip-support)
- [AES-256 Support](#aes-256-encryption-support)
- [Client-Side Pages](#client-side-pages)
- [Technologies Used](#technologies-used)
- [Contributing](#contributing)
- [License](#license)

## Overview

This application allows healthcare providers to create, update, delete, and convert patient records stored in MongoDB. The records can be converted into different formats, including BEER (Basic Emergency Exchange Record) and IPS JSON, to facilitate data sharing and interoperability.

## Features

- **CRUD Operations**: Create, Read, Update, Delete IPS records.
- **Format Conversion**: Convert IPS records between MongoDB, BEER, and IPS JSON formats.
- **API Endpoints**: Comprehensive set of endpoints to manage IPS records.
- **Responsive Frontend**: User-friendly interface for managing and converting records.
- **Search and Filter**: Find records by various attributes.

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
| `/pushipsora`                   | Push IPS records to an ORA system.                  | IPS JSON Bundle | Status message.                      |
| `/ipsfrombeer`                  | Add IPS records from BEER format.                   | BEER as Plain Text  | The created IPS record.              |
| `/convertmongo2beer`            | Convert a MongoDB IPS record to BEER format.        | Mongo IPS Record | The BEER formatted data.             |
| `/convertmongo2hl7`             | Convert a MongoDB IPS record to HL7 2.8 format.     | Mongo IPS Record | The HL7 2.8 formatted data.          |
| `/convertbeer2mongo`            | Convert a BEER IPS record to MongoDB format.        | BEER as Plain Text  | MongoDB formatted data.              |
| `/convertbeer2ips`              | Convert a BEER IPS record to IPS JSON format.       | BEER as Plain Text | IPS JSON formatted data.             |
| `/convertips2beer`              | Convert an IPS JSON record to BEER format.          | IPS JSON Bundle | BEER formatted data.                 |
| `/ipsfromcda`                   | Add IPS records from a CDA XML format.              | CDA XML Bundle | The created IPS record.              |
| `/convertcdatoips`              | Convert CDA XML format to IPS JSON Bundle.          | CDA XML Bundle | IPS JSON formatted data.             |
| `/convertcdatobeer`             | Convert CDA XML format to BEER format.              | CDA XML Bundle | BEER formatted data.                 |
| `/converthl728tomongo`          | Convert HL7 2.8 format to MongoDB format.           | HL7 2.8 - Plain Text | MongoDB - JSON                       |
| `/converthl728toips`            | Convert HL7 2.8 format to IPS JSON format.          | HL7 2.8 - Plain Text | IPS Bundle - JSON                    |

### GET Endpoints

| Endpoint                        | Description                                         | Response                              |
|---------------------------------|-----------------------------------------------------|---------------------------------------|
| `/ips/all`                      | Retrieve all IPS records.                           | Array of IPS records.                 |
| `/ipsraw/:id`                   | Retrieve IPS record in default MongoDb format by ID.            | Default MongoDb IPS data.                         |
| `/ipsmongo/:id`                 | Retrieve IPS record in presentation format by ID.        | Presentation formatted IPS data.           |
| `/ips/:id`                      | Retrieve IPS JSON Bundle by its ID.                 | The IPS JSON Bundle format.           |
| `/ipsbasic/:id`                 | Retrieve basic IPS Bundle by ID.                    | Basic IPS data.                       |
| `/ipsbeer/:id/:delim?`          | Retrieve IPS Bundle in BEER format by ID.           | BEER formatted IPS data.              |
| `/ipshl728/:id`          | Retrieve IPS Bundle in HL7 2.8 format by ID.           | HL7 2.8 formatted IPS data.              |
| `/ipsxml/:id`                   | Retrieve IPS Bundle in XML format by ID.            | XML formatted IPS data.               |
| `/ipslegacy/:id`                | Retrieve IPS Bundle in legacy format by ID.         | Legacy JSON formatted IPS data.       |
| `/ipsbyname/:name/:given`       | Retrieve IPS Bundle by patient's name and given name. | The IPS JSON Bundle.                  |
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

## AES-256 Encryption Support

### Overview

This API supports AES-256 encryption for secure data transfer.

- **Incoming Requests**: To send encrypted data, include the `x-encrypted: true` header and provide an encrypted payload.
- **Outgoing Responses**: To receive encrypted responses, include the `Accept-Encryption: aes256` header in your request.

### Usage Instructions

#### For Requests

1. Encrypt your payload using AES-256 encryption with the provided key and IV.
2. Include the `x-encrypted: true` header.
3. Send the encrypted payload in the request body.

#### For Responses

1. Include the `Accept-Encryption: aes256` header in your request.
2. The API will return the response encrypted with AES-256.


## Client-Side Pages

| Page                 | Description                                                                                           |
|----------------------|-------------------------------------------------------------------------------------------------------|
| **Default Page**     | Add, edit, and search for current records. You can also search for records from the navigation bar.   |
| **API Page**         | View the various API GET endpoints, see their output, and download the output.                        |
| **QR Page**          | Produce various forms of QR codes and download them. Formats include IPS JSON, BEER, and others.      |
| **DMICP Page**       | Bulk upload IPS records produced in the SmartDoc format.                                              |
| **Vitals API Pages** | GET and POST between the VitalsIQ IPS WebApp and the IPS MERN WebApp.                                 |
| **NLD API Pages**    | POST to the NLD IPS WebApp.                                                                           |
| **About Pages**      | Information about IPS, the WebApp, the ChangeLog, and the API Documentation page.                     |

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

3. **QR Page**
   - **Purpose:** Generate and download QR codes for IPS records.
   - **Features:** 
     - Create QR codes in various formats including IPS JSON and BEER.
     - Download the generated QR codes.

4. **DMICP Page**
   - **Purpose:** Facilitates the bulk upload of IPS records in the SmartDoc format.
   - **Features:** 
     - Upload multiple IPS records simultaneously.
     - Supports the SmartDoc format for bulk data entry.

5. **Vitals API Pages**
   - **Purpose:** Manage interactions with VitalsIQ IPS WebApp.
   - **Features:** 
     - GET and POST IPS records between VitalsIQ and the IPS MERN WebApp.

6. **NLD API Pages**
   - **Purpose:** Interface with the NLD IPS WebApp.
   - **Features:** 
     - POST data to the NLD WebApp.

7. **About Pages**
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





