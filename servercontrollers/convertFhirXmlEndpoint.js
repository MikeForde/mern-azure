const { convertFhirXmlToJson } = require('./servercontrollerfuncs/convertFHIRXMLtoJSON.js');

const convertFhirXmlEndpoint = (req, res) => {
  try {
    // req.body contains the parsed XML from express-xml-bodyparser
    const xmlJson = req.body;
    const fhirJson = convertFhirXmlToJson(xmlJson);
    res.json(fhirJson);
  } catch (error) {
    console.error("Error converting FHIR XML to JSON:", error);
    res.status(500).json({ error: "Failed to convert FHIR XML to JSON" });
  }
};

module.exports = { convertFhirXmlEndpoint };