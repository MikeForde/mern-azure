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
Install server dependencies:

bash
Copy code
cd server
npm install
Install client dependencies:

bash
Copy code
cd ../client
npm install
Set up environment variables:

Create a .env file in the server directory with the following content:
bash
Copy code
DB_CONN=mongodb://localhost:27017/ipsDB
Start the development server:

bash
Copy code
cd ../server
npm run dev
Start the React development server:

bash
Copy code
cd ../client
npm start

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
| `/convertbeer2mongo`            | Convert a BEER IPS record to MongoDB format.        | BEER as Plain Text  | The MongoDB formatted data. No record created |
| `/convertbeer2ips`              | Convert a BEER IPS record to IPS JSON format.       | BEER as Plain Text | The IPS JSON formatted data. No record created |
| `/convertips2beer`              | Convert an IPS JSON record to BEER format.          | IPS JSON Bundle | The BEER formatted data. No record created            |
| `/ipsfromcda`                   | Add IPS records from a CDA XML format.              | CDA XML Bundle | The created IPS record.              |
| `convertcdatoips`               | Convert CDA XML format to an IPS JSON Bundle        | CDA XML Bundle | The IPS JSON formatted data. No record created |
| `convertcdatobeer`              | Convert CDA XML format to BEER format.              | CDA XML Bundle | The BEER formatted data. No record created    |

### GET Endpoints

| Endpoint                        | Description                                         | Response                              |
|---------------------------------|-----------------------------------------------------|---------------------------------------|
| `/ips/all`                      | Retrieve all IPS records.                           | Array of IPS records.                 |
| `/ipsraw/:id`                   | Retrieve IPS record in raw format by ID.            | Raw IPS data.                         |
| `/ipsmongo/:id`                 | Retrieve IPS record in MongoDB format by ID.        | MongoDB formatted IPS data.           |
| `/ips/:id`                      | Retrieve an IPS record by its ID.                   | The IPS record.                       |
| `/ipsbasic/:id`                 | Retrieve basic IPS record by ID.                    | Basic IPS data.                       |
| `/ipsbeer/:id/:delim?`          | Retrieve IPS record in BEER format by ID.           | BEER formatted IPS data.              |
| `/ipsxml/:id`                   | Retrieve IPS record in XML format by ID.            | XML formatted IPS data.               |
| `/ipslegacy/:id`                | Retrieve IPS record in legacy format by ID.         | Legacy formatted IPS data.            |
| `/ipsbyname/:name/:given`       | Retrieve IPS record by patient's name and given name. | The IPS record.                       |
| `/ips/search/:name`             | Search for IPS records by patient's name.           | Array of IPS records.                 |
| `/fetchipsora/:name/:givenName` | Fetch IPS record from ORA by patient's name and given name. | The IPS record.                       |

### PUT Endpoints

| Endpoint                        | Description                                         | Request Body                                                                                                     | Response                             |
|---------------------------------|-----------------------------------------------------|------------------------------------------------------------------------------------------------------------------|--------------------------------------|
| `/ips/:id`                      | Update an existing IPS record by its ID.            | MongoDb IPS Record - complete or partial| The updated IPS record.              |
| `/ipsuuid/:uuid`                | Update an existing IPS record by its UUID.          | MongoDb IPS Record - complete or partial  | The updated IPS record.              |

### DELETE Endpoints

| Endpoint                        | Description                                         | Response                              |
|---------------------------------|-----------------------------------------------------|---------------------------------------|
| `/ips/:id`                      | Delete an IPS record by its ID.                     | Status message.                       |
| `/ips/practitioner/:practitioner` | Delete all IPS records by the practitioner's name. | Number of records deleted.            |

## Client-Side Pages
BEER Garden Page: Convert IPS records to and from BEER format.
Patient Management: CRUD operations on IPS records.
API Documentation Page: Documentation of available API endpoints.

## Technologies Used
Frontend: React, React Bootstrap
Backend: Node.js, Express
Database: MongoDB
Other: Axios for HTTP requests, Mongoose for MongoDB interaction


## Contributing
Contributions are welcome! Please read our contributing guidelines before you submit a pull request.


## License
This project is licensed under the MIT License. See the LICENSE file for details.





