// servercontrollers/convertXmlEndpoint.js

// Helper function to recursively simplify the JSON produced by express-xml-bodyparser
const simplifyXmlJson = (obj) => {
  if (Array.isArray(obj)) {
    // If the array has a single element, simplify that element.
    if (obj.length === 1) {
      return simplifyXmlJson(obj[0]);
    }
    return obj.map(simplifyXmlJson);
  } else if (typeof obj === 'object' && obj !== null) {
    // If the object only has a "$" key and it contains a "value", return that value.
    if (Object.keys(obj).length === 1 && obj.hasOwnProperty('$')) {
      if (obj['$'] && typeof obj['$'] === 'object' && obj['$'].hasOwnProperty('value')) {
        return obj['$'].value;
      }
      return obj['$'];
    }
    // Otherwise, recursively simplify each property.
    const newObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        newObj[key] = simplifyXmlJson(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
};

const convertXmlEndpoint = (req, res) => {
  try {
    // req.body is the parsed XML (in its verbose form)
    const xmlJson = req.body;
    // Simplify the JSON structure
    const simplifiedJson = simplifyXmlJson(xmlJson);
    res.json(simplifiedJson);
  } catch (error) {
    console.error("Error converting XML to JSON:", error);
    res.status(500).json({ error: "Failed to convert XML to JSON" });
  }
};

module.exports = { convertXmlEndpoint };
