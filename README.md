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

## api-documentation
API Documentation
POST Endpoints
Add IPS Record
Endpoint: /ips
Description: Add a new IPS record.
Request Body:
json
Copy code
{
  "packageUUID": "381238c4-1f92-43a4-8734-4eb05de12bf0",
  "timeStamp": "2024-06-01T18:56:05.429Z",
  "patient": {
    "name": "Doe",
    "given": "John",
    "dob": "1980-01-01T00:00:00.000Z",
    "gender": "Male",
    "nation": "US",
    "practitioner": "Dr. Smith"
  },
  "medication": [],
  "allergies": [],
  "conditions": [],
  "observations": []
}
Response: The created IPS record.
Convert MongoDB to BEER
Endpoint: /convertmongo2beer
Description: Convert a MongoDB IPS record to BEER format.
Request Body:
json
Copy code
{
  "data": "{...MongoDB data...}"
}
Response: The BEER formatted data.
GET Endpoints
Get All IPS Records
Endpoint: /ips/all
Description: Retrieve all IPS records.
Response: Array of IPS records.
Get IPS Record by ID
Endpoint: /ips/:id
Description: Retrieve an IPS record by its ID.
Response: The IPS record.
PUT Endpoints
Update IPS Record
Endpoint: /ips/:id
Description: Update an existing IPS record by its ID.
Request Body:
json
Copy code
{
  "patient": {
    "name": "Updated Name",
    "given": "Updated Given Name"
  }
}
Response: The updated IPS record.
Update IPS Record by UUID
Endpoint: /ipsuuid/:uuid
Description: Update an existing IPS record by its UUID.
Request Body:
json
Copy code
{
  "patient": {
    "name": "Updated Name",
    "given": "Updated Given Name"
  }
}
Response: The updated IPS record.
DELETE Endpoints
Delete IPS Record by ID
Endpoint: /ips/:id
Description: Delete an IPS record by its ID.
Response: Status message.
Delete IPS Records by Practitioner
Endpoint: /ips/practitioner/:practitioner
Description: Delete all IPS records by the practitioner's name.
Response: Number of records deleted.
Client-Side Pages
BEER Garden Page: Convert IPS records to and from BEER format.
Patient Management: CRUD operations on IPS records.
API Documentation Page: Documentation of available API endpoints.
Technologies Used
Frontend: React, React Bootstrap
Backend: Node.js, Express
Database: MongoDB
Other: Axios for HTTP requests, Mongoose for MongoDB interaction
Contributing
Contributions are welcome! Please read our contributing guidelines before you submit a pull request.

License
This project is licensed under the MIT License. See the LICENSE file for details.

markdown
Copy code

### Explanation:

- **Overview**: Gives a high-level summary of the project.
- **Features**: Lists key features.
- **Setup**: Provides detailed steps to set up the project locally.
- **API Documentation**: Details the available API endpoints.
- **Client-Side Pages**: Briefly describes the key frontend pages.
- **Technologies Used**: Lists the technologies and libraries used in the project.
- **Contributing**: A placeholder for contributing guidelines.
- **License**: Specifies the project license.

This README should help new developers and users understand the project, set it up, and start using it. Feel free to adjust specific details and add more sections as needed.





